// Based on Lugo — Copyright (c) 2024 Renilson Medeiros — MIT License
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const schema = z.object({
  inquilino_id: z.string().uuid(),
  imovel_id: z.string().uuid(),
  data_desocupacao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  motivo_encerramento: z.string().max(100).optional(),
  divida_residual: z.number().min(0).optional(),
  divida_liquida: z.number().min(0).optional(),
  vistoria_danos: z.number().min(0).optional(),
  vistoria_descricao: z.string().max(1000).nullable().optional(),
  garantia_executada: z.number().min(0).optional(),
  garantia_obs: z.string().max(500).nullable().optional(),
  relatorio_pdf_url: z.string().url().nullable().optional(),
  obs_encerramento: z.string().max(1000).nullable().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

    const {
      inquilino_id, imovel_id, data_desocupacao,
      motivo_encerramento, divida_residual, divida_liquida,
      vistoria_danos, vistoria_descricao,
      garantia_executada, garantia_obs,
      relatorio_pdf_url, obs_encerramento,
    } = parsed.data;

    // Verificar que o inquilino e o imóvel pertencem à família do usuário autenticado
    const { data: profile } = await supabase.from("profiles").select("family_owner_id").eq("id", user.id).single();
    const familyOwnerId = profile?.family_owner_id || user.id;

    const { data: inq } = await supabase.from("inquilinos")
      .select("id, imoveis!inner(proprietario_id)")
      .eq("id", inquilino_id).single();
    const imovelInq = Array.isArray((inq as any)?.imoveis) ? (inq as any).imoveis[0] : (inq as any)?.imoveis;
    if (!inq || imovelInq?.proprietario_id !== familyOwnerId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    }

    // Verificar que o imóvel também pertence à família
    const { data: imv } = await supabase.from("imoveis").select("proprietario_id").eq("id", imovel_id).single();
    if (!imv || imv.proprietario_id !== familyOwnerId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    }

    // Marcar inquilino como inativo
    const { error: e1 } = await supabase.from("inquilinos").update({
      status: "inativo", data_desocupacao, motivo_encerramento,
      divida_residual, divida_liquida: divida_liquida || divida_residual,
      vistoria_danos: vistoria_danos || 0,
      vistoria_descricao: vistoria_descricao || null,
      garantia_executada: garantia_executada || 0,
      garantia_obs: garantia_obs || null,
      relatorio_pdf_url,
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
