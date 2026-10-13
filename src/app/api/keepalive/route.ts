// Based on Lugo — Copyright (c) 2024 Renilson Medeiros — MIT License
// Rota de keepalive — evita que o Supabase pause por inatividade (free tier)
// Chamada pelo cron-job.org a cada 3 dias
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Proteger com token secreto — cron externo deve enviar ?token=KEEPALIVE_SECRET
  const token = request.nextUrl.searchParams.get("token");
  const secret = process.env.KEEPALIVE_SECRET;
  if (!secret || token !== secret) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    // O cron chama esta rota sem sessão, então o cliente de servidor agiria
    // como `anon`. Isso obrigava config_sistema a manter GRANT para anon — a
    // chave pública embarcada no bundle do cliente —, deixando a tabela
    // acessível a qualquer um com a URL do projeto. Usando a service role, a
    // tabela pode ser trancada (REVOKE anon + RLS) sem quebrar o keepalive.
    // A rota já falha fechada acima quando KEEPALIVE_SECRET não confere.
    const supabase = createAdminClient();

    // Query simples que mantém o banco ativo
    const { error } = await supabase
      .from("config_sistema")
      .select("chave")
      .limit(1);

    if (error) {
      console.error("[keepalive] DB error:", error.message);
      return NextResponse.json(
        { status: "error", timestamp: new Date().toISOString() },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: "ok",
      message: "Supabase ativo — Borges Silva Locações",
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[keepalive] error:", err);
    return NextResponse.json(
      { status: "error", timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
