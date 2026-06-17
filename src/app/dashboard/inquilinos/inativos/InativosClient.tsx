// Based on Lugo — Copyright (c) 2024 Renilson Medeiros — MIT License
"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import Link from "next/link";
import { ArrowLeft, FileWarning, Download, ExternalLink, Loader2, ChevronDown, ChevronUp, Phone, Mail, Building2 } from "lucide-react";
import { toast } from "sonner";

function fmtBRL(v:number){return(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});}
function fmtData(iso:string|null){if(!iso)return"—";const[y,m,d]=iso.split("-");return`${d}/${m}/${y}`;}
function mesLabel(iso:string){if(!iso)return"";const[y,mo]=iso.split("-");const M=["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];return`${M[parseInt(mo)-1]}/${y}`;}

const MOTIVOS:Record<string,string>={
  cumprimento:"Cumprimento do contrato",
  desocupacao_voluntaria:"Desocupação voluntária",
  despejo:"Despejo",acordo:"Acordo",outros:"Outros",
};

interface Props {
  inativos: any[];
  comprovantesMap: Record<string,any[]>;
  notificacoesMap: Record<string,any[]>;
  acordosMap: Record<string,any[]>;
}

export default function InativosClient({ inativos, comprovantesMap, notificacoesMap, acordosMap }: Props) {
  const [expandido, setExpandido] = useState<string|null>(null);
  const [gerandoPdf, setGerandoPdf] = useState<string|null>(null);
  const [pdfUrls, setPdfUrls] = useState<Record<string,string>>({});
  const [gerandoCorreios, setGerandoCorreios] = useState<string|null>(null);
  const [marcandoAdv, setMarcandoAdv] = useState<string|null>(null);
  const [advModal, setAdvModal] = useState<{id:string;nome:string}|null>(null);
  const [advObs, setAdvObs] = useState("");

  const temDivida = inativos.filter(i => (i.divida_residual||0) > 0);
  const semDivida = inativos.filter(i => (i.divida_residual||0) === 0);

  async function gerarDossie(inquilino_id: string) {
    setGerandoPdf(inquilino_id);
    try {
      const res = await fetch("/api/pdf/dossie-juridico", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ inquilino_id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setPdfUrls(p => ({...p, [inquilino_id]: json.pdfUrl}));
      toast.success("Dossiê gerado!", { description:"PDF completo pronto para enviar ao advogado." });
    } catch(e:any) {
      toast.error("Erro ao gerar dossiê", { description: e.message });
    } finally { setGerandoPdf(null); }
  }

  async function gerarCorreios(inquilino_id: string) {
    setGerandoCorreios(inquilino_id);
    try {
      const res = await fetch("/api/pdf/notificacao-correios", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ inquilino_id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      window.open(json.pdfUrl, "_blank");
      toast.success("PDF para Correios gerado!");
    } catch(e:any) { toast.error("Erro ao gerar PDF", { description: e.message }); }
    finally { setGerandoCorreios(null); }
  }

  async function marcarEnviadoAdvogado(id: string, obs: string) {
    setMarcandoAdv(id);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { error } = await supabase
        .from("inquilinos")
        .update({
          enviado_advogado_em: new Date().toISOString(),
          advogado_status: "enviado",
          advogado_obs: obs || null,
        })
        .eq("id", id);
      if (error) throw error;
      toast.success("Caso marcado como enviado ao advogado!");
      setAdvModal(null); setAdvObs("");
      window.location.reload();
    } catch(e:any) { toast.error("Erro ao registrar", { description: e.message }); }
    finally { setMarcandoAdv(null); }
  }

  function InativoCard({ i }: { i: any }) {
    const im = Array.isArray(i.imoveis) ? i.imoveis[0] : i.imoveis;
    const comps = comprovantesMap[i.id] || [];
    const notifs = notificacoesMap[i.id] || [];
    const acordos = acordosMap[i.id] || [];
    const divida = i.divida_residual || 0;
    const pago = comps.filter((c:any)=>c.situation==="billed").reduce((s:number,c:any)=>s+(c.valor||0),0);
    const devido = comps.filter((c:any)=>c.situation!=="billed").reduce((s:number,c:any)=>s+(c.valor||0)+(c.valor_multa||0)+(c.valor_juros||0),0);
    const exp = expandido === i.id;
    const url = pdfUrls[i.id] || i.relatorio_pdf_url;

    return (
      <Card className={divida > 0 ? "border-red-200" : ""}>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium">{i.nome_completo}</p>
                {divida > 0 && (
                  <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium border border-red-200">
                    Dívida: {fmtBRL(divida)}
                  </span>
                )}
                {divida === 0 && (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium border border-green-200">
                    Encerrado sem dívida
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                <Building2 className="h-3 w-3"/>
                <span>{im?.titulo}</span>
                <span className="mx-1">·</span>
                <span>Saiu em {fmtData(i.data_desocupacao)}</span>
                <span className="mx-1">·</span>
                <span>{MOTIVOS[i.motivo_encerramento] || i.motivo_encerramento || "—"}</span>
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                {i.telefone && <span className="flex items-center gap-1"><Phone className="h-3 w-3"/>{i.telefone}</span>}
                {i.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3"/>{i.email}</span>}
              </div>
            </div>
            <div className="flex gap-2 items-start flex-wrap justify-end">
              {divida > 0 && !url && (
                <Button size="sm" variant="outline" className="text-red-700 border-red-300"
                  disabled={gerandoPdf===i.id} onClick={()=>gerarDossie(i.id)}>
                  {gerandoPdf===i.id
                    ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin"/>Gerando...</>
                    : <><FileWarning className="h-3.5 w-3.5 mr-1.5"/>Gerar dossiê</>}
                </Button>
              )}
              {divida > 0 && (
                <Button size="sm" variant="outline" className="text-blue-700 border-blue-300"
                  disabled={gerandoCorreios===i.id} onClick={()=>gerarCorreios(i.id)}>
                  {gerandoCorreios===i.id
                    ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin"/>Gerando...</>
                    : <>📮 Correios AR</>}
                </Button>
              )}
              {divida > 0 && !i.enviado_advogado_em && (
                <Button size="sm" variant="outline" className="text-purple-700 border-purple-300"
                  onClick={()=>{ setAdvModal({id:i.id, nome:i.nome_completo}); setAdvObs(""); }}>
                  ⚖️ Enviar ao advogado
                </Button>
              )}
              {i.enviado_advogado_em && (
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full border border-purple-200 font-medium">
                  ⚖️ Adv. em {i.enviado_advogado_em.split("T")[0].split("-").reverse().join("/")}
                </span>
              )}
              {url && (
                <div className="flex gap-1.5">
                  <a href={url} target="_blank" rel="noreferrer">
                    <Button size="sm" variant="outline" className="text-green-700 border-green-400">
                      <ExternalLink className="h-3.5 w-3.5 mr-1"/>Ver PDF
                    </Button>
                  </a>
                  {divida > 0 && (
                    <Button size="sm" variant="outline" className="text-red-600 border-red-300"
                      onClick={()=>gerarDossie(i.id)} disabled={gerandoPdf===i.id}>
                      ↻ Atualizar
                    </Button>
                  )}
                </div>
              )}
              <Button variant="ghost" size="sm" onClick={()=>setExpandido(exp?null:i.id)}>
                {exp ? <ChevronUp className="h-4 w-4"/> : <ChevronDown className="h-4 w-4"/>}
              </Button>
            </div>
          </div>
        </CardHeader>

        {exp && (
          <CardContent className="pt-0 space-y-4">
            {/* Resumo financeiro */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">Total pago</p>
                <p className="font-semibold text-green-700">{fmtBRL(pago)}</p>
              </div>
              <div className={`${divida>0?"bg-red-50":"bg-muted/30"} rounded-lg p-3 text-center`}>
                <p className="text-xs text-muted-foreground">Dívida residual</p>
                <p className={`font-semibold ${divida>0?"text-red-700":"text-muted-foreground"}`}>{fmtBRL(divida)}</p>
              </div>
              <div className="bg-muted/30 rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">Período</p>
                <p className="font-semibold text-xs">{fmtData(i.data_inicio)} → {fmtData(i.data_desocupacao)}</p>
              </div>
            </div>

            {/* Comprovantes */}
            {comps.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Histórico de parcelas</p>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {comps.map((c:any) => (
                    <div key={c.id} className={`flex justify-between items-center text-xs p-2 rounded ${c.situation==="billed"?"bg-green-50":"bg-red-50"}`}>
                      <span className="font-medium">{mesLabel(c.mes_referencia)}</span>
                      <span className="text-muted-foreground">{fmtData(c.data_vencimento)}</span>
                      <span>{fmtBRL((c.valor||0)+(c.valor_multa||0)+(c.valor_juros||0))}</span>
                      <span className={c.situation==="billed"?"text-green-700 font-medium":"text-red-700 font-medium"}>
                        {c.situation==="billed"?`Pago ${fmtData(c.data_pagamento)}`:"Não pago"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notificações enviadas */}
            {notifs.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Notificações enviadas ({notifs.length})</p>
                <div className="space-y-1">
                  {notifs.map((n:any) => {
                    const cfg = Array.isArray(n.config_notificacoes)?n.config_notificacoes[0]:n.config_notificacoes;
                    const prof = Array.isArray(n.profiles)?n.profiles[0]:n.profiles;
                    return (
                      <div key={n.id} className="text-xs text-muted-foreground flex gap-2 py-1 border-b border-border last:border-0">
                        <span className="font-medium text-foreground">{fmtData(n.enviado_em?.split("T")[0])}</span>
                        <span>{cfg?.label||`Estágio ${n.estagio}`}</span>
                        <span>·</span>
                        <span>D+{n.dias_atraso}</span>
                        <span>·</span>
                        <span>{fmtBRL(n.valor_total)}</span>
                        {prof?.nome_completo && <span className="ml-auto">por {prof.nome_completo.split(" ")[0]}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Acordos */}
            {acordos.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Acordos ({acordos.length})</p>
                {acordos.map((a:any) => (
                  <div key={a.id} className="text-xs bg-blue-50 rounded p-2">
                    <span className="font-medium">R$ {fmtBRL(a.valor_acordo)} em {a.num_parcelas}x</span>
                    <span className={`ml-2 px-1.5 py-0.5 rounded font-medium ${a.status==="cumprido"?"bg-green-100 text-green-700":a.status==="quebrado"?"bg-red-100 text-red-700":"bg-blue-100 text-blue-700"}`}>
                      {a.status}
                    </span>
                    {a.observacoes && <p className="text-muted-foreground mt-1">{a.observacoes}</p>}
                  </div>
                ))}
              </div>
            )}

            {i.obs_encerramento && (
              <div className="text-xs text-muted-foreground bg-muted/30 rounded p-2">
                📝 {i.obs_encerramento}
              </div>
            )}
          </CardContent>
        )}
      </Card>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Modal Advogado */}
      {advModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-background border rounded-xl shadow-xl w-full max-w-sm p-5 space-y-4">
            <h3 className="font-semibold">Enviar ao advogado</h3>
            <p className="text-sm text-muted-foreground">{advModal.nome}</p>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Observações (opcional)</label>
              <textarea value={advObs} onChange={e=>setAdvObs(e.target.value)}
                placeholder="Ex: Advogado Dr. João — (86) 99999-0000 — processo nº..."
                className="w-full h-20 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none" />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={()=>setAdvModal(null)} className="px-4 py-2 text-sm border rounded-md">Cancelar</button>
              <button onClick={()=>marcarEnviadoAdvogado(advModal.id, advObs)}
                disabled={marcandoAdv===advModal.id}
                className="px-4 py-2 text-sm bg-purple-600 text-white rounded-md disabled:opacity-50">
                {marcandoAdv ? "Salvando..." : "Confirmar envio"}
              </button>
            </div>
          </div>
        </div>
      )}
      <div>
        <Link href="/dashboard/inquilinos" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="h-4 w-4"/>Voltar para inquilinos
        </Link>
        <DashboardHeader title="Ex-inquilinos" subtitle="Histórico de contratos encerrados e dívidas residuais" />
      </div>

      {inativos.length === 0 && (
        <Card><CardContent className="py-12 text-center text-muted-foreground text-sm">Nenhum contrato encerrado ainda.</CardContent></Card>
      )}

      {temDivida.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-red-700 uppercase tracking-wide flex items-center gap-2">
            <FileWarning className="h-4 w-4"/>Com dívida residual ({temDivida.length})
          </h2>
          {temDivida.map(i => <InativoCard key={i.id} i={i}/>)}
        </div>
      )}

      {semDivida.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Encerrados sem dívida ({semDivida.length})</h2>
          {semDivida.map(i => <InativoCard key={i.id} i={i}/>)}
        </div>
      )}
    </div>
  );
}
