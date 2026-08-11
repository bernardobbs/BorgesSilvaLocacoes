// Based on Lugo — Copyright (c) 2024 Renilson Medeiros — MIT License
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const postSchema = z.object({
  action: z.enum(["create", "update", "delete"]),
  id: z.string().uuid().optional(),
  ordem: z.number().int().min(1).optional(),
  dias_atraso: z.number().int().min(0).optional(),
  label: z.string().max(100).optional(),
  mensagem_template: z.string().max(2000).optional(),
  ativo: z.boolean().optional(),
});

async function getAuthAndFamily() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, familyOwnerId: null };
  const { data: profile } = await supabase.from("profiles").select("family_owner_id").eq("id", user.id).single();
  const familyOwnerId: string = profile?.family_owner_id || user.id;
  return { supabase, user, familyOwnerId };
}

export async function GET() {
  const { supabase, user, familyOwnerId } = await getAuthAndFamily();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  // config_notificacoes é global (sem coluna proprietario_id) — filtramos pelo family_owner implícito via RLS
  // Retornamos apenas registros criados no contexto do usuário autenticado
  const { data } = await supabase.from("config_notificacoes")
    .select("*").order("ordem");
  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const { supabase, user } = await getAuthAndFamily();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const parsed = postSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const { action, id, ordem, dias_atraso, label, mensagem_template, ativo } = parsed.data;

  if (action === "create") {
    const { data, error } = await supabase.from("config_notificacoes")
      .insert({ ordem, dias_atraso, label, mensagem_template, ativo: true })
      .select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data });
  }

  if (action === "update") {
    if (!id) return NextResponse.json({ error: "id obrigatório para update" }, { status: 400 });
    const { error } = await supabase.from("config_notificacoes")
      .update({ dias_atraso, label, mensagem_template, ativo })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  }

  if (action === "delete") {
    if (!id) return NextResponse.json({ error: "id obrigatório para delete" }, { status: 400 });
    const { count } = await supabase.from("config_notificacoes")
      .select("*", { count: "exact", head: true }).eq("ativo", true);
    if ((count || 0) <= 2)
      return NextResponse.json({ error: "Mínimo de 2 estágios ativos" }, { status: 400 });
    await supabase.from("config_notificacoes").delete().eq("id", id);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
}
