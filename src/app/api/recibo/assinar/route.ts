// Based on Lugo — Copyright (c) 2024 Renilson Medeiros — MIT License
// Rota de assinatura criptográfica de recibos (HMAC-SHA256)
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { gerarReceiptHash, gerarReceiptNumber } from "@/lib/receiptHash";

export async function POST(req: NextRequest) {
  try {
    const { comprovante_id } = await req.json();
    if (!comprovante_id) return NextResponse.json({ error: "comprovante_id obrigatório" }, { status: 400 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    // Buscar dados do comprovante
    const { data: comp } = await supabase.from("comprovantes")
      .select("id, imovel_id, inquilino_id, valor, data_pagamento, mes_referencia, receipt_hash, receipt_number")
      .eq("id", comprovante_id).single();

    if (!comp) return NextResponse.json({ error: "Comprovante não encontrado" }, { status: 404 });

    // Se já tem hash — não recalcular (imutável)
    if (comp.receipt_hash) {
      return NextResponse.json({
        success: true,
        hash: comp.receipt_hash,
        receiptNumber: comp.receipt_number,
        jaExistia: true,
      });
    }

    // Gerar número sequencial do recibo
    const { count } = await supabase.from("comprovantes")
      .select("*", { count: "exact", head: true })
      .eq("mes_referencia", comp.mes_referencia)
      .not("receipt_hash", "is", null);

    const sequencia = (count || 0) + 1;
    const receiptNumber = gerarReceiptNumber(comp.mes_referencia, sequencia);

    // Gerar hash HMAC-SHA256
    const hash = gerarReceiptHash({
      receiptNumber,
      comprovante_id: comp.id,
      imovel_id: comp.imovel_id,
      inquilino_id: comp.inquilino_id,
      valor: comp.valor || 0,
      data_pagamento: comp.data_pagamento || new Date().toISOString().split("T")[0],
      mes_referencia: comp.mes_referencia,
    });

    // Salvar hash e número no comprovante (SET ONCE — não sobrescreve se já existir)
    const { error: updErr } = await supabase.from("comprovantes").update({
      receipt_hash: hash,
      receipt_number: receiptNumber,
      hash_gerado_em: new Date().toISOString(),
    }).eq("id", comprovante_id).is("receipt_hash", null); // só atualiza se ainda não tem

    if (updErr) throw updErr;

    // Registrar auditoria
    await supabase.from("auditoria_recibos").insert({
      comprovante_id,
      receipt_number: receiptNumber,
      receipt_hash: hash,
      operacao: "hash_gerado",
      usuario_id: user.id,
      detalhe: `Hash gerado para comprovante ${comprovante_id}`,
    });

    return NextResponse.json({ success: true, hash, receiptNumber });
  } catch (err: any) {
    console.error("Erro ao assinar recibo:", err);

    // Registrar falha na auditoria
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("auditoria_recibos").insert({
        comprovante_id: req.body ? (await req.json().catch(() => ({}))).comprovante_id : null,
        operacao: "falha",
        usuario_id: user?.id,
        detalhe: err.message,
      });
    } catch {}

    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
