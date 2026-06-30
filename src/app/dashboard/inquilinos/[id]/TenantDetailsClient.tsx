// Based on Lugo — Copyright (c) 2024 Renilson Medeiras — MIT License
"use client";
import { toast } from "sonner";
import { useState } from "react";
import ReajusteModal from "@/components/dashboard/ReajusteModal";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { User, Phone, Mail, Building2, Calendar, FileText, Edit, UserMinus, ArrowLeft, TrendingUp, Loader2, MessageSquare, Scale, Copy, ExternalLink } from "lucide-react";
import EncerrarContratoModal from "@/components/dashboard/EncerrarContratoModal";
import { useFormFormatting } from "@/lib/hooks/useFormFormatting";
import { supabase } from "@/lib/supabase";

function fmtV(v: number) { return (v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"}); }
function fmtD(iso: string|null) { if(!iso)return"—"; const[y,m,d]=iso.split("-"); return`${d}/${m}/${y}`; }
function mesL(iso: string) { if(!iso)return""; const[y,mo]=iso.split("-"); const M=["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"]; return`${M[parseInt(mo)-1]}/${y}`; }

const formaMap:Record<string,string>={pix:"Pix",dinheiro:"Dinheiro",transferencia:"Transferência",cartao:"Cartão",cheque:"Cheque"};

export default function TenantDetailsClient({ tenant, historicoPag, historicoNotif, acordos }: {
  tenant: any; historicoPag: any[]; historicoNotif: any[]; acordos: any[];
}) {
  const router = useRouter();
  const { formatarCPF, formatarTelefone } = useFormFormatting();
  const [encerrarOpen, setEncerrarOpen] = useState(false);
  const [gerandoContrato, setGerandoContrato] = useState(false);

  // T3.3 — Mensagem consolidada
  const [msgConsolidada, setMsgConsolidada] = useState<string|null>(null);
  const [gerandoMsg, setGerandoMsg] = useState(false);

  // T5.5 — Enviar ao advogado
  const [advogadoOpen, setAdvogadoOpen] = useState(false);
  const [advogadoObs, setAdvogadoObs] = useState("");
  const [enviandoAdvogado, setEnviandoAdvogado] = useState(false);

  async function gerarMensagemConsolidada() {
    setGerandoMsg(true);
    try {
      const { data, error } = await supabase.functions.invoke("gerar_mensagem_consolidada", {
        body: { inquilino_id: tenant.id },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error || "Erro desconhecido");
      if (data.message === "Sem parcelas vencidas") {
        toast.info("Nenhuma parcela vencida encontrada.");
        return;
      }
      setMsgConsolidada(data.mensagem);
    } catch (e: any) { toast.error("Erro ao gerar mensagem", { description: e.message }); }
    finally { setGerandoMsg(false); }
  }

  async function enviarAdvogado() {
    setEnviandoAdvogado(true);
    try {
      const { data, error } = await supabase.functions.invoke("enviar_advogado", {
        body: { inquilino_id: tenant.id, observacoes: advogadoObs || null },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error || "Erro desconhecido");
      toast.success("Caso enviado ao advogado!", { description: tenant.nome_completo });
      setAdvogadoOpen(false);
      router.refresh();
    } catch (e: any) { toast.error("Erro ao enviar", { description: e.message }); }
    finally { setEnviandoAdvogado(false); }
  }

  async function gerarContrato() {
    setGerandoContrato(true);
    try {
      const res = await fetch("/api/pdf/contrato", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inquilino_id: tenant.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      window.open(json.pdfUrl, "_blank");
      toast.success("Contrato gerado!");
    } catch (e: any) { toast.error("Erro ao gerar contrato", { description: e.message }); }
    finally { setGerandoContrato(false); }
  }
  const [reajusteOpen, setReajusteOpen] = useState(false);

  const acordoAtivo = acordos.find((a:any) => a.status === "ativo");
  const mesesCobertos = new Set<string>(
    acordoAtivo?.meses_cobertos?.map((d:string) => d.slice(0,7)) || []
  );

  const im = tenant.imoveis;

  return (
    <div className="space-y-6 p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">{tenant.nome_completo}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge className={tenant.status === "ativo" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}>
                {tenant.status === "ativo" ? "Ativo" : "Encerrado"}
              </Badge>
              {tenant.enviado_advogado_em && (
                <Badge className="bg-red-100 text-red-700 border-red-200">
                  ⚖️ Advogado desde {fmtD(tenant.enviado_advogado_em.split("T")[0])}
                </Badge>
              )}
              {im && <span className="text-sm text-muted-foreground">{im.titulo}</span>}
            </div>
          </div>
        </div>
        <div className="flex gap-2 shrink-0 flex-wrap justify-end">
          <Link href={`/dashboard/inquilinos/${tenant.id}/editar`}>
            <Button variant="outline" size="sm"><Edit className="h-4 w-4 mr-1.5"/>Editar</Button>
          </Link>
          {tenant.status === "ativo" && (
            <Button variant="outline" size="sm" className="text-blue-600 border-blue-400"
              onClick={() => setReajusteOpen(true)}>
              <TrendingUp className="h-4 w-4 mr-1.5"/>Reajustar
            </Button>
          )}
          <Button variant="outline" size="sm" className="text-green-700 border-green-400"
            onClick={gerarMensagemConsolidada} disabled={gerandoMsg}>
            {gerandoMsg ? <Loader2 className="h-4 w-4 animate-spin"/> : <MessageSquare className="h-4 w-4 mr-1.5"/>}
            {gerandoMsg ? "..." : "Msg. consolidada"}
          </Button>
          {tenant.status === "ativo" && !tenant.enviado_advogado_em && (
            <Button variant="outline" size="sm" className="text-red-700 border-red-400"
              onClick={() => setAdvogadoOpen(true)}>
              <Scale className="h-4 w-4 mr-1.5"/>Advogado
            </Button>
          )}
          {tenant.status === "ativo" && (
            <Button variant="outline" size="sm" className="text-orange-600 border-orange-400"
              onClick={() => setEncerrarOpen(true)}>
              <UserMinus className="h-4 w-4 mr-1.5"/>Finalizar
            </Button>
          )}
        </div>
      </div>

      {/* Dados pessoais */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4"/>Dados pessoais</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm">
          <div><p className="text-muted-foreground">CPF</p><p className="font-medium">{formatarCPF(tenant.cpf||"")}</p></div>
          <div><p className="text-muted-foreground">Telefone</p>
            <p className="font-medium flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5"/>{formatarTelefone(tenant.telefone||"")}
            </p>
          </div>
          {tenant.email && <div className="col-span-2"><p className="text-muted-foreground">E-mail</p>
            <p className="font-medium flex items-center gap-1.5"><Mail className="h-3.5 w-3.5"/>{tenant.email}</p>
          </div>}
        </CardContent>
      </Card>

      {/* Locação */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><Calendar className="h-4 w-4"/>Locação</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm">
          {im && (
            <div className="col-span-2">
              <p className="text-muted-foreground">Imóvel</p>
              <Link href={`/dashboard/imoveis/${im.id}`} className="font-medium flex items-center gap-1.5 hover:text-primary hover:underline">
                <Building2 className="h-3.5 w-3.5"/>{im.titulo}
              </Link>
              <p className="text-xs text-muted-foreground mt-0.5">{im.endereco_rua}, {im.endereco_numero}</p>
            </div>
          )}
          <div><p className="text-muted-foreground">Início</p><p className="font-medium">{fmtD(tenant.data_inicio)}</p></div>
          <div><p className="text-muted-foreground">Vencimento</p><p className="font-medium">Dia {tenant.dia_vencimento}</p></div>
          <div><p className="text-muted-foreground">Aluguel</p><p className="font-semibold text-primary">{fmtV(tenant.valor_aluguel)}/mês</p></div>
          <div><p className="text-muted-foreground">Garantia</p><p className="font-medium capitalize">{tenant.garantia||"nenhuma"}</p></div>
          {tenant.numero_contrato && <div><p className="text-muted-foreground">Contrato</p><p className="font-medium">{tenant.numero_contrato}</p></div>}
          {(tenant as any).contrato_pdf_url ? (
            <div className="col-span-2 flex items-center justify-between bg-green-50 rounded-lg p-2.5">
              <div>
                <p className="text-xs font-medium text-green-700">📄 Contrato em PDF disponível</p>
                {(tenant as any).contrato_gerado_em && (
                  <p className="text-xs text-muted-foreground">Gerado em {fmtD((tenant as any).contrato_gerado_em.split("T")[0])}</p>
                )}
              </div>
              <div className="flex gap-2">
                <a href={(tenant as any).contrato_pdf_url} target="_blank" rel="noreferrer">
                  <Button size="sm" variant="outline" className="text-green-700 border-green-400">Ver PDF</Button>
                </a>
                <Button size="sm" variant="outline" onClick={gerarContrato} disabled={gerandoContrato}>
                  {gerandoContrato ? "..." : "↻ Regerar"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="col-span-2">
              <Button size="sm" variant="outline" onClick={gerarContrato} disabled={gerandoContrato}
                className="gap-1.5">
                {gerandoContrato ? <><Loader2 className="h-3.5 w-3.5 animate-spin"/>Gerando...</> : <>📄 Gerar contrato PDF</>}
              </Button>
            </div>
          )}
          {tenant.multa_percentual && <div><p className="text-muted-foreground">Multa / Juros</p><p className="font-medium">{tenant.multa_percentual}% / {tenant.juros_percentual}% a.m.</p></div>}
        </CardContent>
      </Card>

      {/* Histórico financeiro */}
      {historicoPag.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4"/>Histórico financeiro</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Sumário */}
            <div className="grid grid-cols-4 gap-2">
              {[
                {label:"Pagos",v:historicoPag.filter(p=>p.situation==="billed").length,cls:"text-green-700 bg-green-50"},
                {label:"Em aberto",v:historicoPag.filter(p=>p.situation==="open").length,cls:"text-blue-700 bg-blue-50"},
                {label:"Vencidos",v:historicoPag.filter(p=>p.situation==="expired"&&!mesesCobertos.has(p.mes_referencia.slice(0,7))).length,cls:"text-red-700 bg-red-50"},
                {label:"Acordos",v:acordos.length,cls:"text-purple-700 bg-purple-50"},
              ].map(({label,v,cls})=>(
                <div key={label} className={`${cls.split(" ")[1]} rounded-lg p-2.5 text-center`}>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className={`text-xl font-semibold ${cls.split(" ")[0]}`}>{v}</p>
                </div>
              ))}
            </div>
            {/* Lista */}
            <div className="rounded-lg border overflow-hidden">
              {historicoPag.map((p:any) => {
                const total=(p.valor||0)+(p.valor_multa||0)+(p.valor_juros||0);
                const emAcordo = p.situation==="expired" && mesesCobertos.has(p.mes_referencia.slice(0,7));
                return (
                  <div key={p.id} className={`flex items-center gap-3 px-3 py-2.5 text-sm border-b last:border-0 ${p.situation==="billed"?"bg-green-50/50":emAcordo?"bg-blue-50/50":p.situation==="expired"?"bg-red-50/50":""}`}>
                    <span className="font-medium w-16 shrink-0">{mesL(p.mes_referencia)}</span>
                    <span className="text-xs text-muted-foreground shrink-0">venc. {fmtD(p.data_vencimento)}</span>
                    <span className="font-medium">{fmtV(total)}</span>
                    {(p.valor_multa||0)+(p.valor_juros||0)>0 && <span className="text-xs text-red-500">c/ enc.</span>}
                    <span className="ml-auto text-xs font-medium">
                      {p.situation==="billed" && <span className="text-green-700">✓ {fmtD(p.data_pagamento)}{p.forma_pagamento?` · ${formaMap[p.forma_pagamento]||p.forma_pagamento}`:""}</span>}
                      {emAcordo && <span className="text-blue-700">🤝 Em acordo</span>}
                      {p.situation==="expired" && !emAcordo && <span className="text-red-700">✗ Vencido</span>}
                      {p.situation==="open" && <span className="text-blue-700">Em aberto</span>}
                    </span>
                    {p.receipt_hash && (
                      <span className="ml-1 text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded flex items-center gap-1 cursor-pointer"
                        title={`Hash completo: ${p.receipt_hash}`}
                        onClick={() => navigator.clipboard.writeText(p.receipt_hash).then(()=>alert("Hash copiado!"))}>
                        🔐 {p.receipt_hash.slice(0,12).toUpperCase()}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Acordos */}
            {acordos.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Acordos</p>
                {acordos.map((a:any) => {
                  const parcelas=a.parcelas_acordo||[];
                  const pagas=parcelas.filter((p:any)=>p.situation==="billed").length;
                  return (
                    <div key={a.id} className="rounded-lg border overflow-hidden">
                      <div className={`flex items-center justify-between px-3 py-2.5 text-sm ${a.status==="cumprido"?"bg-green-50":a.status==="quebrado"?"bg-red-50":"bg-blue-50"}`}>
                        <span className="font-medium">{fmtV(a.valor_acordo)} em {a.num_parcelas}x de {fmtV(a.valor_parcela)}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{pagas}/{a.num_parcelas} pagas</span>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${a.status==="cumprido"?"bg-green-100 text-green-700":a.status==="quebrado"?"bg-red-100 text-red-700":"bg-blue-100 text-blue-700"}`}>
                            {a.status==="cumprido"?"Cumprido":a.status==="quebrado"?"Quebrado":"Em andamento"}
                          </span>
                        </div>
                      </div>
                      <div className="divide-y">
                        {parcelas.sort((x:any,y:any)=>x.numero-y.numero).map((p:any)=>(
                          <div key={p.id} className={`flex items-center gap-3 px-3 py-2 text-xs ${p.situation==="billed"?"bg-green-50/30":p.situation==="expired"?"bg-red-50/30":""}`}>
                            <span className="font-medium w-16">Parcela {p.numero}</span>
                            <span className="text-muted-foreground">{fmtD(p.data_vencimento)}</span>
                            <span className="font-medium">{fmtV(p.valor)}</span>
                            <span className="ml-auto">
                              {p.situation==="billed" && <span className="text-green-700">✓ Pago {fmtD(p.data_pagamento)}</span>}
                              {p.situation==="expired" && <span className="text-red-700">✗ Vencido</span>}
                              {p.situation==="open" && <span className="text-blue-700">Em aberto</span>}
                            </span>
                          </div>
                        ))}
                      </div>
                      {a.observacoes && <p className="px-3 py-2 text-xs text-muted-foreground border-t bg-muted/20">📝 {a.observacoes}</p>}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Notificações */}
            {historicoNotif.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notificações enviadas ({historicoNotif.length})</p>
                <div className="rounded-lg border overflow-hidden">
                  {historicoNotif.map((n:any)=>{
                    const cfg=Array.isArray(n.config_notificacoes)?n.config_notificacoes[0]:n.config_notificacoes;
                    const prof=Array.isArray(n.profiles)?n.profiles[0]:n.profiles;
                    const [y,m,d]=(n.enviado_em||"").split("T")[0].split("-");
                    return (
                      <div key={n.id} className="flex items-center gap-3 px-3 py-2.5 border-b last:border-0 text-sm">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{cfg?.label||`Estágio ${n.estagio}`}</span>
                            <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">D+{n.dias_atraso}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">{d}/{m}/{y}{prof?.nome_completo?` · por ${prof.nome_completo}`:""}</p>
                        </div>
                        <span className="text-sm font-medium text-red-600">{fmtV(n.valor_total||0)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {reajusteOpen && (
        <ReajusteModal
          open={reajusteOpen}
          onClose={() => setReajusteOpen(false)}
          onSuccess={() => { setReajusteOpen(false); router.refresh(); }}
          inquilinoId={tenant.id}
          nomeInquilino={tenant.nome_completo}
          valorAtual={tenant.valor_aluguel || 0}
          indiceAtual={(tenant as any).indice_reajuste || "igpm"}
        />
      )}
      {/* Modal mensagem consolidada — T3.3 */}
      <Dialog open={!!msgConsolidada} onOpenChange={() => setMsgConsolidada(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-700">
              <MessageSquare className="h-5 w-5"/>Mensagem consolidada — {tenant.nome_completo}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <pre className="whitespace-pre-wrap text-sm bg-muted rounded-lg p-3 max-h-64 overflow-y-auto">{msgConsolidada}</pre>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => {
                navigator.clipboard.writeText(msgConsolidada||"");
                toast.success("Copiado!");
              }}>
                <Copy className="h-4 w-4 mr-2"/>Copiar
              </Button>
              <a href={`https://wa.me/${(tenant.telefone||"").replace(/\D/g,"").replace(/^0/,"").replace(/^(?!55)/,"55")}?text=${encodeURIComponent(msgConsolidada||"")}`}
                target="_blank" rel="noreferrer" className="flex-1">
                <Button className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white">
                  <ExternalLink className="h-4 w-4 mr-2"/>Enviar WhatsApp
                </Button>
              </a>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal enviar ao advogado — T5.5 */}
      <Dialog open={advogadoOpen} onOpenChange={setAdvogadoOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <Scale className="h-5 w-5"/>Enviar ao advogado
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">O caso de <strong>{tenant.nome_completo}</strong> será registrado como enviado ao advogado.</p>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Observações (opcional)</label>
              <textarea
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] resize-none"
                placeholder="Ex: Dois meses sem pagamento, sem resposta ao WhatsApp..."
                value={advogadoObs}
                onChange={e => setAdvogadoObs(e.target.value)}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setAdvogadoOpen(false)} disabled={enviandoAdvogado}>Cancelar</Button>
              <Button className="bg-red-700 hover:bg-red-800 text-white gap-2" onClick={enviarAdvogado} disabled={enviandoAdvogado}>
                {enviandoAdvogado ? <Loader2 className="h-4 w-4 animate-spin"/> : <Scale className="h-4 w-4"/>}
                Confirmar envio
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal encerramento */}
      {encerrarOpen && (
        <EncerrarContratoModal
          open={encerrarOpen}
          onClose={() => setEncerrarOpen(false)}
          onSuccess={() => { setEncerrarOpen(false); router.push("/dashboard/inquilinos"); }}
          inquilinoId={tenant.id}
          imovelId={tenant.imovel_id}
          nomeInquilino={tenant.nome_completo}
          docInquilino={tenant.cpf||""}
          imovelTitulo={im?.titulo||""}
          imovelEndereco={im?`${im.endereco_rua||""}, ${im.endereco_numero||""}`:""}
          dataInicio={tenant.data_inicio||""}
          comprovantes={historicoPag}
        />
      )}
    </div>
  );
}
