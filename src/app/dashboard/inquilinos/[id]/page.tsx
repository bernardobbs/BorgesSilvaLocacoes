"use client";

import TenantDetails from "@/modules/dashboard/TenantDetails";

export default function TenantDetailPage() {
      const { data: historico_notif } = await supabase
    .from("notificacoes_cobranca")
    .select("id, estagio, dias_atraso, valor_total, enviado_em, mes_referencia, config_id, config_notificacoes(label)")
    .eq("inquilino_id", id)
    .order("enviado_em", { ascending: false });

  return <TenantDetails />;
}
