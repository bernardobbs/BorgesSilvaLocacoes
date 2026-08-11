// Based on Lugo — Copyright (c) 2024 Renilson Medeiros — MIT License
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { FAMILY_OWNER_ID } from "@/lib/family";
import jsPDF from "jspdf";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  inquilino_id: z.string().uuid(),
  imovel_id: z.string().uuid(),
});

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
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    const { inquilino_id, imovel_id } = parsed.data;

    // Buscar e verificar ownership do imóvel
    const { data: imovel } = await supabase.from("imoveis")
      .select("id, titulo, endereco_rua, endereco_numero, endereco_bairro, endereco_cidade, endereco_estado")
      .eq("id", imovel_id)
      .eq("proprietario_id", FAMILY_OWNER_ID)
      .single();
    if (!imovel) return NextResponse.json({ error: "Imóvel não encontrado ou sem permissão" }, { status: 403 });

    // Buscar dados do inquilino (ownership garantida via RLS + filtro de imovel_id)
    const { data: inq } = await supabase.from("inquilinos")
      .select("nome_completo, cpf, cnpj")
      .eq("id", inquilino_id)
      .eq("imovel_id", imovel_id)
      .single();
    if (!inq) return NextResponse.json({ error: "Inquilino não encontrado" }, { status: 404 });

    // Buscar comprovantes em aberto para calcular dívida
    const { data: comps } = await supabase.from("comprovantes")
      .select("mes_referencia, valor, valor_multa, valor_juros, data_vencimento, situation")
      .eq("inquilino_id", inquilino_id)
      .eq("imovel_id", imovel_id)
      .eq("situation", "expired")
      .order("mes_referencia");

    const mesesDivida = (comps || []).map((c: any) => ({
      mes: c.mes_referencia?.slice(0, 7) || "",
      valor: (c.valor || 0) + (c.valor_multa || 0) + (c.valor_juros || 0),
    }));

    const valorTotal = mesesDivida.reduce((s: number, m: any) => s + m.valor, 0);

    // Calcular dias de atraso com base no comprovante mais antigo
    const maisAntigo = comps?.[0];
    const diasAtraso = maisAntigo?.data_vencimento
      ? Math.max(0, Math.floor((Date.now() - new Date(maisAntigo.data_vencimento).getTime()) / 86400000))
      : 0;

    const nomeInquilino = inq.nome_completo || "";
    const docInquilino = inq.cpf || inq.cnpj || "";
    const imovelTitulo = imovel.titulo || "";
    const imovelEndereco = [
      imovel.endereco_rua,
      imovel.endereco_numero,
      imovel.endereco_bairro,
      imovel.endereco_cidade,
      imovel.endereco_estado,
    ].filter(Boolean).join(", ");

    const hoje = new Date();
    const doc = new jsPDF();
    const L = 20, R = 190, W = R - L;
    let y = 20;

    const linha = (yPos: number) => {
      doc.setDrawColor(200,200,200);
      doc.line(L, yPos, R, yPos);
    };

    // ── CABEÇALHO ─────────────────────────────────────
    doc.setFillColor(11, 107, 114);
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

    col("Nome:", nomeInquilino, L, 40, y); y += 6;
    col("CPF/CNPJ:", docInquilino || "não informado", L, 40, y); y += 6;
    col("Imóvel:", imovelTitulo, L, 40, y); y += 6;

    const endLines = doc.splitTextToSize(imovelEndereco || "não informado", 140);
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
    mesesDivida.forEach((m: {mes:string; valor:number}) => {
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
    doc.text(fmtBRL(valorTotal), R, y, { align: "right" });
    y += 5;
    doc.setFont("helvetica","normal"); doc.setFontSize(8); doc.setTextColor(120,120,120);
    doc.text(`(${diasAtraso} dias de atraso — multa + juros pro rata incluídos)`, L, y);

    y += 12; linha(y); y += 10;

    // ── TEXTO JURÍDICO ────────────────────────────────
    doc.setFont("helvetica","bold"); doc.setFontSize(10); doc.setTextColor(11,107,114);
    doc.text("FUNDAMENTO LEGAL E NOTIFICAÇÃO", L, y); y += 5;
    linha(y); y += 8;

    doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.setTextColor(40,40,40);

    const paragrafos = [
      `Vimos por meio desta NOTIFICAR EXTRAJUDICIALMENTE Vossa Senhoria da existência de débito referente à locação do imóvel acima identificado, no valor total de ${fmtBRL(valorTotal)} (${diasAtraso} dias de atraso).`,
      `Nos termos do art. 9º, inciso III, e art. 62, inciso II, da Lei nº 8.245/91 (Lei do Inquilinato), a falta de pagamento do aluguel e demais encargos da locação constitui infração contratual que autoriza a rescisão do contrato e a propositura de ação de despejo.`,
      `Fica Vossa Senhoria NOTIFICADA a, no prazo improrrogável de 30 (trinta) dias a contar do recebimento desta notificação (até ${prazo30dias(hoje)}), providenciar o pagamento integral do valor em aberto, sob pena de:`,
    ];

    paragrafos.forEach(p => {
      const lines = doc.splitTextToSize(p, W);
      doc.text(lines, L, y);
      y += lines.length * 5.5 + 4;
    });

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

    const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
    const safeName = nomeInquilino.normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-zA-Z0-9-_]/g,"-").replace(/-+/g,"-").toLowerCase();
    const fileName = `${user.id}/${imovel_id}/notificacoes/${Date.now()}-notificacao-${safeName}.pdf`;

    let pdfUrl = "";
    try {
      const { error: uploadError } = await supabase.storage
        .from("documentos")
        .upload(fileName, pdfBuffer, { contentType: "application/pdf", upsert: false });
      if (!uploadError) {
        const { data: signed } = await supabase.storage.from("documentos").createSignedUrl(fileName, 60*60*24*7);
        pdfUrl = signed?.signedUrl || "";
      }
    } catch { /* Storage falhou — PDF retornado como base64 */ }

    const pdfBase64 = pdfUrl ? undefined : pdfBuffer.toString("base64");
    return NextResponse.json({ success: true, pdfUrl, pdfBase64 });
  } catch (e: any) {
    console.error("Erro ao gerar notificação extrajudicial:", e);
    return NextResponse.json({ error: "Erro ao gerar documento" }, { status: 500 });
  }
}
