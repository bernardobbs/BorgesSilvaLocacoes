// Based on Lugo — Copyright (c) 2024 Renilson Medeiros — MIT License
// Registra pagamento + gera hash + salva + dispara email — tudo no servidor
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createHmac } from "crypto";

function gerarHash(payload: Record<string, string>): string {
  const secret = process.env.RECEIPT_SECRET || "bsl-default-secret-2026";
  const str = Object.values(payload).join("|");
  return createHmac("sha256", secret).update(str).digest("hex");
}

function gerarReceiptNumber(mesReferencia: string, seq: number): string {
  const [y, m] = mesReferencia.split("-");
  return `REC-${y}${m}-${String(seq).padStart(4, "0")}`;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const body = await req.json();
    const {
      comprovante_id,
      inquilino_id,
      imovel_id,
      mes_referencia,
      valor,
      valor_multa,
      valor_juros,
      data_pagamento,
      forma_pagamento,
      descricao,
    } = body;

    // 1. Atualizar comprovante existente OR inserir novo
    let compId = comprovante_id;
    let comp: any = null;

    if (compId) {
      const { data, error } = await supabase.from("comprovantes")
        .update({
          valor, valor_multa, valor_juros,
          situation: "billed",
          data_pagamento,
          forma_pagamento,
          descricao: descricao || null,
        })
        .eq("id", compId)
        .select()
        .single();
      if (error) throw new Error(`Erro ao atualizar: ${error.message}`);
      comp = data;
    } else {
      const { data, error } = await supabase.from("comprovantes")
        .insert({
          inquilino_id, imovel_id, mes_referencia,
          tipo: "pagamento", valor, valor_multa, valor_juros,
          situation: "billed",
          data_pagamento,
          forma_pagamento,
          descricao: descricao || null,
        })
        .select()
        .single();
      if (error) throw new Error(`Erro ao criar: ${error.message}`);
      comp = data;
      compId = comp?.id;
    }

    if (!compId) throw new Error("Comprovante não identificado após salvar");

    // 2. Gerar hash e número do recibo
    const { count } = await supabase.from("comprovantes")
      .select("*", { count: "exact", head: true })
      .eq("mes_referencia", mes_referencia)
      .not("receipt_hash", "is", null);

    const seq = (count || 0) + 1;
    const receiptNumber = gerarReceiptNumber(mes_referencia, seq);

    const hash = gerarHash({
      receiptNumber,
      comprovante_id: compId,
      imovel_id: imovel_id || comp?.imovel_id || "",
      inquilino_id: inquilino_id || comp?.inquilino_id || "",
      valor: String(valor),
      data_pagamento,
      mes_referencia,
    });

    // 3. Salvar hash no comprovante
    await supabase.from("comprovantes")
      .update({
        receipt_hash: hash,
        receipt_number: receiptNumber,
        hash_gerado_em: new Date().toISOString(),
      })
      .eq("id", compId)
      .is("receipt_hash", null); // idempotente

    // 4. Registrar auditoria
    await supabase.from("auditoria_recibos").insert({
      comprovante_id: compId,
      receipt_number: receiptNumber,
      receipt_hash: hash,
      operacao: "hash_gerado",
      usuario_id: session.user.id,
      detalhe: `Hash gerado via API server-side`,
    });

    return NextResponse.json({
      success: true,
      comprovante_id: compId,
      receipt_number: receiptNumber,
      receipt_hash: hash,
    });
  } catch (err: any) {
    console.error("Erro ao registrar pagamento:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
