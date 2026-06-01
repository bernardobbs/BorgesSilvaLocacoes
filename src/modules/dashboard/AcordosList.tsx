// Based on Lugo — Copyright (c) 2024 Renilson Medeiros — MIT License
"use client";
import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { Handshake, ChevronDown, ChevronUp, CheckCircle2, AlertCircle, Clock, MessageCircle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

function fmtBRL(v: number) { return v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"}); }
function fmtData(iso: string|null) {
  if (!iso) return "—";
  const [y,m,d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
function mesLabel(iso: string) {
  if (!iso) return "";
  const [y,m] = iso.split("-");
  const M=["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  return `${M[parseInt(m)-1]}/${y}`;
}

const STATUS_CONFIG: Record<string,{label:string,className:string}> = {
  ativo:    { label: "Em andamento", className: "bg-blue-50 text-blue-700 border-blue-200" },
  cumprido: { label: "Cumprido ✓",   className: "bg-green-50 text-green-700 border-green-200" },
  quebrado: { label: "Quebrado",     className: "bg-red-50 text-red-700 border-red-200" },
};
const SIT_CONFIG: Record<string,{label:string,icon:any,cls:string}> = {
  open:    { label:"Em aberto", icon: Clock,        cls:"text-blue-600" },
  expired: { label:"Vencido",   icon: AlertCircle,  cls:"text-red-600"  },
  billed:  { label:"Pago",      icon: CheckCircle2, cls:"text-green-600"},
};

interface Parcela { id:string; numero:number; valor:number; data_vencimento:string; situation:string; data_pagamento:string|null; forma_pagamento:string|null; }
interface Acordo {
  id:string; valor_original:number; valor_acordo:number; desconto:number;
  num_parcelas:number; valor_parcela:number; primeira_parcela:string;
  status:string; observacoes:string|null; created_at:string;
  inquilinos: any; // Supabase retorna array em joins aninhados
  parcelas_acordo: Parcela[];
}

export default function AcordosList({ acordos: initial }: { acordos: Acordo[] }) {
  const [acordos, setAcordos] = useState(initial);
  const [expandido, setExpandido] = useState<string|null>(null);
  const [pagandoParcela, setPagandoParcela] = useState<string|null>(null);
  const [forma, setForma] = useState("pix");
  const [dataPag, setDataPag] = useState(new Date().toISOString().split("T")[0]);

  const recarregar = useCallback(async () => {
    const { data } = await supabase
      .from("acordos")
      .select(`id,valor_original,valor_acordo,desconto,num_parcelas,valor_parcela,primeira_parcela,status,observacoes,created_at,
        inquilinos!inner(id,nome_completo,telefone,imovel_id,imoveis!inner(id,titulo)),
        parcelas_acordo(id,numero,valor,data_vencimento,situation,data_pagamento,forma_pagamento)`)
      .order("created_at", { ascending: false });
    setAcordos((data as unknown as Acordo[]) || []);
  }, []);

  async function pagarParcela(parcelaId: string, acordoId: string) {
    try {
      const res = await fetch("/api/acordos/pagar-parcela", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parcela_id: parcelaId, data_pagamento: dataPag, forma_pagamento: forma }),
      });
      if (!res.ok) throw new Error("Erro ao registrar");
      toast.success("Parcela paga!");
      setPagandoParcela(null);
      recarregar();
    } catch { toast.error("Erro ao registrar pagamento"); }
  }

  const ativos   = acordos.filter(a => a.status === "ativo");
  const outros   = acordos.filter(a => a.status !== "ativo");

  return (
    <div className="space-y-6 p-6">
      <DashboardHeader title="Acordos" subtitle="Parcelamentos e negociações em andamento" />

      {acordos.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Handshake className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium">Nenhum acordo registrado</p>
            <p className="text-xs text-muted-foreground mt-1">
              Registre acordos na tela de Pagamentos, no botão "Registrar acordo" de inquilinos com parcelas vencidas.
            </p>
          </CardContent>
        </Card>
      )}

      {ativos.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Em andamento</h2>
          {ativos.map(a => <AcordoCard key={a.id} acordo={a} expandido={expandido===a.id}
            onToggle={() => setExpandido(expandido===a.id ? null : a.id)}
            pagandoParcela={pagandoParcela} setPagandoParcela={setPagandoParcela}
            forma={forma} setForma={setForma} dataPag={dataPag} setDataPag={setDataPag}
            pagarParcela={pagarParcela} />)}
        </div>
      )}

      {outros.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Histórico</h2>
          {outros.map(a => <AcordoCard key={a.id} acordo={a} expandido={expandido===a.id}
            onToggle={() => setExpandido(expandido===a.id ? null : a.id)}
            pagandoParcela={pagandoParcela} setPagandoParcela={setPagandoParcela}
            forma={forma} setForma={setForma} dataPag={dataPag} setDataPag={setDataPag}
            pagarParcela={pagarParcela} />)}
        </div>
      )}
    </div>
  );
}

