// Based on Lugo — Copyright (c) 2024 Renilson Medeiros — MIT License
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { sanitizeSupabaseKey } from "@/lib/supabase/admin";

// Detecta caracteres não-ASCII que podem quebrar headers HTTP
function sanitizeAscii(s: string): string {
  return s.normalize("NFKD").replace(/[^\x20-\x7E]/g, "");
}

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
    if (profile?.role !== "admin") return NextResponse.json({ error: "Apenas administradores podem adicionar membros" }, { status: 403 });

    const body = await request.json();
    let { email, nome_completo, password, role } = body;

    if (!email || !nome_completo || !password) {
      return NextResponse.json({ error: "Campos obrigatórios faltando" }, { status: 400 });
    }

    // Sanitizar email e password: só ASCII permitido (HTTP headers ByteString)
    const emailLimpo = sanitizeAscii(String(email).trim());
    const passwordLimpa = sanitizeAscii(String(password));

    if (emailLimpo !== email.trim()) {
      return NextResponse.json({
        error: "O e-mail contém caracteres especiais não permitidos (acentos, traços longos, etc). Use apenas letras ASCII, números e símbolos comuns (@.-_)."
      }, { status: 400 });
    }

    if (passwordLimpa !== password) {
      return NextResponse.json({
        error: "A senha contém caracteres especiais não permitidos (acentos, traços longos —, aspas curvas, etc). Use apenas letras, números e símbolos ASCII comuns."
      }, { status: 400 });
    }

    // nome_completo pode ter acentos — é só user_metadata (vai no corpo), mantém como veio
    nome_completo = String(nome_completo).trim();

    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      sanitizeSupabaseKey(process.env.SUPABASE_SERVICE_ROLE_KEY)
    );

    const { data: newUser, error: createError } = await admin.auth.admin.createUser({
      email: emailLimpo,
      password: passwordLimpa,
      user_metadata: { nome_completo, role: role || "operador" },
      email_confirm: true,
    });

    if (createError) {
      console.error("[membros/criar] createUser error:", createError);
      throw createError;
    }

    if (newUser.user) {
      await admin.from("profiles").update({ role: role || "operador", nome_completo }).eq("id", newUser.user.id);
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("[membros/criar] caught:", e?.message, e);
    return NextResponse.json({ error: e?.message || "Erro desconhecido" }, { status: 500 });
  }
}
