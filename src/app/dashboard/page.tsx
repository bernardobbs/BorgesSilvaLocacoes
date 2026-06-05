// Based on Lugo — Copyright (c) 2024 Renilson Medeiros — MIT License
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import DashboardClientShell from "./DashboardClientShell";
import NovoDashboard from "@/components/dashboard/NovoDashboard";
import {
  NotificacoesSection,
  DividasExInquilinosSection,
} from "@/components/dashboard/DashboardSections";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const hoje = new Date();
  const mesInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split("T")[0];
  const proximos7 = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 7).toISOString().split("T")[0];

  const [
    inquilinosRes,
    compMesRes,
    imoveisRes,
    acordosRes,
    notifPendentesRes,
  ] = await Promise.all([
    // Inquilinos ativos com imóvel
    supabase.from("inquilinos")
      .select("id, nome_completo, telefone, valor_aluguel, dia_vencimento, multa_percentual, juros_percentual, imovel_id, data_inicio, data_ultimo_reajuste, indice_reajuste, imoveis!inner(id, titulo, do_center, proprietario_id)")
      .eq("imoveis.proprietario_id", user.id)
      .eq("status", "ativo"),

    // Comprovantes do mês atual
    supabase.from("comprovantes")
      .select("id, inquilino_id, valor, valor_multa, valor_juros, situation, data_vencimento, data_pagamento")
      .eq("imoveis.proprietario_id", user.id)
      .gte("mes_referencia", mesInicio)
      .select("id, inquilino_id, valor, valor_multa, valor_juros, situation, data_vencimento, data_pagamento, imoveis!inner(proprietario_id)"),

    // Imóveis (ocupação)
    supabase.from("imoveis")
      .select("id, titulo, status, do_center, numero_unidade, endereco_rua, endereco_numero")
      .eq("proprietario_id", user.id),

    // Acordos ativos
    supabase.from("acordos")
      .select("id, valor_acordo, num_parcelas, status, inquilinos!inner(id, nome_completo, imoveis!inner(titulo, proprietario_id)), parcelas_acordo(id, numero, valor, data_vencimento, situation)")
      .eq("status", "ativo")
      .eq("inquilinos.imoveis.proprietario_id", user.id),

    // Notificações pendentes
    supabase.from("notificacoes_pendentes")
      .select("*")
      .eq("proprietario_id", user.id),
  ]);

  return (
    <div className="space-y-6 p-6">
      <DashboardClientShell />
      <NovoDashboard
        userId={user.id}
        inquilinos={(inquilinosRes.data || []) as any}
        compMes={(compMesRes.data || []) as any}
        imoveis={(imoveisRes.data || []) as any}
        acordos={(acordosRes.data || []) as any}
        notificacoes={(notifPendentesRes.data || []) as any}
      />
      <DividasExInquilinosSection userId={user.id} />
    </div>
  );
}
