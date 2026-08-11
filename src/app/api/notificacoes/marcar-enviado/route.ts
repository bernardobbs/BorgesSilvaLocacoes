// Based on Lugo — Copyright (c) 2024 Renilson Medeiros — MIT License
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { FAMILY_OWNER_ID } from "@/lib/family";
import { z } from "zod";

const schema = z.object({
  inquilino_id: z.string().uuid(),
  imovel_id: z.string().uuid(),
  comprovante_id: z.string().uuid().nullable().optional(),
  estagio: z.number().int().min(1).max(5),
  config_id: z.string().uuid().nullable().optional(),
  dias_atraso: z.number().int().min(0),
  valor_total: z.number().min(0),
  mes_referencia: z.string().regex(/^\d{4}-\d{2}(-\d{2})?$/).nullable().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    const { inquilino_id, comprovante_id, imovel_id, estagio, config_id, dias_atraso, valor_total, mes_referencia } = parsed.data;

    // Verificar ownership do imóvel
    const { data: imovelCheck } = await supabase.from("imoveis")
      .select("id").eq("id", imovel_id).eq("proprietario_id", FAMILY_OWNER_ID).single();
    if (!imovelCheck) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

    // Garantir formato correto da data
    const mesRef = mes_referencia ? String(mes_referencia).slice(0, 10) : null;

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
      return NextResponse.json({ error: "Erro ao registrar notificação" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("API error:", e); return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