function AcordoCard({ acordo, expandido, onToggle, pagandoParcela, setPagandoParcela, forma, setForma, dataPag, setDataPag, pagarParcela }: any) {
  const inq = Array.isArray(acordo.inquilinos) ? acordo.inquilinos[0] : acordo.inquilinos;
  const im = Array.isArray(inq?.imoveis) ? inq.imoveis[0] : inq?.imoveis;
  const parcelas: Parcela[] = acordo.parcelas_acordo || [];
  const pagas = parcelas.filter(p => p.situation === "billed").length;
  const cfg = STATUS_CONFIG[acordo.status] || STATUS_CONFIG.ativo;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${cfg.className}`}>{cfg.label}</span>
              <span className="text-xs text-muted-foreground">{fmtData(acordo.created_at.split("T")[0])}</span>
            </div>
            <p className="font-medium mt-1">{inq?.nome_completo}</p>
            <p className="text-sm text-muted-foreground">{im?.titulo}</p>
            <div className="flex gap-4 mt-1.5 text-xs text-muted-foreground">
              <span>Original: <strong className="text-red-600">{fmtBRL(acordo.valor_original)}</strong></span>
              {acordo.desconto > 0 && <span>Desconto: <strong className="text-green-600">-{fmtBRL(acordo.desconto)}</strong></span>}
              <span>Acordo: <strong>{fmtBRL(acordo.valor_acordo)}</strong></span>
              <span>{pagas}/{acordo.num_parcelas} parcelas pagas</span>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onToggle}>
            {expandido ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>

      {expandido && (
        <CardContent className="pt-0 space-y-2">
          {parcelas.sort((a,b) => a.numero - b.numero).map(p => {
            const sit = SIT_CONFIG[p.situation] || SIT_CONFIG.open;
            const Icon = sit.icon;
            const isPaying = pagandoParcela === p.id;
            return (
              <div key={p.id} className={`rounded-lg border p-3 ${p.situation==="expired"?"bg-red-50 border-red-200":p.situation==="billed"?"bg-green-50 border-green-200 opacity-70":"bg-muted/30"}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium w-20">Parcela {p.numero}</span>
                    <span className="text-xs text-muted-foreground">{fmtData(p.data_vencimento)}</span>
                    <span className="text-sm font-semibold">{fmtBRL(p.valor)}</span>
                    <div className={`flex items-center gap-1 text-xs ${sit.cls}`}>
                      <Icon className="h-3.5 w-3.5" />{sit.label}
                      {p.situation==="billed" && p.data_pagamento && <span className="text-muted-foreground">· {fmtData(p.data_pagamento)}</span>}
                    </div>
                  </div>
                  {p.situation !== "billed" && !isPaying && (
                    <Button size="sm" onClick={() => setPagandoParcela(p.id)}>Registrar pagamento</Button>
                  )}
                </div>
                {isPaying && (
                  <div className="mt-3 grid grid-cols-3 gap-3 pt-3 border-t">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Data</label>
                      <input type="date" value={dataPag} onChange={e => setDataPag(e.target.value)}
                        className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Forma</label>
                      <Select value={forma} onValueChange={setForma}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pix">Pix</SelectItem>
                          <SelectItem value="dinheiro">Dinheiro</SelectItem>
                          <SelectItem value="transferencia">Transferência</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-end gap-2">
                      <Button size="sm" className="flex-1" onClick={() => pagarParcela(p.id, acordo.id)}>Confirmar</Button>
                      <Button size="sm" variant="outline" onClick={() => setPagandoParcela(null)}>✕</Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {acordo.observacoes && (
            <p className="text-xs text-muted-foreground border-t pt-2 mt-2">📝 {acordo.observacoes}</p>
          )}
        </CardContent>
      )}
    </Card>
  );
}
