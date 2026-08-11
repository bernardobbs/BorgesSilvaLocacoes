// Based on Lugo — Copyright (c) 2024 Renilson Medeiros — MIT License
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const schema = z.object({
  inquilino_id: z.string().uuid(),
  valor_novo: z.number().positive(),
  percentual: z.number().min(0).max(100).optional(),
  indice: z.string().max(50).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    const { inquilino_id, valor_novo, percentual, indice } = parsed.data;

    // Verificar propriedade
    const { data: profile } = await supabase.from("profiles").select("family_owner_id").eq("id", user.id).single();
    const familyOwnerId = profile?.family_owner_id || user.id;

    const { data: inq } = await supabase.from("inquilinos")
      .select("valor_aluguel, nome_completo, imoveis!inner(proprietario_id)")
      .eq("id", inquilino_id).single();
    const imovelInq = Array.isArray((inq as any)?.imoveis) ? (inq as any).imoveis[0] : (inq as any)?.imoveis;
    if (!inq || imovelInq?.proprietario_id !== familyOwnerId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    }

    const hoje = new Date().toISOString().split("T")[0];

    await supabase.from("historico_reajustes").insert({
      inquilino_id, data_reajuste: hoje,
      valor_anterior: inq.valor_aluguel,
      valor_novo, indice, percentual,
      aplicado_por: user.id,
    });

    const { error } = await supabase.from("inquilinos").update({
      valor_aluguel: valor_novo,
      data_ultimo_reajuste: hoje,
    }).eq("id", inquilino_id);

    if (error) throw error;

    return NextResponse.json({ success: true, valor_anterior: inq.valor_aluguel, valor_novo });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
