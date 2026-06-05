// Based on Lugo — Copyright (c) 2024 Renilson Medeiros — MIT License
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const { inquilino_id, valor_novo, percentual, indice } = await req.json();
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { data: inq } = await supabase.from("inquilinos")
      .select("valor_aluguel, nome_completo")
      .eq("id", inquilino_id).single();
    if (!inq) return NextResponse.json({ error: "Inquilino não encontrado" }, { status: 404 });

    const hoje = new Date().toISOString().split("T")[0];

    await supabase.from("historico_reajustes").insert({
      inquilino_id, data_reajuste: hoje,
      valor_anterior: inq.valor_aluguel,
      valor_novo, indice, percentual,
      aplicado_por: session.user.id,
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
