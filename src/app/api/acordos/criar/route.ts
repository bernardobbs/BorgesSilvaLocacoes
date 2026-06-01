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

    const {
      inquilino_id, imovel_id, valor_original, valor_acordo,
      desconto, num_parcelas, valor_parcela, primeira_parcela,
      meses_cobertos, observacoes
    } = await request.json();

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
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
