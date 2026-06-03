// Based on Lugo — Copyright (c) 2024 Renilson Medeiros — MIT License
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import CobrancasClient from "./CobrancasClient";

export default async function CobrancasPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  const { data: cobrancas } = await supabase
    .from("notificacoes_cobranca")
    .select(`
      id, estagio, dias_atraso, valor_total, enviado_em, mes_referencia,
      config_notificacoes (label, dias_atraso),
      profiles (nome_completo),
      inquilinos!inner (
        id, nome_completo, telefone,
        imoveis!inner (titulo, proprietario_id)
      )
    `)
    .eq("inquilinos.imoveis.proprietario_id", session.user.id)
    .order("enviado_em", { ascending: false });

  return <CobrancasClient cobrancas={(cobrancas || []) as any} />;
}
