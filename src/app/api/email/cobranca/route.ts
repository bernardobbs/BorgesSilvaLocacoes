// Based on Lugo — Copyright (c) 2024 Renilson Medeiros — MIT License
import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { createClient } from "@/lib/supabase/server";

function fmtBRL(v: number) { return (v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"}); }
function fmtD(iso: string) { if(!iso)return"—"; const[y,m,d]=iso.split("-"); return`${d}/${m}/${y}`; }

export async function POST(req: NextRequest) {
  try {
    const { inquilino_id, estagio, dias_atraso, valor_total, meses_pendentes } = await req.json();

    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      return NextResponse.json({ skipped: true, reason: "Gmail não configurado" });
    }

    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    // Buscar dados do inquilino
    const { data: inq } = await supabase.from("inquilinos")
      .select("nome_completo, email, cpf, telefone, valor_aluguel, multa_percentual, juros_percentual, imoveis(titulo, endereco_rua, endereco_numero, endereco_cidade)")
      .eq("id", inquilino_id).single();

    if (!inq?.email) return NextResponse.json({ skipped: true, reason: "Sem e-mail cadastrado" });

    // Buscar config do locador
    const { data: cfg } = await supabase.from("config_sistema").select("chave, valor")
      .in("chave", ["locador_nome","locador_telefone","locador_email","procurador_ativo","procurador_nome"]);
    const cfgMap: Record<string,string> = {};
    (cfg||[]).forEach((r:any) => { cfgMap[r.chave] = r.valor||""; });

    const im = Array.isArray(inq.imoveis) ? (inq.imoveis as any)[0] : inq.imoveis as any;
    const locadorNome = cfgMap.locador_nome || "Borges Silva Locações";
    const gestorNome = cfgMap.procurador_ativo==="true" ? cfgMap.procurador_nome : "";

    const estagioLabel = estagio === 1 ? "Aviso amigável"
      : estagio === 2 ? "Cobrança formal"
      : estagio === 3 ? "Notificação pré-extrajudicial"
      : `Estágio ${estagio}`;

    const urgencia = estagio >= 3
      ? "⚠️ URGENTE — Esta é uma notificação formal antes de medidas legais."
      : estagio === 2
      ? "Este é um lembrete formal de cobrança."
      : "Este é um aviso amigável sobre seu aluguel em aberto.";

    const multa = inq.valor_aluguel * ((inq.multa_percentual || 10) / 100);
    const juros = inq.valor_aluguel * ((inq.juros_percentual || 1) / 100 / 30) * dias_atraso;

    // Montar tabela de meses pendentes
    const tabelaMeses = (meses_pendentes || []).map((m: any) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #eee">${m.mes}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right">${fmtBRL(m.valor_base)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right">${fmtBRL(m.encargos)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;font-weight:500">${fmtBRL(m.total)}</td>
      </tr>`).join("");

    const corEstagio = estagio >= 3 ? "#C0392B" : estagio === 2 ? "#D35400" : "#F39C12";

    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><style>
body{font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:20px}
.card{background:#fff;max-width:580px;margin:0 auto;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1)}
.hd{background:#1a1a2e;color:#fff;padding:24px 32px;border-top:4px solid ${corEstagio}}
.hd h1{margin:0;font-size:18px}.hd p{margin:4px 0 0;font-size:13px;opacity:.75}
.bd{padding:28px 32px}
.urgencia{background:${estagio>=3?"#FDEDEC":"#FEF9E7"};border-left:4px solid ${corEstagio};padding:12px 16px;border-radius:4px;margin-bottom:20px;font-size:13px;color:${corEstagio}}
table{width:100%;border-collapse:collapse;margin:16px 0;font-size:13px}
th{background:#f5f5f5;padding:8px 12px;text-align:left;font-size:12px;font-weight:500;color:#666}
th:last-child,td:last-child{text-align:right}
.total-row{background:#FDEDEC}
.total-row td{padding:10px 12px;font-weight:700;font-size:14px;color:#C0392B}
.btn{display:inline-block;background:${corEstagio};color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:500;margin-top:16px}
.ft{background:#f9f9f9;padding:18px 32px;text-align:center;font-size:11px;color:#999;border-top:1px solid #eee}
</style></head><body><div class="card">
<div class="hd">
  <h1>${estagioLabel} — D+${dias_atraso}</h1>
  <p>${locadorNome} · ${im?.titulo || "Locação"}</p>
</div>
<div class="bd">
  <div class="urgencia">${urgencia}</div>
  <p style="font-size:15px;margin:0 0 16px">Prezado(a) <strong>${inq.nome_completo}</strong>,</p>
  <p style="font-size:13px;color:#555;margin:0 0 16px">
    Identificamos que o(s) aluguel(éis) abaixo referentes ao imóvel <strong>${im?.titulo||"—"}</strong>
    ${im?.endereco_cidade ? `em ${im.endereco_cidade}` : ""} estão em aberto há <strong>${dias_atraso} dias</strong>.
  </p>

  <table>
    <thead><tr>
      <th>Referência</th><th>Aluguel base</th><th>Encargos</th><th>Total</th>
    </tr></thead>
    <tbody>
      ${tabelaMeses || `<tr><td colspan="4" style="padding:8px 12px;color:#888">Detalhes não disponíveis</td></tr>`}
    </tbody>
    <tfoot><tr class="total-row">
      <td colspan="2">TOTAL EM ABERTO</td>
      <td></td>
      <td>${fmtBRL(valor_total)}</td>
    </tr></tfoot>
  </table>

  <p style="font-size:13px;color:#555">
    Solicitamos a regularização <strong>imediata</strong> do débito para evitar a cobrança de encargos adicionais
    ${estagio >= 2 ? "e medidas administrativas e/ou judiciais" : ""}.
  </p>

  ${cfgMap.locador_telefone ? `
  <p style="font-size:13px;color:#555;margin-top:12px">
    Para regularizar, entre em contato: <strong>${cfgMap.locador_telefone}</strong>
    ${cfgMap.locador_email ? ` · <strong>${cfgMap.locador_email}</strong>` : ""}
  </p>` : ""}

  ${estagio >= 2 ? `
  <div style="background:#FEF9E7;border-radius:6px;padding:12px 16px;margin-top:16px;font-size:12px;color:#7D6608">
    ⚖️ <strong>Base legal:</strong> Lei nº 8.245/91 (Lei do Inquilinato), art. 62, inciso I.
    O não pagamento poderá resultar em ação de cobrança e despejo.
  </div>` : ""}
</div>
<div class="ft">
  <strong>${locadorNome}</strong><br>
  ${cfgMap.locador_telefone ? `Tel: ${cfgMap.locador_telefone} · ` : ""}Parnaíba – PI<br>
  ${gestorNome ? `Gerenciado por: ${gestorNome}` : ""}
  <br><br>
  <span style="font-size:10px">Esta é uma notificação automática. Não responda este e-mail.</span>
</div>
</div></body></html>`;

    const subjects = [
      `Aviso: aluguel em aberto — ${im?.titulo||"Locação"} (D+${dias_atraso})`,
      `COBRANÇA: aluguel vencido há ${dias_atraso} dias — ${im?.titulo||"Locação"}`,
      `⚠️ URGENTE: notificação formal — ${im?.titulo||"Locação"} (D+${dias_atraso})`,
    ];

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    });

    await transporter.sendMail({
      from: `"${locadorNome}" <${process.env.GMAIL_USER}>`,
      to: inq.email,
      subject: subjects[Math.min(estagio - 1, 2)],
      html,
    });

    return NextResponse.json({ success: true, to: inq.email });
  } catch (err: any) {
    console.error("Email cobrança error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
