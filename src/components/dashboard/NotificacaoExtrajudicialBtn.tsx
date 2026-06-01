// Based on Lugo — Copyright (c) 2024 Renilson Medeiros — MIT License
"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileWarning, Loader2, Download, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface Comprovante {
  mes_referencia: string;
  valor: number;
  valor_multa: number;
  valor_juros: number;
}

interface Props {
  inquilinoId: string;
  imovelId: string;
  nomeInquilino: string;
  docInquilino: string;
  imovelTitulo: string;
  imovelEndereco: string;
  comprovantesVencidos: Comprovante[];
  diasAtraso: number;
  valorTotal: number;
}

function mesLabel(iso: string) {
  const [y,m] = iso.split("-");
  const M=["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  return `${M[parseInt(m)-1]}/${y}`;
}
function fmtBRL(v: number) { return v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"}); }

export default function NotificacaoExtrajudicialBtn(p: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string|null>(null);

  async function gerar() {
    try {
      setLoading(true);
      const meses_divida = p.comprovantesVencidos.map(c => ({
        mes: mesLabel(c.mes_referencia),
        valor: (c.valor||0) + (c.valor_multa||0) + (c.valor_juros||0),
      }));

      const res = await fetch("/api/pdf/notificacao-extrajudicial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inquilino_id: p.inquilinoId,
          imovel_id: p.imovelId,
          nome_inquilino: p.nomeInquilino,
          doc_inquilino: p.docInquilino,
          imovel_titulo: p.imovelTitulo,
          imovel_endereco: p.imovelEndereco,
          meses_divida,
          valor_total: p.valorTotal,
          dias_atraso: p.diasAtraso,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setPdfUrl(json.pdfUrl);
      toast.success("Notificação gerada!");
    } catch (e: any) {
      toast.error("Erro ao gerar PDF", { description: e.message });
    } finally { setLoading(false); }
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="text-red-700 border-red-300 hover:bg-red-50"
        onClick={() => setOpen(true)}
      >
        <FileWarning className="h-3.5 w-3.5 mr-1" />
        Notificação extrajudicial
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <FileWarning className="h-5 w-5" />
              Notificação Extrajudicial
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Resumo */}
            <div className="rounded-lg bg-red-50 border border-red-200 p-4 space-y-2">
              <p className="text-sm font-semibold text-red-800">{p.nomeInquilino}</p>
              <p className="text-xs text-red-600">{p.imovelTitulo}</p>
              <div className="border-t border-red-200 pt-2 mt-2 space-y-1">
                {p.comprovantesVencidos.map(c => (
                  <div key={c.mes_referencia} className="flex justify-between text-xs text-red-700">
                    <span>{mesLabel(c.mes_referencia)}</span>
                    <span className="font-medium">{fmtBRL((c.valor||0)+(c.valor_multa||0)+(c.valor_juros||0))}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm font-bold text-red-900 border-t border-red-300 pt-1 mt-1">
                  <span>Total ({p.diasAtraso}d atraso)</span>
                  <span>{fmtBRL(p.valorTotal)}</span>
                </div>
              </div>
            </div>

            {/* Aviso legal */}
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 space-y-1">
              <p className="font-semibold">⚖️ Informação importante</p>
              <p>Este documento cita a Lei nº 8.245/91 e menciona as medidas legais cabíveis. Ele tem caráter de notificação formal mas <strong>não substitui</strong> uma notificação por AR ou por oficial de justiça.</p>
              <p>Use como primeiro aviso formal antes de acionar um advogado.</p>
            </div>

            {!pdfUrl ? (
              <Button
                className="w-full bg-red-700 hover:bg-red-800 text-white"
                onClick={gerar}
                disabled={loading}
              >
                {loading
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Gerando PDF...</>
                  : <><FileWarning className="h-4 w-4 mr-2" />Gerar notificação</>
                }
              </Button>
            ) : (
              <div className="flex gap-2">
                <a href={pdfUrl} target="_blank" rel="noreferrer" className="flex-1">
                  <Button className="w-full" variant="outline">
                    <ExternalLink className="h-4 w-4 mr-2" />Visualizar PDF
                  </Button>
                </a>
                <a href={pdfUrl} download className="flex-1">
                  <Button className="w-full bg-red-700 hover:bg-red-800 text-white">
                    <Download className="h-4 w-4 mr-2" />Baixar
                  </Button>
                </a>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
