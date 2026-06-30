// Based on Lugo — Copyright (c) 2024 Renilson Medeiros — MIT License
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import CobrancasClient from "./CobrancasClient";
import { FAMILY_OWNER_ID } from '@/lib/family';

export default async function CobrancasPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  const { data: pendentes } = await supabase
    .from("notificacoes_pendentes")
    .select("*")
    .eq('proprietario_id', FAMILY_OWNER_ID);

  // T3.1 — datas corretas calculadas dinamicamente pela VIEW
  const { data: pendentesView } = await supabase
    .from("v_cobrancas_pendentes")
    .select("inquilino_id, nome_completo, imovel_id, titulo, comprovante_id, mes_referencia, valor, data_vencimento, dias_atraso, estagio_cobranca");

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
    .eq('inquilinos.imoveis.proprietario_id', FAMILY_OWNER_ID)
    .order("enviado_em", { ascending: false });

  return <CobrancasClient cobrancas={(cobrancas || []) as any} pendentes={(pendentes || []) as any} pendentesView={(pendentesView || []) as any} />;
}
