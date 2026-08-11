// Based on Lugo — Copyright (c) 2024 Renilson Medeiros — MIT License
// Rota de keepalive — evita que o Supabase pause por inatividade (free tier)
// Chamada pelo cron-job.org a cada 3 dias
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Proteger com token secreto — cron externo deve enviar ?token=KEEPALIVE_SECRET
  const token = request.nextUrl.searchParams.get("token");
  const secret = process.env.KEEPALIVE_SECRET;
  if (!secret || token !== secret) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const supabase = await createClient();

    // Query simples que mantém o banco ativo
    const { error } = await supabase
      .from("config_sistema")
      .select("chave")
      .limit(1);

    if (error) {
      return NextResponse.json(
        { status: "error", message: error.message, timestamp: new Date().toISOString() },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: "ok",
      message: "Supabase ativo — Borges Silva Locações",
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { status: "error", message: err.message, timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
