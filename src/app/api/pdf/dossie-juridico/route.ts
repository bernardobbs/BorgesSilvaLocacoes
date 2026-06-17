// Based on Lugo — Copyright (c) 2024 Renilson Medeiros — MIT License
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import jsPDF from "jspdf";

export const dynamic = "force-dynamic";

function fmtBRL(v: number) { return (v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"}); }
function fmtData(iso:string|null) { if(!iso)return"—"; const[y,m,d]=iso.split("-"); return`${d}/${m}/${y}`; }
function mesLabel(iso:string) { const[y,mo]=iso.split("-"); const M=["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"]; return`${M[parseInt(mo)-1]}/${y}`; }
function dataExtenso(d:Date) { const M=["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"]; return`${d.getDate()} de ${M[d.getMonth()]} de ${d.getFullYear()}`; }

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll:()=>cookieStore.getAll(), setAll:(c)=>c.forEach(({name,value,options})=>cookieStore.set(name,value,options)) } }
    );
    const { data:{ user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error:"Não autorizado" },{status:401});

    const { inquilino_id } = await request.json();

    // Buscar todos os dados do inquilino
    const [inqRes, compRes, notifRes, acordoRes, configRes] = await Promise.all([
      supabase.from("inquilinos").select(`
        *, imoveis(titulo, endereco_rua, endereco_numero, endereco_bairro, endereco_cidade, endereco_estado)
      `).eq("id", inquilino_id).single(),
      supabase.from("comprovantes").select("*").eq("inquilino_id", inquilino_id).order("mes_referencia"),
      supabase.from("notificacoes_cobranca").select("*, profiles(nome_completo), config_notificacoes(label)").eq("inquilino_id", inquilino_id).order("enviado_em"),
      supabase.from("acordos").select("*, parcelas_acordo(*)").eq("inquilino_id", inquilino_id).order("created_at"),
      supabase.from("config_sistema").select("chave, valor").in("chave", ["locador_nome","locador_cpf_cnpj","locador_endereco","locador_telefone","locador_email"]),
    ]);

    const inq = inqRes.data;
    if (!inq) return NextResponse.json({ error:"Inquilino não encontrado" },{status:404});
    const im = Array.isArray(inq.imoveis) ? inq.imoveis[0] : inq.imoveis;

    // Montar config do locador
    const cfgMap: Record<string,string> = {};
    (configRes.data||[]).forEach((r:any) => { cfgMap[r.chave] = r.valor||""; });
    const locadorNome  = (im as any)?.locador_nome      || cfgMap.locador_nome      || "Borges Silva Locações";
    const locadorDoc   = (im as any)?.locador_cpf_cnpj  || cfgMap.locador_cpf_cnpj  || "";
    const locadorEnd   = cfgMap.locador_endereco || "Campo Maior – PI";
    const locadorTel   = (im as any)?.locador_telefone   || cfgMap.locador_telefone  || "";
    const locadorEmail = cfgMap.locador_email   || "";

    const comps = compRes.data || [];
    const notifs = notifRes.data || [];
    const acordos = acordoRes.data || [];

    const hoje = new Date();
    const doc = new jsPDF();
    const L = 20, R = 190, W = R - L;
    let y=20;

    const linha = (cor=[200,200,200]) => { doc.setDrawColor(...cor as [number,number,number]); doc.line(L,y,R,y); };
    const secao = (titulo:string, cor=[11,107,114]) => {
      doc.setFont("helvetica","bold"); doc.setFontSize(10); doc.setTextColor(...cor as [number,number,number]);
      doc.text(titulo,L,y); y+=4; linha(); y+=7;
    };
    const campo = (label:string, valor:string, xL=L, xV=55, w=135) => {
      doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.setTextColor(100,100,100);
      doc.text(label,xL,y);
      doc.setFont("helvetica","bold"); doc.setTextColor(30,30,30);
      const lines = doc.splitTextToSize(valor||"—", w);
      doc.text(lines,xV,y); y+=lines.length*5.5;
    };
    const checkPage = () => { if (y > 268) { doc.addPage(); y=20; } };

    // ── CAPA ────────────────────────────────────────
    doc.setFillColor(11,107,114);
    doc.rect(0,0,210,50,"F");
    doc.setFont("helvetica","bold"); doc.setFontSize(18); doc.setTextColor(255,255,255);
    doc.text("DOSSIÊ JURÍDICO",105,18,{align:"center"});
    doc.setFontSize(11);
    doc.text("Ação de Cobrança / Despejo por Falta de Pagamento",105,28,{align:"center"});
    doc.setFont("helvetica","normal"); doc.setFontSize(9);
    doc.text("Borges Silva Locações  ·  Campo Maior – PI",105,37,{align:"center"});
    doc.text(`Emitido em: ${dataExtenso(hoje)}`,105,44,{align:"center"});
    y=60;

    // ── PARTE LOCADORA ────────────────────────────────
    secao("1. PARTE LOCADORA (REQUERENTE)");
    campo("Nome/Razão:", locadorNome);
    if(locadorDoc) campo("CPF/CNPJ:", locadorDoc);
    campo("Endereço:", locadorEnd);
    if(locadorTel) campo("Telefone:", locadorTel);
    if(locadorEmail) campo("Contato:", locadorEmail);
    y+=4; checkPage();

    // ── PARTE LOCATÁRIA ───────────────────────────────
    secao("2. PARTE LOCATÁRIA (REQUERIDA)");
    campo("Nome:", inq.nome_completo);
    if (inq.tipo_pessoa === "juridica") {
      campo("Razão social:", inq.razao_social||"");
      campo("CNPJ:", inq.cnpj||"");
    } else {
      campo("CPF:", inq.cpf||""); campo("RG:", inq.rg||"");
    }
    campo("Telefone:", inq.telefone||""); campo("E-mail:", inq.email||"");
    y+=4; checkPage();

    // ── IMÓVEL ────────────────────────────────────────
    secao("3. IMÓVEL LOCADO");
    campo("Imóvel:", im?.titulo||"");
    campo("Endereço:", im ? `${im.endereco_rua||""}, ${im.endereco_numero||""}, ${im.endereco_bairro||""}, ${im.endereco_cidade||""}–${im.endereco_estado||""}` : "");
    campo("Início:", fmtData(inq.data_inicio));
    campo("Saída:", fmtData(inq.data_desocupacao));
    campo("Motivo:", ({cumprimento:"Cumprimento",desocupacao_voluntaria:"Desocupação voluntária",despejo:"Despejo",acordo:"Acordo",outros:"Outros"})[inq.motivo_encerramento as string]||inq.motivo_encerramento||"");
    campo("Aluguel:", fmtBRL(inq.valor_aluguel)+` (dia ${inq.dia_vencimento})`);
    campo("Garantia:", inq.garantia||"nenhuma");
    campo("Contrato:", inq.numero_contrato||"não informado");
    y+=4; checkPage();

    // ── GARANTIA DETALHES ─────────────────────────────
    if (inq.garantia === "fiador" && inq.fiador_nome) {
      secao("3.1 DADOS DO FIADOR");
      campo("Nome:", inq.fiador_nome||""); campo("CPF:", inq.fiador_cpf||"");
      campo("Telefone:", inq.fiador_telefone||""); campo("Endereço:", inq.fiador_endereco||"");
      y+=4; checkPage();
    }

    // ── DEMONSTRATIVO FINANCEIRO ──────────────────────
    secao("4. DEMONSTRATIVO FINANCEIRO");
    doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.setTextColor(100,100,100);
    doc.text("Referência",L,y); doc.text("Vencimento",65,y); doc.text("Base",95,y);
    doc.text("Encargos",120,y); doc.text("Total",150,y); doc.text("Status",172,y);
    y+=4; linha(); y+=5;

    let totalPago=0, totalDevido=0;
    comps.forEach((c:any) => {
      checkPage();
      const base=c.valor||0, enc=(c.valor_multa||0)+(c.valor_juros||0), total=base+enc;
      const pago=c.situation==="billed";
      if(pago) totalPago+=total; else totalDevido+=total;
      doc.setFont("helvetica","normal"); doc.setFontSize(7.5);
      doc.setTextColor(pago?80:180, pago?80:0, pago?80:0);
      doc.text(mesLabel(c.mes_referencia),L,y);
      doc.text(fmtData(c.data_vencimento),65,y);
      doc.text(fmtBRL(base),95,y); doc.text(enc>0?fmtBRL(enc):"—",120,y);
      doc.text(fmtBRL(total),150,y);
      doc.text(pago?"PAGO":"DEVENDO",172,y); y+=5.5;
    });

    y+=3; linha(); y+=6;
    doc.setFont("helvetica","bold"); doc.setFontSize(10);
    doc.setTextColor(30,30,30); doc.text("Total pago:",L,y);
    doc.setTextColor(30,120,60); doc.text(fmtBRL(totalPago),R,y,{align:"right"}); y+=7;
    doc.setTextColor(30,30,30); doc.text("Total em aberto (c/ encargos):",L,y);
    doc.setFont("helvetica","bold"); doc.setTextColor(180,0,0);
    doc.text(fmtBRL(totalDevido),R,y,{align:"right"});
    // Atualizar divida_residual com valor calculado
    if (totalDevido !== inq.divida_residual) {
      await supabase.from("inquilinos")
        .update({ divida_residual: totalDevido })
        .eq("id", inquilino_id);
    }
    y+=12; checkPage();

    // ── ACORDOS ───────────────────────────────────────
    if (acordos.length > 0) {
      secao("5. HISTÓRICO DE ACORDOS");
      acordos.forEach((a:any,i:number) => {
        checkPage();
        doc.setFont("helvetica","bold"); doc.setFontSize(9); doc.setTextColor(30,30,30);
        doc.text(`Acordo ${i+1}: ${fmtBRL(a.valor_acordo)} em ${a.num_parcelas}x — Status: ${a.status.toUpperCase()}`,L,y); y+=5;
        if(a.desconto>0){ doc.setFont("helvetica","normal"); doc.setFontSize(8); doc.setTextColor(80,80,80); doc.text(`Desconto concedido: ${fmtBRL(a.desconto)}`,L+5,y); y+=5; }
        if(a.observacoes){ doc.setFont("helvetica","italic"); doc.setFontSize(8); doc.setTextColor(100,100,100); const ol=doc.splitTextToSize(`Obs: ${a.observacoes}`,W-5); doc.text(ol,L+5,y); y+=ol.length*4.5; }
        y+=3;
      });
      y+=4; checkPage();
    }

    // ── NOTIFICAÇÕES ENVIADAS ─────────────────────────
    if (notifs.length > 0) {
      secao("6. HISTÓRICO DE NOTIFICAÇÕES");
      doc.setFont("helvetica","italic"); doc.setFontSize(8); doc.setTextColor(80,80,80);
      doc.text("Comprovante das tentativas de cobrança extrajudicial realizadas antes da ação judicial.",L,y); y+=8;

      notifs.forEach((n:any) => {
        checkPage();
        const cfg = Array.isArray(n.config_notificacoes)?n.config_notificacoes[0]:n.config_notificacoes;
        const prof = Array.isArray(n.profiles)?n.profiles[0]:n.profiles;
        doc.setFont("helvetica","normal"); doc.setFontSize(8); doc.setTextColor(40,40,40);
        doc.text(`• ${fmtData(n.enviado_em?.split("T")[0]||"")} — ${cfg?.label||`Estágio ${n.estagio}`} (D+${n.dias_atraso}) — ${fmtBRL(n.valor_total)} — por ${prof?.nome_completo||"sistema"}`,L+2,y); y+=5.5;
      });
      y+=4; checkPage();
    }

    // ── FUNDAMENTAÇÃO LEGAL ───────────────────────────
    secao("7. FUNDAMENTAÇÃO LEGAL");
    doc.setFont("helvetica","normal"); doc.setFontSize(8.5); doc.setTextColor(40,40,40);
    const fundamentos = [
      "Art. 9º, III, Lei 8.245/91 — rescisão por falta de pagamento;",
      "Art. 62, II, Lei 8.245/91 — ação de despejo por falta de pagamento;",
      "Art. 916, CPC — execução de obrigação de pagar quantia certa;",
      "Cláusulas contratuais de multa e juros moratórios pactuadas.",
    ];
    fundamentos.forEach(f => { doc.text(`• ${f}`,L+2,y); y+=5.5; });
    y+=6; checkPage();

    // ── OBSERVAÇÕES ────────────────────────────────────
    if (inq.obs_encerramento) {
      secao("8. OBSERVAÇÕES DO ENCERRAMENTO");
      doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.setTextColor(60,60,60);
      const ol=doc.splitTextToSize(inq.obs_encerramento,W); doc.text(ol,L,y); y+=ol.length*5.5+8; checkPage();
    }


    // Buscar configuração do procurador
    const { data: cfgData } = await supabase.from("config_sistema")
      .select("chave, valor")
      .in("chave", ["locador_nome","locador_cpf_cnpj","procurador_ativo","procurador_nome","procurador_cpf"]);
    const cfgMap2: Record<string,string> = {};
    (cfgData||[]).forEach((r:any) => { cfgMap2[r.chave] = r.valor||""; });
    const temProc = cfgMap2.procurador_ativo === "true" && !!cfgMap2.procurador_nome;
    const nomeProprietario = cfgMap2.locador_nome || locadorNome || "Borges Silva Locações";
    const cpfProprietario  = cfgMap2.locador_cpf_cnpj || locadorDoc || "";
    const nomeProcurador   = cfgMap2.procurador_nome || "";
    const cpfProcurador    = cfgMap2.procurador_cpf  || "";
    // ── ASSINATURA ────────────────────────────────────
    y+=8; linha();
    doc.line(55,y+15,155,y+15); y+=22;
    doc.setFont("helvetica","bold"); doc.setFontSize(9); doc.setTextColor(30,30,30);
    doc.text(nomeProprietario,105,y,{align:"center"});
    if (cpfProprietario) {
      doc.setFont("helvetica","normal"); doc.setFontSize(8); doc.setTextColor(100,100,100);
      doc.text(`CPF: ${cpfProprietario}`,105,y+4,{align:"center"}); y+=4;
    }
    if (temProc) {
      y+=5;
      doc.setFont("helvetica","normal"); doc.setFontSize(8); doc.setTextColor(80,80,80);
      doc.text(`Representado(a) por: ${nomeProcurador}${cpfProcurador ? ` — CPF: ${cpfProcurador}`:""  }`,105,y,{align:"center"}); y+=4;
      doc.text("Procuração particular",105,y,{align:"center"}); y+=2;
    }
    y+=4;
    doc.setFont("helvetica","normal"); doc.setFontSize(8); doc.setTextColor(100,100,100);
    doc.text("Locador(a) / Representante Legal",105,y,{align:"center"});
    doc.setFontSize(7); doc.setTextColor(160,160,160);
    doc.text(`Gerado em ${dataExtenso(hoje)} · ${locadorNome}`,105,287,{align:"center"});

    // ── UPLOAD ────────────────────────────────────────
    const safe = inq.nome_completo.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9-_]/g,"-").replace(/-+/g,"-").toLowerCase();
    const fileName = `${user.id}/${inq.imovel_id}/juridico/${Date.now()}-dossie-${safe}.pdf`;


    const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
    const { error:ue } = await supabase.storage.from("documentos").upload(fileName,pdfBuffer,{contentType:"application/pdf"});
    if(ue) throw ue;
    const { data: signed } = await supabase.storage.from("documentos").createSignedUrl(fileName, 60*60*24*7);
    const publicUrl = signed?.signedUrl || "";

    return NextResponse.json({ success:true, pdfUrl:publicUrl });
  } catch(e:any) {
    return NextResponse.json({ error:e.message },{status:500});
  }
}
