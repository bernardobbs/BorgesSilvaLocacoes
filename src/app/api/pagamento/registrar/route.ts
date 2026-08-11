// Based on Lugo — Copyright (c) 2024 Renilson Medeiros — MIT License
// Registra pagamento + gera hash + salva + dispara email — tudo no servidor
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createHmac } from "crypto";
import { z } from "zod";

const registrarSchema = z.object({
  comprovante_id: z.string().uuid().nullable().optional(),
  inquilino_id: z.string().uuid(),
  imovel_id: z.string().uuid(),
  mes_referencia: z.string().regex(/^\d{4}-\d{2}(-\d{2})?$/),
  valor: z.number().positive(),
  valor_multa: z.number().min(0),
  valor_juros: z.number().min(0),
  data_pagamento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  forma_pagamento: z.enum(["pix","dinheiro","transferencia","cartao","cheque","deposito"]),
  descricao: z.string().max(500).nullable().optional(),
  data_vencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

function gerarHash(payload: Record<string, string>): string {
  const secret = process.env.RECEIPT_SECRET;
  if (!secret) throw new Error("RECEIPT_SECRET não configurado — recibo não pode ser assinado.");
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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const parsed = registrarSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
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
    } = parsed.data;

    // Resolver family_owner_id para ownership checks
    const { data: userProfile } = await supabase.from("profiles").select("family_owner_id").eq("id", user.id).single();
    const familyOwnerId = userProfile?.family_owner_id || user.id;

    // 1. Atualizar comprovante existente OR inserir novo
    let compId = comprovante_id;
    let comp: any = null;

    if (compId) {
      // Verificar ownership do comprovante antes de atualizar
      const { data: existing } = await supabase
        .from("comprovantes")
        .select("id, imoveis!inner(proprietario_id)")
        .eq("id", compId)
        .single();
      if (!existing || (existing as any).imoveis?.proprietario_id !== familyOwnerId) {
        return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
      }

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
      // Verificar ownership do imóvel antes de INSERT
      const { data: imovelCheck } = await supabase.from("imoveis")
        .select("id").eq("id", imovel_id).eq("proprietario_id", familyOwnerId).single();
      if (!imovelCheck) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

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

    // 2. Número de recibo via sequence atômica no banco (evita race condition com COUNT+1)
    const mesPrefixo = mes_referencia.slice(0, 7); // "YYYY-MM"
    const { data: seqData, error: seqErr } = await supabase.rpc("next_receipt_seq", { p_mes: mesPrefixo });
    if (seqErr) throw new Error(`Erro ao gerar número do recibo: ${seqErr.message}`);
    const seq = seqData as number;
    const receiptNumber = gerarReceiptNumber(mesPrefixo, seq);

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
    const { error: hashErr } = await supabase.from("comprovantes")
      .update({
        receipt_hash: hash,
        receipt_number: receiptNumber,
        hash_gerado_em: new Date().toISOString(),
      })
      .eq("id", compId)
      .is("receipt_hash", null); // idempotente
    if (hashErr) console.error("Aviso: falha ao salvar hash no comprovante:", hashErr.message);

    // 4. Registrar auditoria
    await supabase.from("auditoria_recibos").insert({
      comprovante_id: compId,
      receipt_number: receiptNumber,
      receipt_hash: hash,
      operacao: "hash_gerado",
      usuario_id: user.id,
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
    console.error("API error:", err); return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
