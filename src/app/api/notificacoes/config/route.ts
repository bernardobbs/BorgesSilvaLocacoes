// Based on Lugo — Copyright (c) 2024 Renilson Medeiros — MIT License
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: (c) => c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } }
  );
}

export async function GET() {
  const supabase = await getSupabase();
  const { data } = await supabase.from("config_notificacoes")
    .select("*").order("ordem");
  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await request.json();
  const { action, id, ordem, dias_atraso, label, mensagem_template, ativo } = body;

  if (action === "create") {
    const { data, error } = await supabase.from("config_notificacoes")
      .insert({ ordem, dias_atraso, label, mensagem_template, ativo: true })
      .select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data });
  }

  if (action === "update") {
    const { error } = await supabase.from("config_notificacoes")
      .update({ dias_atraso, label, mensagem_template, ativo })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  }

  if (action === "delete") {
    // Verificar mínimo de 2 estágios
    const { count } = await supabase.from("config_notificacoes")
      .select("*", { count: "exact", head: true }).eq("ativo", true);
    if ((count || 0) <= 2)
      return NextResponse.json({ error: "Mínimo de 2 estágios ativos" }, { status: 400 });
    await supabase.from("config_notificacoes").delete().eq("id", id);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
}
