// Based on Lugo — Copyright (c) 2024 Renilson Medeiros — MIT License
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { jsPDF } from "jspdf";

function fmtBRL(v: number) { return (v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"}); }
function fmtD(iso: string|null) { if(!iso)return"—"; const[y,m,d]=iso.split("T")[0].split("-"); return`${d}/${m}/${y}`; }
function mesL(iso: string) {
  const[y,mo]=iso.split("-");
  const M=["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  return`${M[parseInt(mo)-1]}/${y}`;
}
function dataExtenso(d:Date){
  const M=["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
  return`${d.getDate()} de ${M[d.getMonth()]} de ${d.getFullYear()}`;
}

export async function POST(req: NextRequest) {
  try {
    const { inquilino_id } = await req.json();
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const [inqRes, pagsRes, notifsRes, acordosRes, scoreRes, cfgRes] = await Promise.all([
      supabase.from("inquilinos")
        .select("*, imoveis(titulo, endereco_rua, endereco_numero, endereco_bairro, endereco_cidade)")
        .eq("id", inquilino_id).single(),
      supabase.from("comprovantes")
        .select("id, mes_referencia, valor, valor_multa, valor_juros, situation, data_vencimento, data_pagamento, forma_pagamento, receipt_number, receipt_hash")
        .eq("inquilino_id", inquilino_id).order("mes_referencia", { ascending: false }),
      supabase.from("notificacoes_cobranca")
        .select("id, estagio, dias_atraso, valor_total, enviado_em, mes_referencia, config_notificacoes(label)")
        .eq("inquilino_id", inquilino_id).order("enviado_em", { ascending: false }),
      supabase.from("acordos")
        .select("id, valor_original, valor_acordo, num_parcelas, valor_parcela, status, created_at, parcelas_acordo(numero, valor, data_vencimento, situation, data_pagamento)")
        .eq("inquilino_id", inquilino_id).order("created_at", { ascending: false }),
      supabase.from("score_inquilinos").select("*").eq("inquilino_id", inquilino_id).maybeSingle(),
      supabase.from("config_sistema").select("chave,valor").in("chave",["locador_nome","procurador_ativo","procurador_nome"]),
    ]);

    const inq = inqRes.data;
    if (!inq) return NextResponse.json({ error: "Inquilino não encontrado" }, { status: 404 });

    const pags = pagsRes.data || [];
    const notifs = notifsRes.data || [];
    const acordos = acordosRes.data || [];
    const score = scoreRes.data;
    const cfgMap: Record<string,string> = {};
    (cfgRes.data||[]).forEach((r:any)=>{ cfgMap[r.chave]=r.valor||""; });

    const im = Array.isArray(inq.imoveis)?inq.imoveis[0]:inq.imoveis as any;

    const doc = new jsPDF({ unit:"mm", format:"a4" });
    const L=15, R=195, W=R-L;
    let y=15;

    const checkPage = (need=10) => { if(y+need>280){doc.addPage();y=15;} };
    const linha = (cor=[220,220,220]) => { doc.setDrawColor(...cor as [number,number,number]); doc.line(L,y,R,y); y+=1; };
    const secao = (titulo:string) => {
      checkPage(12);
      y+=3;
      doc.setFillColor(240,242,255); doc.rect(L,y-4,W,8,"F");
      doc.setFont("helvetica","bold"); doc.setFontSize(9); doc.setTextColor(30,30,80);
      doc.text(titulo.toUpperCase(), L+2, y); y+=6;
      doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.setTextColor(30,30,30);
    };
    const campo = (label:string, val:string, x2=90) => {
      checkPage(6);
      doc.setFont("helvetica","bold"); doc.setFontSize(8.5); doc.setTextColor(100,100,100);
      doc.text(label, L, y);
      doc.setFont("helvetica","normal"); doc.setTextColor(30,30,30);
      doc.text(val||"—", L+x2-L, y);
      y+=5.5;
    };

    // ── CABEÇALHO ──
    doc.setFillColor(25,25,70); doc.rect(0,0,210,22,"F");
    doc.setFont("helvetica","bold"); doc.setFontSize(14); doc.setTextColor(255,255,255);
    doc.text("Relatório do Inquilino", 105, 10, {align:"center"});
    doc.setFont("helvetica","normal"); doc.setFontSize(8.5); doc.setTextColor(200,200,220);
    doc.text(`Borges Silva Locações · Parnaíba – PI · Gerado em ${dataExtenso(new Date())}`, 105, 17, {align:"center"});
    y=28;

    // ── IDENTIFICAÇÃO ──
    secao("Identificação");
    campo("Nome completo:", inq.nome_completo);
    campo("CPF:", inq.cpf||"");
    campo("Telefone:", inq.telefone||"");
    campo("E-mail:", inq.email||"");
    y+=2;

    // ── LOCAÇÃO ──
    secao("Dados da locação");
    campo("Imóvel:", im?.titulo||"");
    campo("Endereço:", im?`${im.endereco_rua||""}, ${im.endereco_numero||""}`:"");
    campo("Início do contrato:", fmtD(inq.data_inicio));
    campo("Vencimento:", `Dia ${inq.dia_vencimento}`);
    campo("Aluguel:", fmtBRL(inq.valor_aluguel));
    if (inq.valor_condominio) campo("Condomínio:", fmtBRL(inq.valor_condominio));
    campo("Total mensal:", fmtBRL((inq.valor_aluguel||0)+(inq.valor_condominio||0)));
    campo("Garantia:", inq.garantia||"nenhuma");
    campo("Índice reajuste:", (inq.indice_reajuste||"igpm").toUpperCase());
    if (inq.data_ultimo_reajuste) campo("Último reajuste:", fmtD(inq.data_ultimo_reajuste));
    y+=2;

    // ── SCORE ──
    if (score) {
      secao("Score de pontualidade");
      const estrelas = "★".repeat(score.score||0)+"☆".repeat(5-(score.score||0));
      campo("Score:", `${estrelas}  ${score.score_label||""} (${score.pontos}/100 pts)`);
      campo("Meses no histórico:", String(score.total_meses||0));
      campo("Pagos em dia:", String(score.pagos_em_dia||0));
      campo("Vencidos:", String(score.vencidos||0));
      campo("Cobranças enviadas:", String(score.total_notificacoes||0));
      campo("Acordos:", String(score.total_acordos||0));
      y+=2;
    }

    // ── HISTÓRICO FINANCEIRO ──
    secao("Histórico financeiro");
    const pagos = pags.filter(p=>p.situation==="billed").length;
    const vencidos = pags.filter(p=>p.situation==="expired").length;
    const abertos = pags.filter(p=>p.situation==="open").length;
    campo("Total de meses:", `${pags.length}  |  Pagos: ${pagos}  |  Vencidos: ${vencidos}  |  Em aberto: ${abertos}`);
    y+=2;

    // Tabela pagamentos
    if (pags.length > 0) {
      checkPage(12);
      doc.setFillColor(245,245,250); doc.rect(L,y-3,W,7,"F");
      doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.setTextColor(80,80,80);
      doc.text("Referência", L+1, y);
      doc.text("Vencimento", L+28, y);
      doc.text("Valor", L+60, y);
      doc.text("Encargos", L+85, y);
      doc.text("Status", L+115, y);
      doc.text("Pagamento", L+142, y);
      doc.text("Recibo", L+165, y);
      y+=5; linha();

      const statusMap:Record<string,{label:string,r:number,g:number,b:number}> = {
        billed:{label:"Pago",r:34,g:120,b:34},
        expired:{label:"Vencido",r:180,g:30,b:30},
        open:{label:"Em aberto",r:30,g:80,b:180},
      };

      for (const p of pags) {
        checkPage(6);
        const enc=(p.valor_multa||0)+(p.valor_juros||0);
        const st = statusMap[p.situation]||{label:p.situation,r:80,g:80,b:80};
        doc.setFont("helvetica","normal"); doc.setFontSize(8); doc.setTextColor(30,30,30);
        doc.text(mesL(p.mes_referencia), L+1, y);
        doc.text(fmtD(p.data_vencimento), L+28, y);
        doc.text(fmtBRL(p.valor||0), L+60, y);
        doc.text(enc>0?fmtBRL(enc):"—", L+85, y);
        doc.setTextColor(st.r,st.g,st.b); doc.setFont("helvetica","bold");
        doc.text(st.label, L+115, y);
        doc.setFont("helvetica","normal"); doc.setTextColor(30,30,30);
        doc.text(p.data_pagamento?fmtD(p.data_pagamento):"—", L+142, y);
        doc.text(p.receipt_number||"—", L+165, y);
        y+=5.5;
        if (pags.indexOf(p)%2===1) { doc.setFillColor(249,249,252); doc.rect(L,y-5.5,W,5.5,"F"); }
      }
      y+=2;
    }

    // ── ACORDOS ──
    if (acordos.length > 0) {
      secao(`Acordos (${acordos.length})`);
      for (const a of acordos) {
        checkPage(14);
        const statusA = a.status==="cumprido"?"Cumprido":a.status==="quebrado"?"Quebrado":"Em andamento";
        const pagas=(a.parcelas_acordo||[]).filter((p:any)=>p.situation==="billed").length;
        doc.setFont("helvetica","bold"); doc.setFontSize(8.5); doc.setTextColor(30,30,80);
        doc.text(`${fmtBRL(a.valor_acordo)} em ${a.num_parcelas}x de ${fmtBRL(a.valor_parcela)}  ·  ${statusA}  ·  ${pagas}/${a.num_parcelas} pagas`, L, y);
        y+=5;
        for (const p of (a.parcelas_acordo||[]).sort((x:any,z:any)=>x.numero-z.numero)) {
          checkPage(5);
          const stP = p.situation==="billed"?"✓ Pago":p.situation==="expired"?"✗ Vencido":"Em aberto";
          doc.setFont("helvetica","normal"); doc.setFontSize(8); doc.setTextColor(60,60,60);
          doc.text(`  Parcela ${p.numero}: ${fmtBRL(p.valor)}  ·  Venc. ${fmtD(p.data_vencimento)}  ·  ${stP}${p.data_pagamento?` em ${fmtD(p.data_pagamento)}`:""}`, L, y);
          y+=5;
        }
        y+=2;
      }
    }

    // ── NOTIFICAÇÕES ──
    if (notifs.length > 0) {
      secao(`Cobranças enviadas (${notifs.length})`);
      for (const n of notifs) {
        checkPage(6);
        const cfg=Array.isArray(n.config_notificacoes)?n.config_notificacoes[0]:n.config_notificacoes as any;
        doc.setFont("helvetica","normal"); doc.setFontSize(8.5); doc.setTextColor(30,30,30);
        doc.text(`${fmtD(n.enviado_em||"")}  ·  ${cfg?.label||`Estágio ${n.estagio}`}  ·  D+${n.dias_atraso}  ·  ${fmtBRL(n.valor_total||0)}  ·  Ref: ${mesL(n.mes_referencia)}`, L, y);
        y+=5.5;
      }
      y+=2;
    }

    // ── RODAPÉ ──
    const pages = doc.getNumberOfPages();
    for (let i=1;i<=pages;i++) {
      doc.setPage(i);
      doc.setFillColor(240,240,245); doc.rect(0,285,210,12,"F");
      doc.setFont("helvetica","normal"); doc.setFontSize(7.5); doc.setTextColor(120,120,120);
      doc.text(`${cfgMap.locador_nome||"Borges Silva Locações"}  ·  Parnaíba – PI`, 105, 290, {align:"center"});
      doc.text(`Página ${i}/${pages}`, 195, 290, {align:"right"});
    }

    const buffer = Buffer.from(doc.output("arraybuffer"));
    const safeName = inq.nome_completo.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9]/g,"-").toLowerCase();
    const fileName = `${session.user.id}/relatorios/inquilino-${safeName}-${Date.now()}.pdf`;
    await supabase.storage.from("imoveis-fotos").upload(fileName, buffer, {contentType:"application/pdf"});
    const { data: urlData } = supabase.storage.from("imoveis-fotos").getPublicUrl(fileName);

    return NextResponse.json({ success: true, pdfUrl: urlData.publicUrl });
  } catch (err:any) {
    console.error("Relatório inquilino:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
