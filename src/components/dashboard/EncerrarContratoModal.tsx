// Based on Lugo — Copyright (c) 2024 Renilson Medeiros — MIT License
"use client";
import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { LogOut, Loader2, AlertTriangle, CheckCircle2, FileText, ExternalLink } from "lucide-react";

interface Comprovante {
  id: string; mes_referencia: string; valor: number;
  valor_multa: number; valor_juros: number; situation: string;
  data_vencimento: string; data_pagamento: string | null;
}

interface Props {
  open: boolean; onClose: () => void; onSuccess: () => void;
  inquilinoId: string; imovelId: string;
  nomeInquilino: string; docInquilino: string;
  imovelTitulo: string; imovelEndereco: string;
  dataInicio: string;
  comprovantes: Comprovante[];
}

function fmtBRL(v: number) { return v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"}); }
function fmtData(iso:string|null) { if(!iso)return"—"; const[y,m,d]=iso.split("-"); return `${d}/${m}/${y}`; }
function mesLabel(iso:string) { const[y,mo]=iso.split("-"); const M=["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"]; return `${M[parseInt(mo)-1]}/${y}`; }

const MOTIVOS = [
  { value:"cumprimento",          label:"Cumprimento do contrato (saída normal)" },
  { value:"desocupacao_voluntaria",label:"Desocupação voluntária" },
  { value:"despejo",              label:"Despejo / ação judicial" },
  { value:"acordo",               label:"Acordo / distrato amigável" },
  { value:"outros",               label:"Outros" },
];

export default function EncerrarContratoModal({ open, onClose, onSuccess, inquilinoId, imovelId, nomeInquilino, docInquilino, imovelTitulo, imovelEndereco, dataInicio, comprovantes }: Props) {
  const [dataDesocupacao, setDataDesocupacao] = useState(new Date().toISOString().split("T")[0]);
  const [motivo, setMotivo] = useState("desocupacao_voluntaria");
  const [obs, setObs] = useState("");
  const [pdfUrl, setPdfUrl] = useState<string|null>(null);
  const [danoValor, setDanoValor] = useState("0");
  const [danoDesc, setDanoDesc] = useState("");
  const [garantiaExec, setGarantiaExec] = useState("0");
  const [garantiaObs, setGarantiaObs] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"form"|"confirmar">("form");

  const vencidos = useMemo(() => comprovantes.filter(c => c.situation !== "billed"), [comprovantes]);
  const pagas = useMemo(() => comprovantes.filter(c => c.situation === "billed"), [comprovantes]);
  const divida = useMemo(() => vencidos.reduce((s,c) => s+(c.valor||0)+(c.valor_multa||0)+(c.valor_juros||0), 0), [vencidos]);
  const danos = parseFloat(danoValor.replace(/[^0-9.,]/g, "").replace(",", ".")) || 0;
  const garantia = parseFloat(garantiaExec.replace(/[^0-9.,]/g, "").replace(",", ".")) || 0;
  const dividaLiquida = Math.max(0, divida + danos - garantia);
  const temDivida = dividaLiquida > 0 || divida > 0;

  async function gerarRelatorio() {
    try {
      setLoading(true);
      const res = await fetch("/api/pdf/relatorio-divida", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inquilino_id: inquilinoId, imovel_id: imovelId,
          nome_inquilino: nomeInquilino, doc_inquilino: docInquilino,
          imovel_titulo: imovelTitulo, imovel_endereco: imovelEndereco,
          data_inicio: dataInicio, data_desocupacao: dataDesocupacao,
          motivo_encerramento: motivo, comprovantes,
          divida_total: divida, divida_liquida: dividaLiquida,
          danos, dano_descricao: danoDesc,
          garantia_executada: garantia, garantia_obs: garantiaObs,
          obs,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setPdfUrl(json.pdfUrl);
      toast.success("Relatório gerado!");
    } catch (e: any) {
      toast.error("Erro ao gerar relatório", { description: e.message });
    } finally { setLoading(false); }
  }

  async function confirmarEncerramento() {
    try {
      setLoading(true);
      const res = await fetch("/api/inquilinos/encerrar", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inquilino_id: inquilinoId, imovel_id: imovelId,
          data_desocupacao: dataDesocupacao, motivo_encerramento: motivo,
          divida_residual: divida, divida_liquida: dividaLiquida,
          vistoria_danos: danos, vistoria_descricao: danoDesc || null,
          garantia_executada: garantia, garantia_obs: garantiaObs || null,
          relatorio_pdf_url: pdfUrl,
          obs_encerramento: obs || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success("Contrato encerrado!", {
        description: temDivida
? `Imóvel liberado. Dívida líquida de ${fmtBRL(dividaLiquida)} registrada no histórico.`
          : "Imóvel liberado. Contrato encerrado sem pendências.",
      });
      onSuccess(); onClose();
    } catch (e: any) {
      toast.error("Erro ao encerrar contrato", { description: e.message });
    } finally { setLoading(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <LogOut className="h-5 w-5 text-red-600" />
            Encerrar contrato
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{nomeInquilino} · {imovelTitulo}</p>
        </DialogHeader>

        <div className="space-y-5">

          {/* Situação financeira */}
          <div className={`rounded-lg border p-4 space-y-3 ${temDivida ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"}`}>
            <p className={`text-xs font-semibold uppercase tracking-wide ${temDivida ? "text-red-700" : "text-green-700"}`}>
              {temDivida ? "⚠️ Há dívidas em aberto" : "✓ Sem dívidas pendentes"}
            </p>
            {pagas.length > 0 && (
              <div className="text-xs text-muted-foreground">
                <span className="font-medium text-green-700">{pagas.length} parcela{pagas.length>1?"s":""} paga{pagas.length>1?"s":""}</span>
              </div>
            )}
            {vencidos.length > 0 && (
              <div className="space-y-1">
                {vencidos.map(c => (
                  <div key={c.id} className="flex justify-between text-sm">
                    <span className="text-red-700">{mesLabel(c.mes_referencia)} · venc. {fmtData(c.data_vencimento)}</span>
                    <span className="font-medium text-red-800">{fmtBRL((c.valor||0)+(c.valor_multa||0)+(c.valor_juros||0))}</span>
                  </div>
                ))}
                <div className="flex justify-between font-bold text-sm border-t border-red-300 pt-1 mt-1">
                  <span className="text-red-900">Total em aberto</span>
                  <span className="text-red-900">{fmtBRL(divida)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Formulário */}
          {/* Vistoria de saída */}
          <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
            <p className="text-sm font-medium flex items-center gap-2">
              🔍 Vistoria de saída
              <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Danos ao imóvel (R$)</Label>
                <input
                  type="number" min="0" step="0.01"
                  value={danoValor}
                  onChange={e => setDanoValor(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="0,00"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Garantia executada (R$)</Label>
                <input
                  type="number" min="0" step="0.01"
                  value={garantiaExec}
                  onChange={e => setGarantiaExec(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="0,00"
                />
                {garantia > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Garantia: {props.garantia || "não informada"}
                  </p>
                )}
              </div>
              {danos > 0 && (
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-xs">Descrição dos danos</Label>
                  <Textarea value={danoDesc} onChange={e => setDanoDesc(e.target.value)}
                    placeholder="Ex: pintura danificada, vidro quebrado, portão arrombado..."
                    className="min-h-[60px]" />
                </div>
              )}
              {garantia > 0 && (
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-xs">Obs. da garantia</Label>
                  <Textarea value={garantiaObs} onChange={e => setGarantiaObs(e.target.value)}
                    placeholder="Ex: caução de R$ 1.800 devolvido parcialmente, fiador quitou 1 mês..."
                    className="min-h-[60px]" />
                </div>
              )}
            </div>
            {/* Resumo do cálculo */}
            {(danos > 0 || garantia > 0) && (
              <div className="rounded bg-background border p-3 text-sm space-y-1">
                <div className="flex justify-between text-muted-foreground">
                  <span>Parcelas em aberto</span><span>{fmtBRL(divida)}</span>
                </div>
                {danos > 0 && (
                  <div className="flex justify-between text-orange-700">
                    <span>+ Danos ao imóvel</span><span>{fmtBRL(danos)}</span>
                  </div>
                )}
                {garantia > 0 && (
                  <div className="flex justify-between text-green-700">
                    <span>− Garantia executada</span><span>−{fmtBRL(garantia)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold border-t pt-1 mt-1">
                  <span>Dívida líquida</span>
                  <span className={dividaLiquida > 0 ? "text-red-700" : "text-green-700"}>
                    {fmtBRL(dividaLiquida)}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Data de saída</Label>
              <input type="date" value={dataDesocupacao} onChange={e => setDataDesocupacao(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label>Motivo do encerramento</Label>
              <Select value={motivo} onValueChange={setMotivo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MOTIVOS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Observações</Label>
              <Textarea value={obs} onChange={e => setObs(e.target.value)}
                placeholder="Ex: chaves devolvidas, vistoria realizada, acordo verbal sobre dívida..." className="min-h-[70px]" />
            </div>
          </div>

          {/* PDF */}
          {temDivida && (
            <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Relatório de dívida para ação judicial</p>
              {!pdfUrl ? (
                <Button variant="outline" size="sm" className="w-full" onClick={gerarRelatorio} disabled={loading}>
                  {loading ? <><Loader2 className="h-3.5 w-3.5 mr-2 animate-spin"/>Gerando...</>
                           : <><FileText className="h-3.5 w-3.5 mr-2"/>Gerar relatório PDF</>}
                </Button>
              ) : (
                <div className="flex gap-2">
                  <a href={pdfUrl} target="_blank" rel="noreferrer" className="flex-1">
                    <Button variant="outline" size="sm" className="w-full text-green-700 border-green-400">
                      <ExternalLink className="h-3.5 w-3.5 mr-1" /><CheckCircle2 className="h-3.5 w-3.5 mr-1"/>PDF gerado — visualizar
                    </Button>
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Aviso final */}
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 flex gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800">
              Ao confirmar: o inquilino será marcado como <strong>inativo</strong>, o imóvel voltará para <strong>disponível</strong>
              {dividaLiquida > 0 ? ` e a dívida líquida de ${fmtBRL(dividaLiquida)} ficará registrada no histórico.` : "."}
              {" "}Esta ação não pode ser desfeita facilmente.
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
            <Button
              className="bg-red-700 hover:bg-red-800 text-white"
              onClick={confirmarEncerramento}
              disabled={loading || (temDivida && !pdfUrl)}
            >
              {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin"/>Encerrando...</>
                       : <><LogOut className="h-4 w-4 mr-2"/>Confirmar encerramento</>}
            </Button>
          </div>

          {temDivida && !pdfUrl && (
            <p className="text-xs text-center text-muted-foreground">Gere o relatório PDF antes de confirmar o encerramento.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
