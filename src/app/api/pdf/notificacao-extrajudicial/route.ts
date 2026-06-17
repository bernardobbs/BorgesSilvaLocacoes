// Based on Lugo — Copyright (c) 2024 Renilson Medeiros — MIT License
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import jsPDF from "jspdf";

export const dynamic = "force-dynamic";

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function dataExtenso(d: Date) {
  const meses = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
  return `${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`;
}

function prazo30dias(d: Date) {
  const p = new Date(d);
  p.setDate(p.getDate() + 30);
  return dataExtenso(p);
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: (c) => c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const {
      inquilino_id, imovel_id,
      nome_inquilino, doc_inquilino, // CPF ou CNPJ
      imovel_titulo, imovel_endereco,
      meses_divida,      // [{mes, valor}]
      valor_total,
      dias_atraso,
    } = await request.json();

    const hoje = new Date();
    const doc = new jsPDF();
    const L = 20, R = 190, W = R - L;
    let y = 20;

    const linha = (yPos: number) => {
      doc.setDrawColor(200,200,200);
      doc.line(L, yPos, R, yPos);
    };

    // ── CABEÇALHO ─────────────────────────────────────
    doc.setFillColor(11, 107, 114); // teal
    doc.rect(0, 0, 210, 35, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(255,255,255);
    doc.text("NOTIFICAÇÃO EXTRAJUDICIAL", 105, 15, { align: "center" });
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Borges Silva Locações", 105, 23, { align: "center" });
    doc.text(`Campo Maior – PI  ·  ${hoje.toLocaleDateString("pt-BR")}`, 105, 29, { align: "center" });

    y = 48;

    // ── IDENTIFICAÇÃO ─────────────────────────────────
    doc.setFont("helvetica","bold");
    doc.setFontSize(10);
    doc.setTextColor(11,107,114);
    doc.text("NOTIFICADO", L, y);
    y += 5;
    linha(y); y += 6;

    const col = (label: string, value: string, xL: number, xV: number, yy: number) => {
      doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.setTextColor(120,120,120);
      doc.text(label, xL, yy);
      doc.setTextColor(30,30,30); doc.setFont("helvetica","bold");
      doc.text(value, xV, yy);
    };

    col("Nome:", nome_inquilino, L, 40, y); y += 6;
    col("CPF/CNPJ:", doc_inquilino || "não informado", L, 40, y); y += 6;
    col("Imóvel:", imovel_titulo, L, 40, y); y += 6;

    const endLines = doc.splitTextToSize(imovel_endereco || "não informado", 140);
    doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.setTextColor(120,120,120);
    doc.text("Endereço:", L, y);
    doc.setTextColor(30,30,30); doc.setFont("helvetica","bold");
    doc.text(endLines, 40, y);
    y += endLines.length * 6 + 4;

    linha(y); y += 10;

    // ── DEMONSTRATIVO DA DÍVIDA ──────────────────────
    doc.setFont("helvetica","bold"); doc.setFontSize(10); doc.setTextColor(11,107,114);
    doc.text("DEMONSTRATIVO DA DÍVIDA", L, y); y += 5;
    linha(y); y += 6;

    doc.setFontSize(9);
    meses_divida?.forEach((m: {mes:string; valor:number}) => {
      doc.setFont("helvetica","normal"); doc.setTextColor(80,80,80);
      doc.text(`Aluguel ${m.mes}`, L, y);
      doc.setFont("helvetica","bold"); doc.setTextColor(180,0,0);
      doc.text(fmtBRL(m.valor), R, y, { align: "right" });
      y += 6;
    });

    linha(y); y += 6;
    doc.setFont("helvetica","bold"); doc.setFontSize(11); doc.setTextColor(30,30,30);
    doc.text("TOTAL (c/ multa e juros)", L, y);
    doc.setTextColor(180,0,0);
    doc.text(fmtBRL(valor_total), R, y, { align: "right" });
    y += 5;
    doc.setFont("helvetica","normal"); doc.setFontSize(8); doc.setTextColor(120,120,120);
    doc.text(`(${dias_atraso} dias de atraso — multa + juros pro rata incluídos)`, L, y);

    y += 12; linha(y); y += 10;

    // ── TEXTO JURÍDICO ────────────────────────────────
    doc.setFont("helvetica","bold"); doc.setFontSize(10); doc.setTextColor(11,107,114);
    doc.text("FUNDAMENTO LEGAL E NOTIFICAÇÃO", L, y); y += 5;
    linha(y); y += 8;

    doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.setTextColor(40,40,40);

    const paragrafos = [
      `Vimos por meio desta NOTIFICAR EXTRAJUDICIALMENTE Vossa Senhoria da existência de débito referente à locação do imóvel acima identificado, no valor total de ${fmtBRL(valor_total)} (${dias_atraso} dias de atraso).`,
      `Nos termos do art. 9º, inciso III, e art. 62, inciso II, da Lei nº 8.245/91 (Lei do Inquilinato), a falta de pagamento do aluguel e demais encargos da locação constitui infração contratual que autoriza a rescisão do contrato e a propositura de ação de despejo.`,
      `Fica Vossa Senhoria NOTIFICADA a, no prazo improrrogável de 30 (trinta) dias a contar do recebimento desta notificação (até ${prazo30dias(hoje)}), providenciar o pagamento integral do valor em aberto, sob pena de:`,
    ];

    paragrafos.forEach(p => {
      const lines = doc.splitTextToSize(p, W);
      doc.text(lines, L, y);
      y += lines.length * 5.5 + 4;
    });

    // Lista de consequências
    const consequencias = [
      "a)  Ajuizamento de Ação de Despejo por Falta de Pagamento;",
      "b)  Negativação junto ao Serasa/SPC e demais órgãos de proteção ao crédito;",
      "c)  Protesto extrajudicial do débito;",
      "d)  Execução judicial dos valores em aberto com acréscimo de honorários advocatícios.",
    ];

    consequencias.forEach(c => {
      doc.setFont("helvetica","normal"); doc.setFontSize(9);
      doc.text(c, L + 5, y);
      y += 6;
    });

    y += 4;
    const enc = `Caso já tenha efetuado o pagamento, por favor apresente o comprovante imediatamente para que possamos regularizar a situação junto ao nosso sistema. Para quitação ou negociação, entre em contato pelos canais de atendimento da Borges Silva Locações.`;
    const encLines = doc.splitTextToSize(enc, W);
    doc.text(encLines, L, y);
    y += encLines.length * 5.5 + 10;

    // ── ASSINATURA ────────────────────────────────────
    linha(y); y += 8;
    doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.setTextColor(80,80,80);
    doc.text(`Campo Maior, ${dataExtenso(hoje)}`, 105, y, { align: "center" });
    y += 18;

    doc.line(55, y, 155, y);
    y += 5;
    doc.setFont("helvetica","bold"); doc.setTextColor(30,30,30);
    doc.text("Borges Silva Locações", 105, y, { align: "center" });
    y += 5;
    doc.setFont("helvetica","normal"); doc.setTextColor(100,100,100); doc.setFontSize(8);
    doc.text("Locador / Representante Legal", 105, y, { align: "center" });

    // ── RODAPÉ ────────────────────────────────────────
    doc.setFontSize(7); doc.setTextColor(160,160,160);
    doc.text(`Gerado em ${hoje.toLocaleDateString("pt-BR")} às ${hoje.toLocaleTimeString("pt-BR")} · Borges Silva Locações`, 105, 287, { align: "center" });

    // ── UPLOAD ────────────────────────────────────────

    // Buscar configuração do procurador
    const { data: cfgData } = await supabase.from("config_sistema")
      .select("chave, valor")
      .in("chave", ["locador_nome","locador_cpf_cnpj","procurador_ativo","procurador_nome","procurador_cpf"]);
    const cfgMap2: Record<string,string> = {};
    (cfgData||[]).forEach((r:any) => { cfgMap2[r.chave] = r.valor||""; });
    const temProc = cfgMap2.procurador_ativo === "true" && !!cfgMap2.procurador_nome;
    const nomeProprietario = cfgMap2.locador_nome || "Borges Silva Locações";
    const cpfProprietario  = cfgMap2.locador_cpf_cnpj || "";
    const nomeProcurador   = cfgMap2.procurador_nome || "";
    const cpfProcurador    = cfgMap2.procurador_cpf  || "";

    const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
    const fileName = `${user.id}/${imovel_id}/notificacoes/${Date.now()}-notificacao-${nome_inquilino.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9-_]/g,"-").replace(/-+/g,"-").toLowerCase()}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from("documentos")
      .upload(fileName, pdfBuffer, { contentType: "application/pdf", upsert: false });

    if (uploadError) throw uploadError;

    const { data: signed } = await supabase.storage.from("documentos").createSignedUrl(fileName, 60*60*24*7);
        const publicUrl = signed?.signedUrl || "";

    return NextResponse.json({ success: true, pdfUrl: publicUrl });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
