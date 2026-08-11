// Based on Lugo — Copyright (c) 2024 Renilson Medeiros — MIT License
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { sanitizeSupabaseKey } from "@/lib/supabase/admin";

// Detecta caracteres não-ASCII que podem quebrar headers HTTP
function sanitizeAscii(s: string): string {
  return s.normalize("NFKD").replace(/[^\x20-\x7E]/g, "");
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin") return NextResponse.json({ error: "Apenas administradores podem adicionar membros" }, { status: 403 });

    const body = await request.json();
    const ROLES_PERMITIDOS = ["operador", "admin"] as const;
    let { email, nome_completo, password, role } = body;
    if (role && !ROLES_PERMITIDOS.includes(role)) {
      return NextResponse.json({ error: "Role inválido. Valores permitidos: operador, admin" }, { status: 400 });
    }

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

    const serviceKey = sanitizeSupabaseKey(process.env.SUPABASE_SERVICE_ROLE_KEY);
    if (!serviceKey) {
      return NextResponse.json({ error: "Configuração do servidor incompleta: SUPABASE_SERVICE_ROLE_KEY ausente." }, { status: 500 });
    }
    const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey);

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
      const { data: adminProfile } = await supabase.from("profiles").select("family_owner_id").eq("id", user.id).single();
      const familyOwnerId = adminProfile?.family_owner_id || user.id;
      await admin.from("profiles")
        .update({ role: role || "operador", nome_completo, family_owner_id: familyOwnerId })
        .eq("id", newUser.user.id);
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("[membros/criar] caught:", e?.message, e);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
