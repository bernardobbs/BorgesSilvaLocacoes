// Based on Lugo — Copyright (c) 2024 Renilson Medeiros — MIT License
"use client";
import { useMemo } from "react";
import NotificacoesCobranca from "@/components/dashboard/NotificacoesCobranca";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Bell, Building2, Handshake, MessageCircle, TrendingUp } from "lucide-react";

/* helpers */
function fmtBRL(v: number) { return (v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"}); }
function fmtData(iso:string|null){if(!iso)return"—";const[y,m,d]=iso.split("-");return`${d}/${m}/${y}`;}
function phoneWA(tel:string){const d=tel.replace(/\D/g,"").replace(/^0/,"55");return d.startsWith("55")?d:"55"+d;}

interface Props {
  userId: string;
  inquilinos: any[];
  compMes: any[];
  imoveis: any[];
  acordos: any[];
  notificacoes: any[];
}

export default function NovoDashboard({ inquilinos, compMes, imoveis, acordos, notificacoes }: Props) {
  const hoje = new Date();

  /* ── Financeiro do mês ── */
  const financeiro = useMemo(() => {
    let recebido = 0, aberto = 0, inadimplente = 0;
    const totalMensal = inquilinos.reduce((s,i)=>s+(i.valor_aluguel||0), 0);

    compMes.forEach((c:any) => {
      const t = (c.valor||0)+(c.valor_multa||0)+(c.valor_juros||0);
      if (c.situation === "billed") recebido += c.valor||0;
      else if (c.situation === "expired") inadimplente += t;
      else aberto += c.valor||0;
    });
    return { totalMensal, recebido, aberto, inadimplente };
  }, [inquilinos, compMes]);

  /* ── Inadimplentes ── */
  const inadimplentes = useMemo(() => {
    return compMes
      .filter((c:any) => c.situation === "expired")
      .map((c:any) => {
        const inq = inquilinos.find(i=>i.id===c.inquilino_id);
        if (!inq) return null;
        const im = Array.isArray(inq.imoveis)?inq.imoveis[0]:inq.imoveis;
        const [vy,vm,vd] = (c.data_vencimento||"").split("-").map(Number);
        const venc = new Date(vy,vm-1,vd);
        const dias = Math.max(0, Math.floor((hoje.getTime()-venc.getTime())/86400000));
        const multa = inq.valor_aluguel*(inq.multa_percentual/100);
        const juros = inq.valor_aluguel*(inq.juros_percentual/100/30)*dias;
        const total = inq.valor_aluguel+multa+juros;
        const msg = encodeURIComponent(
          `Olá, *${inq.nome_completo}*!\n\nO aluguel de *${im?.titulo||""}* está em aberto há *${dias} dias*.\n\n• Aluguel: ${fmtBRL(inq.valor_aluguel)}\n• Multa: ${fmtBRL(multa)}\n• Juros: ${fmtBRL(juros)}\n💰 Total: *${fmtBRL(total)}*\n\n*Borges Silva Locações*`
        );
        return { inq, im, dias, total, msg };
      })
      .filter(Boolean)
      .sort((a:any,b:any)=>b.dias-a.dias);
  }, [compMes, inquilinos, hoje]);

  /* ── Ocupação ── */
  const ocupacao = useMemo(() => {
    const total = imoveis.length;
    const alugados = imoveis.filter(i=>i.status==="alugado").length;
    const center = imoveis.filter(i=>i.do_center);
    const resid = imoveis.filter(i=>!i.do_center);
    const centerAlug = center.filter(i=>i.status==="alugado").length;
    const residAlug = resid.filter(i=>i.status==="alugado").length;
    const disponiveis = imoveis.filter(i=>i.status==="disponivel");
    return { total, alugados, center: center.length, centerAlug, resid: resid.length, residAlug, disponiveis };
  }, [imoveis]);

  /* ── Próximos vencimentos (7 dias) ── */
  const proximos = useMemo(() => {
    const items: any[] = [];
    const limite = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()+7);

    inquilinos.forEach(inq => {
      const im = Array.isArray(inq.imoveis)?inq.imoveis[0]:inq.imoveis;
      const venc = new Date(hoje.getFullYear(), hoje.getMonth(), inq.dia_vencimento);
      if (venc >= hoje && venc <= limite) {
        const comp = compMes.find(c=>c.inquilino_id===inq.id);
        if (!comp || comp.situation !== "billed") {
          const dias = Math.floor((venc.getTime()-hoje.getTime())/86400000);
          items.push({ inq, im, venc, dias, tipo:"aluguel", valor:inq.valor_aluguel });
        }
      }
    });

    // Parcelas de acordo
    acordos.forEach((a:any) => {
      const inq2 = Array.isArray(a.inquilinos)?a.inquilinos[0]:a.inquilinos;
      const im2 = Array.isArray(inq2?.imoveis)?inq2.imoveis[0]:inq2?.imoveis;
      (a.parcelas_acordo||[]).forEach((p:any) => {
        if (p.situation==="billed") return;
        const [py,pm,pd] = p.data_vencimento.split("-").map(Number);
        const venc = new Date(py,pm-1,pd);
        if (venc >= hoje && venc <= limite) {
          const dias = Math.floor((venc.getTime()-hoje.getTime())/86400000);
          items.push({ inq:inq2, im:im2, venc, dias, tipo:"acordo", valor:p.valor, parcela:p, acordo:a });
        }
      });
    });

    return items.sort((a,b)=>a.venc.getTime()-b.venc.getTime()).slice(0,6);
  }, [inquilinos, compMes, acordos, hoje]);

  /* ── Notificações pendentes ── */
  const notifPendentes = useMemo(() =>
    notificacoes.filter((n:any) => !n.ja_enviado && n.anterior_enviado),
  [notificacoes]);

  /* ── Próximas parcelas de acordo ── */
  const proximasAcordo = useMemo(() => {
    const items: any[] = [];
    acordos.forEach((a:any) => {
      const inq = Array.isArray(a.inquilinos)?a.inquilinos[0]:a.inquilinos;
      const proxParcela = (a.parcelas_acordo||[])
        .filter((p:any)=>p.situation!=="billed")
        .sort((x:any,y:any)=>x.numero-y.numero)[0];
      if (proxParcela) items.push({ a, inq, p: proxParcela });
    });
    return items;
  }, [acordos]);

  const pct = (a:number, b:number) => b===0 ? 0 : Math.round(a/b*100);

  return (
    <div className="space-y-5">
      {/* ── DATA ── */}
      <p className="text-sm text-muted-foreground">
        {hoje.toLocaleDateString("pt-BR", { weekday:"long", day:"numeric", month:"long", year:"numeric" })}
      </p>

      {/* ── MÉTRICAS ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label:"Total a receber", val:fmtBRL(financeiro.totalMensal), sub:`${inquilinos.length} contratos ativos`, cls:"" },
          { label:"Recebido", val:fmtBRL(financeiro.recebido), sub:`${pct(financeiro.recebido,financeiro.totalMensal)}% do mês`, cls:"text-green-600 dark:text-green-400" },
          { label:"A vencer", val:fmtBRL(financeiro.aberto), sub:"em aberto", cls:"text-yellow-600 dark:text-yellow-400" },
          { label:"Inadimplente", val:fmtBRL(financeiro.inadimplente), sub:`${inadimplentes.length} inquilino${inadimplentes.length!==1?"s":""}`, cls:"text-red-600 dark:text-red-400" },
        ].map(({label,val,sub,cls})=>(
          <div key={label} className="bg-muted rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className={`text-xl font-medium ${cls}`}>{val}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {/* ── INADIMPLÊNCIA ── */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              <span className="flex items-center gap-2"><AlertCircle className="h-4 w-4 text-red-500"/>Inadimplência</span>
              {inadimplentes.length > 0 && <Badge className="bg-red-100 text-red-700 border-red-200">{inadimplentes.length} vencido{inadimplentes.length!==1?"s":""}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {inadimplentes.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-green-600 flex flex-col items-center gap-1">
                <TrendingUp className="h-6 w-6"/>Nenhum inadimplente este mês
              </div>
            ) : (
              <>
                {inadimplentes.map((item:any)=>(
                  <div key={item.inq.id} className="flex items-center gap-3 px-4 py-3 border-b last:border-0" style={{borderLeft:"3px solid #EF4444"}}>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{item.inq.nome_completo}</p>
                      <p className="text-xs text-muted-foreground truncate">{item.im?.titulo} · D+{item.dias}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-medium text-red-600">{fmtBRL(item.total)}</p>
                      <p className="text-xs text-muted-foreground">c/ encargos</p>
                    </div>
                    <a href={`https://wa.me/${phoneWA(item.inq.telefone)}?text=${item.msg}`} target="_blank" rel="noreferrer">
                      <Button size="sm" className="bg-[#25D366] hover:bg-[#128C7E] text-white px-2 shrink-0">
                        <MessageCircle className="h-3.5 w-3.5"/>
                      </Button>
                    </a>
                  </div>
                ))}
                <div className="px-4 py-2.5 border-t">
                  <Link href="/dashboard/pagamentos">
                    <Button variant="outline" size="sm" className="w-full text-xs">Ver tela de pagamentos →</Button>
                  </Link>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* ── OCUPAÇÃO ── */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Building2 className="h-4 w-4 text-green-600"/>Ocupação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Total</span>
                <span className="font-medium">{ocupacao.alugados} / {ocupacao.total} imóveis</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full" style={{width:`${pct(ocupacao.alugados,ocupacao.total)}%`}}/>
              </div>
              <p className="text-xs text-muted-foreground text-right mt-0.5">{pct(ocupacao.alugados,ocupacao.total)}% ocupado</p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Center Lila</p>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-1">
                  <div className="h-full bg-teal-500 rounded-full" style={{width:`${pct(ocupacao.centerAlug,ocupacao.center)}%`}}/>
                </div>
                <p className="text-xs">{ocupacao.centerAlug}/{ocupacao.center} — {pct(ocupacao.centerAlug,ocupacao.center)}%</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Residenciais</p>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-1">
                  <div className="h-full bg-yellow-500 rounded-full" style={{width:`${pct(ocupacao.residAlug,ocupacao.resid)}%`}}/>
                </div>
                <p className="text-xs">{ocupacao.residAlug}/{ocupacao.resid} — {pct(ocupacao.residAlug,ocupacao.resid)}%</p>
              </div>
            </div>
            {ocupacao.disponiveis.length > 0 && (
              <div className="bg-muted/50 rounded-lg p-2.5">
                <p className="text-xs font-medium text-muted-foreground mb-1.5">{ocupacao.disponiveis.length} disponível{ocupacao.disponiveis.length!==1?"is":""}</p>
                <div className="space-y-1">
                  {ocupacao.disponiveis.map((im:any)=>(
                    <Link key={im.id} href={`/dashboard/imoveis/${im.id}`} className="flex items-center justify-between text-xs hover:text-primary">
                      <span>{im.titulo||im.numero_unidade||`${im.endereco_rua}, ${im.endereco_numero}`}</span>
                      <span className="text-muted-foreground">→</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {/* ── PRÓXIMOS VENCIMENTOS ── */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Bell className="h-4 w-4 text-yellow-500"/>Vencimentos — próximos 7 dias
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {proximos.length === 0 ? (
              <p className="px-4 py-6 text-sm text-center text-muted-foreground">Nenhum vencimento nos próximos 7 dias.</p>
            ) : proximos.map((item:any,i:number)=>{
              const isHoje = item.dias === 0;
              return (
                <div key={i} className="flex items-center gap-3 px-4 py-3 border-b last:border-0">
                  <div className={`text-xl font-medium w-8 text-center shrink-0 ${isHoje?"text-red-600":"text-muted-foreground"}`}>
                    {item.venc.getDate()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{item.inq?.nome_completo}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {item.im?.titulo}
                      {item.tipo==="acordo" && <span className="ml-1 text-blue-600">· acordo {item.parcela?.numero}/{item.acordo?.num_parcelas}</span>}
                    </p>
                  </div>
                  <Badge variant="outline" className={isHoje?"text-red-700 border-red-200 bg-red-50":"text-blue-700 border-blue-200 bg-blue-50"}>
                    {isHoje?"Hoje":`${item.dias}d`}
                  </Badge>
                  <span className="text-sm font-medium shrink-0">{fmtBRL(item.valor)}</span>
                </div>
              );
            })}
            <div className="px-4 py-2.5 border-t">
              <Link href="/dashboard/pagamentos">
                <Button variant="outline" size="sm" className="w-full text-xs">Ver calendário de pagamentos →</Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* ── NOTIFICAÇÕES + ACORDOS ── */}
        <div className="space-y-4">
          <NotificacoesCobranca notificacoes={notificacoes} compact={true} />

          {proximasAcordo.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Handshake className="h-4 w-4 text-blue-500"/>Acordos em andamento
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {proximasAcordo.map(({a,inq,p}:any)=>{
                  const [py,pm,pd] = p.data_vencimento.split("-").map(Number);
                  const venc = new Date(py,pm-1,pd);
                  const dias = Math.floor((venc.getTime()-hoje.getTime())/86400000);
                  return (
                    <div key={a.id} className="flex items-center gap-3 px-4 py-3 border-b last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{inq?.nome_completo}</p>
                        <p className="text-xs text-muted-foreground">
                          Parcela {p.numero}/{a.num_parcelas} · vence {fmtData(p.data_vencimento)}
                        </p>
                      </div>
                      <Badge variant="outline" className={dias<=0?"text-red-700 border-red-200 bg-red-50":"text-blue-700 border-blue-200 bg-blue-50"}>
                        {dias<=0?"Hoje":`${dias}d`}
                      </Badge>
                      <span className="text-sm font-medium shrink-0">{fmtBRL(p.valor)}</span>
                    </div>
                  );
                })}
                <div className="px-4 py-2.5 border-t">
                  <Link href="/dashboard/acordos">
                    <Button variant="outline" size="sm" className="w-full text-xs">Ver acordos →</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
