// Based on Lugo — Copyright (c) 2024 Renilson Medeiros — MIT License
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient as createAdminClient } from "@supabase/supabase-js";

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

    // Verificar se é admin
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin") return NextResponse.json({ error: "Apenas administradores podem adicionar membros" }, { status: 403 });

    const { email, nome_completo, password, role } = await request.json();
    if (!email || !nome_completo || !password) return NextResponse.json({ error: "Campos obrigatórios faltando" }, { status: 400 });

    // Criar usuário via service role
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: newUser, error: createError } = await admin.auth.admin.createUser({
      email, password,
      user_metadata: { nome_completo, role: role || "operador" },
      email_confirm: true, // confirmar e-mail automaticamente
    });

    if (createError) throw createError;

    // Atualizar role no profile (trigger cria com 'proprietario' por padrão)
    if (newUser.user) {
      await admin.from("profiles").update({ role: role || "operador", nome_completo }).eq("id", newUser.user.id);
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
