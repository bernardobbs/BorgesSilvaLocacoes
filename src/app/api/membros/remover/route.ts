// Based on Lugo — Copyright (c) 2024 Renilson Medeiros — MIT License
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { sanitizeSupabaseKey } from "@/lib/supabase/admin";

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

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin") return NextResponse.json({ error: "Apenas administradores podem remover membros" }, { status: 403 });

    const body = await request.json();
    const userId: string = body?.userId;
    if (!userId || typeof userId !== "string" || !/^[0-9a-f-]{36}$/i.test(userId)) {
      return NextResponse.json({ error: "userId inválido" }, { status: 400 });
    }
    if (userId === user.id) return NextResponse.json({ error: "Não é possível remover sua própria conta" }, { status: 400 });

    // Verificar que o usuário alvo pertence à mesma família
    const { data: adminProfile } = await supabase.from("profiles").select("family_owner_id").eq("id", user.id).single();
    const { data: targetProfile } = await supabase.from("profiles").select("family_owner_id").eq("id", userId).single();

    if (!targetProfile) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    if (targetProfile.family_owner_id !== adminProfile?.family_owner_id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    }

    const serviceKey = sanitizeSupabaseKey(process.env.SUPABASE_SERVICE_ROLE_KEY);
    if (!serviceKey) {
      return NextResponse.json({ error: "Configuração do servidor incompleta: SUPABASE_SERVICE_ROLE_KEY ausente." }, { status: 500 });
    }
    const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey);

    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("API error:", e); return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
