// Based on Lugo — Copyright (c) 2024 Renilson Medeiros — MIT License
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const schema = z.object({
  parcela_id: z.string().uuid(),
  data_pagamento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  forma_pagamento: z.enum(["pix","dinheiro","transferencia","cartao","cheque","deposito"]),
  observacoes: z.string().max(500).nullable().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    const { parcela_id, data_pagamento, forma_pagamento, observacoes } = parsed.data;

    // Verificar propriedade: a parcela deve pertencer a um acordo do family_owner do usuário
    const { data: parcela } = await supabase
      .from("parcelas_acordo")
      .select("id, acordos!inner(imovel_id, imoveis!inner(proprietario_id))")
      .eq("id", parcela_id)
      .single();

    if (!parcela) return NextResponse.json({ error: "Parcela não encontrada" }, { status: 404 });

    // Buscar family_owner_id do usuário autenticado
    const { data: profile } = await supabase.from("profiles").select("family_owner_id").eq("id", user.id).single();
    const familyOwnerId = profile?.family_owner_id || user.id;

    const acordo = Array.isArray((parcela as any).acordos) ? (parcela as any).acordos[0] : (parcela as any).acordos;
    const imovel = Array.isArray(acordo?.imoveis) ? acordo.imoveis[0] : acordo?.imoveis;
    if (imovel?.proprietario_id !== familyOwnerId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    }

    const { error: updErr } = await supabase.from("parcelas_acordo").update({
      situation: "billed", data_pagamento, forma_pagamento, observacoes: observacoes || null,
    }).eq("id", parcela_id);

    if (updErr) throw new Error(`Erro ao atualizar parcela: ${updErr.message}`);

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("API error:", e); return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
