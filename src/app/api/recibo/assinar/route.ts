// Based on Lugo — Copyright (c) 2024 Renilson Medeiros — MIT License
// Rota de assinatura criptográfica de recibos (HMAC-SHA256)
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { FAMILY_OWNER_ID, assertFamilyOwnerConfigured } from "@/lib/family";
import { gerarReceiptHash, gerarReceiptNumber } from "@/lib/receiptHash";
import { z } from "zod";

const schema = z.object({ comprovante_id: z.string().uuid() });

export async function POST(req: NextRequest) {
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "comprovante_id inválido" }, { status: 400 });
    const { comprovante_id } = parsed.data;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    // Buscar dados do comprovante + verificar ownership via imovel
    const { data: comp } = await supabase.from("comprovantes")
      .select("id, imovel_id, inquilino_id, valor, data_pagamento, mes_referencia, receipt_hash, receipt_number, imoveis!inner(proprietario_id)")
      .eq("id", comprovante_id).single();

    if (!comp) return NextResponse.json({ error: "Comprovante não encontrado" }, { status: 404 });

    const imovelComp = Array.isArray((comp as any).imoveis) ? (comp as any).imoveis[0] : (comp as any).imoveis;
    if (imovelComp?.proprietario_id !== FAMILY_OWNER_ID) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    // Se já tem hash — não recalcular (imutável)
    if (comp.receipt_hash) {
      return NextResponse.json({
        success: true,
        hash: comp.receipt_hash,
        receiptNumber: comp.receipt_number,
        jaExistia: true,
      });
    }

    // Gerar número sequencial atômico (evita race condition com COUNT+1)
    const mesPrefixo = comp.mes_referencia.slice(0, 7); // "YYYY-MM"
    const { data: seqData, error: seqErr } = await supabase.rpc("next_receipt_seq", { p_mes: mesPrefixo });
    if (seqErr) throw new Error(`Erro ao gerar número do recibo: ${seqErr.message}`);
    const receiptNumber = gerarReceiptNumber(comp.mes_referencia, seqData as number);

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
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
