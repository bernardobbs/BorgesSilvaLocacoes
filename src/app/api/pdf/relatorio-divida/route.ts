// Based on Lugo — Copyright (c) 2024 Renilson Medeiros — MIT License
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import jsPDF from "jspdf";

export const dynamic = "force-dynamic";

function fmtBRL(v: number) { return v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"}); }
function fmtData(iso: string|null) {
  if (!iso) return "—";
  const [y,m,d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
function mesLabel(iso: string) {
  const [y,mo] = iso.split("-");
  const M=["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  return `${M[parseInt(mo)-1]}/${y}`;
}
function dataExtenso(d: Date) {
  const meses=["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
  return `${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`;
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
      inquilino_id, imovel_id, nome_inquilino, doc_inquilino,
      imovel_titulo, imovel_endereco,
      data_inicio, data_desocupacao, motivo_encerramento,
      comprovantes, divida_total, divida_liquida,
      danos, dano_descricao,
      garantia_executada, garantia_obs,
      obs,
    } = await request.json();

    const hoje = new Date();
    const doc = new jsPDF();
    const L = 20; const R = 190; const W = R - L;
    let y = 20;

    // ── CABEÇALHO ──────────────────────────────────────
    doc.setFillColor(11,107,114);
    doc.rect(0,0,210,38,"F");
    doc.setFont("helvetica","bold"); doc.setFontSize(15); doc.setTextColor(255,255,255);
    doc.text("RELATÓRIO DE DÍVIDA CONSOLIDADA", 105, 14, { align:"center" });
    doc.setFont("helvetica","normal"); doc.setFontSize(9);
    doc.text("Borges Silva Locações  ·  Campo Maior – PI", 105, 22, { align:"center" });
    doc.text(`Emitido em: ${dataExtenso(hoje)}`, 105, 29, { align:"center" });

    y = 48;

    const linha = () => { doc.setDrawColor(200,200,200); doc.line(L,y,R,y); };
    const secao = (titulo: string) => {
      doc.setFont("helvetica","bold"); doc.setFontSize(10); doc.setTextColor(11,107,114);
      doc.text(titulo, L, y); y += 4; linha(); y += 7;
    };
    const campo = (label: string, valor: string) => {
      doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.setTextColor(100,100,100);
      doc.text(label, L, y);
      doc.setFont("helvetica","bold"); doc.setTextColor(30,30,30);
      const lines = doc.splitTextToSize(valor, 130);
      doc.text(lines, 55, y);
      y += lines.length * 5.5;
    };

    // ── DADOS DO EX-INQUILINO ────────────────────────
    secao("DADOS DO EX-INQUILINO");
    campo("Nome:", nome_inquilino);
    campo("CPF/CNPJ:", doc_inquilino || "não informado");
    campo("Imóvel:", imovel_titulo);
    campo("Endereço:", imovel_endereco || "não informado");
    campo("Início:", fmtData(data_inicio));
    campo("Desocupação:", fmtData(data_desocupacao));
    const motivoLabels: Record<string,string> = {
      cumprimento:"Cumprimento do contrato", desocupacao_voluntaria:"Desocupação voluntária",
      despejo:"Despejo", acordo:"Acordo", outros:"Outros",
    };
    campo("Motivo:", motivoLabels[motivo_encerramento] || motivo_encerramento);
    y += 6;

    // ── HISTÓRICO DE PAGAMENTOS ──────────────────────
    secao("HISTÓRICO DE PARCELAS");

    // Cabeçalho da tabela
    doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.setTextColor(100,100,100);
    doc.text("Referência", L, y);
    doc.text("Vencimento", 65, y);
    doc.text("Valor base", 95, y);
    doc.text("Encargos", 125, y);
    doc.text("Total", 155, y);
    doc.text("Situação", 175, y);
    y += 4; linha(); y += 5;

    let totalPago = 0; let totalDevido = 0;
    comprovantes?.forEach((c: any) => {
      const base = c.valor || 0;
      const enc = (c.valor_multa||0) + (c.valor_juros||0);
      const total = base + enc;
      const pago = c.situation === "billed";
      if (pago) totalPago += total; else totalDevido += total;

      doc.setFont("helvetica","normal"); doc.setFontSize(8);
      doc.setTextColor(pago ? 80 : 180, pago ? 80 : 0, pago ? 80 : 0);
      doc.text(mesLabel(c.mes_referencia), L, y);
      doc.text(fmtData(c.data_vencimento), 65, y);
      doc.text(fmtBRL(base), 95, y);
      doc.text(enc > 0 ? fmtBRL(enc) : "—", 125, y);
      doc.text(fmtBRL(total), 155, y);
      doc.text(pago ? "PAGO" : "DEVENDO", 175, y);
      y += 5.5;

      if (y > 265) { doc.addPage(); y = 20; }
    });

    y += 4; linha(); y += 8;

    // ── RESUMO ──────────────────────────────────────
    secao("RESUMO FINANCEIRO");
    doc.setFont("helvetica","normal"); doc.setFontSize(10); doc.setTextColor(30,30,30);
    doc.text("Total pago:", L, y);
    doc.setTextColor(30,120,60);
    doc.text(fmtBRL(totalPago), R, y, { align:"right" }); y += 7;

    doc.setTextColor(30,30,30);
    doc.text("Parcelas em aberto (c/ encargos):", L, y);
    doc.setTextColor(180,0,0);
    doc.text(fmtBRL(totalDevido), R, y, { align:"right" }); y += 7;

    if (danos > 0) {
      doc.setTextColor(180,100,0); doc.setFont("helvetica","normal");
      doc.text("+ Danos ao imóvel:", L, y);
      doc.text(fmtBRL(danos), R, y, { align:"right" }); y += 5;
      if (dano_descricao) {
        doc.setFontSize(8); doc.setTextColor(120,80,0);
        const dl=doc.splitTextToSize(`  Descrição: ${dano_descricao}`,W);
        doc.text(dl,L,y); y+=dl.length*4.5;
      }
      y += 2;
    }

    const garantiaVal = garantia_executada || 0;
    if (garantiaVal > 0) {
      doc.setFontSize(10); doc.setTextColor(30,120,60); doc.setFont("helvetica","normal");
      doc.text("− Garantia executada:", L, y);
      doc.text(`−${fmtBRL(garantiaVal)}`, R, y, { align:"right" }); y += 5;
      if (garantia_obs) {
        doc.setFontSize(8); doc.setTextColor(30,100,60);
        const gl=doc.splitTextToSize(`  ${garantia_obs}`,W);
        doc.text(gl,L,y); y+=gl.length*4.5;
      }
      y += 2;
    }

    linha(); y += 5;
    doc.setFont("helvetica","bold"); doc.setFontSize(11); doc.setTextColor(180,0,0);
    doc.text("DÍVIDA LÍQUIDA A COBRAR:", L, y);
    doc.text(fmtBRL(divida_liquida || (totalDevido + (danos||0) - garantiaVal)), R, y, { align:"right" });
    y += 12;

    if (obs) {
      secao("OBSERVAÇÕES");
      doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.setTextColor(60,60,60);
      const obsLines = doc.splitTextToSize(obs, 170);
      doc.text(obsLines, L, y); y += obsLines.length * 5.5 + 8;
    }

    // ── AVISO LEGAL ─────────────────────────────────
    doc.setFillColor(255,245,230); doc.rect(L, y, 170, 24, "F");
    doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.setTextColor(140,80,0);
    doc.text("AVISO LEGAL", L+3, y+6);
    doc.setFont("helvetica","normal"); doc.setFontSize(7.5); doc.setTextColor(100,60,0);
    const avisoText = `Este relatório documenta os débitos do ex-locatário para fins de eventual ação judicial de cobrança, nos termos do art. 62 da Lei nº 8.245/91. Os valores apresentados incluem multa contratual e juros pro rata die até a data de emissão deste documento.`;
    const avisoLines = doc.splitTextToSize(avisoText, 163);
    doc.text(avisoLines, L+3, y+12);
    y += 30;

    // ── ASSINATURA ──────────────────────────────────
    doc.line(60, y+15, 150, y+15);
    doc.setFont("helvetica","bold"); doc.setFontSize(9); doc.setTextColor(30,30,30);
    doc.text("Borges Silva Locações", 105, y+20, { align:"center" });
    doc.setFont("helvetica","normal"); doc.setFontSize(8); doc.setTextColor(100,100,100);
    doc.text("Locador / Representante Legal", 105, y+26, { align:"center" });

    // Rodapé
    doc.setFontSize(7); doc.setTextColor(160,160,160);
    doc.text(`Gerado em ${hoje.toLocaleDateString("pt-BR")} às ${hoje.toLocaleTimeString("pt-BR")} · Borges Silva Locações`, 105, 287, { align:"center" });


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
    const fileName = `${user.id}/${imovel_id}/encerramentos/${Date.now()}-divida-${nome_inquilino.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9-_]/g,"-").replace(/-+/g,"-").toLowerCase()}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from("documentos")
      .upload(fileName, pdfBuffer, { contentType:"application/pdf", upsert:false });
    if (uploadError) throw uploadError;

    const { data: signed } = await supabase.storage.from("documentos").createSignedUrl(fileName, 60*60*24*7);
        const publicUrl = signed?.signedUrl || "";

    return NextResponse.json({ success:true, pdfUrl:publicUrl });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status:500 });
  }
}
