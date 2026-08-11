// Based on Lugo — Copyright (c) 2024 Renilson Medeiros — MIT License
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { FAMILY_OWNER_ID } from "@/lib/family";
import { z } from "zod";

const acordoSchema = z.object({
  inquilino_id: z.string().uuid(),
  imovel_id: z.string().uuid(),
  valor_original: z.number().positive(),
  valor_acordo: z.number().positive(),
  desconto: z.number().min(0),
  num_parcelas: z.number().int().min(1).max(60),
  valor_parcela: z.number().positive(),
  primeira_parcela: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  meses_cobertos: z.array(z.string()).optional(),
  observacoes: z.string().max(1000).nullable().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const parsed = acordoSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    const {
      inquilino_id, imovel_id, valor_original, valor_acordo,
      desconto, num_parcelas, valor_parcela, primeira_parcela,
      meses_cobertos, observacoes
    } = parsed.data;

    // Verificar ownership do imóvel e que o inquilino pertence a esse imóvel
    const { data: imovelCheck } = await supabase.from("imoveis")
      .select("id").eq("id", imovel_id).eq("proprietario_id", FAMILY_OWNER_ID).single();
    if (!imovelCheck) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

    const { data: inquilinoCheck } = await supabase.from("inquilinos")
      .select("id").eq("id", inquilino_id).eq("imovel_id", imovel_id).single();
    if (!inquilinoCheck) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

    // Criar o acordo
    const { data: acordo, error: eAcordo } = await supabase
      .from("acordos")
      .insert({
        inquilino_id, imovel_id, valor_original, valor_acordo,
        desconto, num_parcelas, valor_parcela, primeira_parcela,
        meses_cobertos, observacoes, criado_por: user.id, status: "ativo",
      })
      .select()
      .single();

    if (eAcordo) throw eAcordo;

    // Criar as parcelas
    const parcelas = Array.from({ length: num_parcelas }, (_, i) => {
      const venc = new Date(primeira_parcela);
      venc.setMonth(venc.getMonth() + i);
      return {
        acordo_id: acordo.id,
        numero: i + 1,
        valor: i === num_parcelas - 1
          ? parseFloat((valor_acordo - valor_parcela * (num_parcelas - 1)).toFixed(2))
          : valor_parcela,
        data_vencimento: venc.toISOString().split("T")[0],
        situation: "open",
      };
    });

    const { error: eParcelas } = await supabase.from("parcelas_acordo").insert(parcelas);
    if (eParcelas) throw eParcelas;

    // Marcar comprovantes originais como cobertos pelo acordo
    if (meses_cobertos?.length) {
      await supabase.from("comprovantes")
        .update({ situation: "open", descricao: `Coberto por acordo ${acordo.id.slice(0,8)}` })
        .eq("inquilino_id", inquilino_id)
        .in("mes_referencia", meses_cobertos)
        .eq("situation", "expired");
    }

    return NextResponse.json({ success: true, acordo_id: acordo.id });
  } catch (e: any) {
    console.error("API error:", e); return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
