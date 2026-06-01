// Based on Lugo — Copyright (c) 2024 Renilson Medeiros — MIT License
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

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
      inquilino_id, imovel_id, data_desocupacao,
      motivo_encerramento, divida_residual,
      relatorio_pdf_url, obs_encerramento,
    } = await request.json();

    // Marcar inquilino como inativo
    const { error: e1 } = await supabase.from("inquilinos").update({
      status: "inativo", data_desocupacao, motivo_encerramento,
      divida_residual, relatorio_pdf_url,
      obs_encerramento: obs_encerramento || null,
      encerrado_por: user.id,
      data_fim: data_desocupacao,
    }).eq("id", inquilino_id);
    if (e1) throw e1;

    // Liberar imóvel
    const { error: e2 } = await supabase.from("imoveis")
      .update({ status: "disponivel" }).eq("id", imovel_id);
    if (e2) throw e2;

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
