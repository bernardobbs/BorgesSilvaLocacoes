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

    const { inquilino_id, comprovante_id, imovel_id, estagio, config_id, dias_atraso, valor_total, mes_referencia } = await request.json();

    // Garantir formato correto da data
    const mesRef = mes_referencia
      ? String(mes_referencia).slice(0, 10)  // YYYY-MM-DD
      : null;

    const { error: insertError } = await supabase.from("notificacoes_cobranca").insert({
      inquilino_id,
      comprovante_id: comprovante_id || null,
      imovel_id,
      estagio: Number(estagio) || 1,
      config_id: config_id || null,
      dias_atraso: Number(dias_atraso) || 0,
      valor_total: Number(valor_total) || 0,
      mes_referencia: mesRef,
      enviado_por: user.id,
    });

    if (insertError) {
      console.error("Erro ao salvar notificação:", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
