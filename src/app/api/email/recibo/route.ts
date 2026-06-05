// Based on Lugo — Copyright (c) 2024 Renilson Medeiros — MIT License
import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { createClient } from "@/lib/supabase/server";

function fmtBRL(v: number) {
  return (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtData(iso: string) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
function mesLabel(iso: string) {
  if (!iso) return "";
  const [y, mo] = iso.split("-");
  const M = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho",
             "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  return `${M[parseInt(mo) - 1]} de ${y}`;
}

export async function POST(req: NextRequest) {
  try {
    const { comprovante_id } = await req.json();
    if (!comprovante_id) return NextResponse.json({ error: "comprovante_id obrigatório" }, { status: 400 });

    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      return NextResponse.json({ error: "E-mail não configurado. Adicione GMAIL_USER e GMAIL_APP_PASSWORD nas variáveis de ambiente do Vercel." }, { status: 503 });
    }

    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { data: comp } = await supabase
      .from("comprovantes")
      .select(`id, mes_referencia, valor, valor_multa, valor_juros,
        data_vencimento, data_pagamento, forma_pagamento,
        inquilinos (id, nome_completo, email,
          imoveis (titulo, endereco_rua, endereco_numero, endereco_bairro, endereco_cidade))`)
      .eq("id", comprovante_id)
      .single();

    if (!comp) return NextResponse.json({ error: "Comprovante não encontrado" }, { status: 404 });

    const inq = Array.isArray(comp.inquilinos) ? (comp.inquilinos as any)[0] : comp.inquilinos as any;
    const im  = Array.isArray(inq?.imoveis)    ? (inq.imoveis as any)[0]    : inq?.imoveis as any;

    if (!inq?.email) return NextResponse.json({ error: "Inquilino sem e-mail cadastrado" }, { status: 400 });

    const { data: cfg } = await supabase.from("config_sistema").select("chave, valor")
      .in("chave", ["locador_nome","locador_telefone","procurador_ativo","procurador_nome"]);
    const cfgMap: Record<string,string> = {};
    (cfg||[]).forEach((r:any)=>{ cfgMap[r.chave]=r.valor||""; });

    const total = (comp.valor||0)+(comp.valor_multa||0)+(comp.valor_juros||0);
    const formaMap: Record<string,string> = { pix:"Pix",dinheiro:"Dinheiro",transferencia:"Transferência",cartao:"Cartão",cheque:"Cheque" };
    const formaLabel = formaMap[(comp as any).forma_pagamento] || (comp as any).forma_pagamento || "—";
    const imovelEnd = im ? `${im.endereco_rua||""}, ${im.endereco_numero||""} — ${im.endereco_cidade||"Parnaíba – PI"}` : "Parnaíba – PI";
    const locadorNome = cfgMap.locador_nome || "Borges Silva Locações";
    const locadorTel  = cfgMap.locador_telefone || "";
    const gestorNome  = cfgMap.procurador_ativo==="true" && cfgMap.procurador_nome ? cfgMap.procurador_nome : "";

    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><style>
body{font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:20px}
.card{background:#fff;max-width:560px;margin:0 auto;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1)}
.hd{background:#1a1a2e;color:#fff;padding:24px 32px}.hd h1{margin:0;font-size:20px}.hd p{margin:4px 0 0;font-size:13px;opacity:.75}
.bd{padding:28px 32px}
.row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:14px}.row:last-child{border:none}
.lbl{color:#666}.val{font-weight:500;color:#1a1a2e;text-align:right;max-width:60%}
.total{background:#f0f7f0;border-radius:6px;padding:16px 20px;margin:20px 0;display:flex;justify-content:space-between;align-items:center}
.total .lbl{font-size:14px;color:#2d6a2d;font-weight:500}.total .val{font-size:22px;font-weight:700;color:#2d6a2d;max-width:none}
.ft{background:#f9f9f9;padding:20px 32px;text-align:center;font-size:12px;color:#999;border-top:1px solid #eee}
</style></head><body><div class="card">
<div class="hd"><h1>Recibo de Pagamento</h1><p>${mesLabel(comp.mes_referencia)} · ${im?.titulo||"—"}</p></div>
<div class="bd">
  <p style="font-size:15px;margin:0 0 16px">Olá, <strong>${inq.nome_completo}</strong>! Confirmamos o recebimento do aluguel abaixo.</p>
  <div class="row"><span class="lbl">Imóvel</span><span class="val">${im?.titulo||"—"}</span></div>
  <div class="row"><span class="lbl">Endereço</span><span class="val">${imovelEnd}</span></div>
  <div class="row"><span class="lbl">Referência</span><span class="val">${mesLabel(comp.mes_referencia)}</span></div>
  <div class="row"><span class="lbl">Vencimento</span><span class="val">${fmtData(comp.data_vencimento)}</span></div>
  <div class="row"><span class="lbl">Pagamento</span><span class="val">${fmtData((comp as any).data_pagamento)}</span></div>
  <div class="row"><span class="lbl">Forma</span><span class="val">${formaLabel}</span></div>
  ${(comp.valor_multa||0)>0?`<div class="row"><span class="lbl">Aluguel base</span><span class="val">${fmtBRL(comp.valor||0)}</span></div><div class="row"><span class="lbl">Multa + Juros</span><span class="val">${fmtBRL((comp.valor_multa||0)+(comp.valor_juros||0))}</span></div>`:""}
  <div class="total"><span class="lbl">Total pago</span><span class="val">${fmtBRL(total)}</span></div>
  <p style="font-size:12px;color:#aaa;margin:0">Este documento serve como comprovante de pagamento do aluguel identificado acima.</p>
</div>
<div class="ft"><strong>${locadorNome}</strong><br>${locadorTel?`Tel: ${locadorTel} · `:""}Parnaíba – PI${gestorNome?`<br>Gerenciado por: ${gestorNome}`:""}</div>
</div></body></html>`;

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    });

    await transporter.sendMail({
      from: `"${locadorNome}" <${process.env.GMAIL_USER}>`,
      to: inq.email,
      subject: `Recibo de pagamento — ${mesLabel(comp.mes_referencia)} · ${im?.titulo||"Locação"}`,
      html,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Email error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
