// Based on Lugo — Copyright (c) 2024 Renilson Medeiros — MIT License
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import TenantDetailsClient from "./TenantDetailsClient";

export default async function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  const [tenantRes, pagsRes, notifsRes, acordosRes] = await Promise.all([
    supabase.from("inquilinos")
      .select("id, nome_completo, cpf, cnpj, tipo_pessoa, telefone, email, imovel_id, dia_vencimento, data_inicio, data_fim, status, observacoes, valor_aluguel, multa_percentual, juros_percentual, garantia, numero_contrato, imoveis(id, titulo, endereco_rua, endereco_numero, endereco_bairro, endereco_cidade)")
      .eq("id", id).maybeSingle(),
    supabase.from("comprovantes")
      .select("id, mes_referencia, valor, valor_multa, valor_juros, situation, data_vencimento, data_pagamento, forma_pagamento")
      .eq("inquilino_id", id).order("mes_referencia", { ascending: false }),
    supabase.from("notificacoes_cobranca")
      .select("id, estagio, dias_atraso, valor_total, enviado_em, mes_referencia, config_notificacoes(label), profiles(nome_completo)")
      .eq("inquilino_id", id).order("enviado_em", { ascending: false }),
    supabase.from("acordos")
      .select("id, valor_original, valor_acordo, desconto, num_parcelas, valor_parcela, meses_cobertos, status, observacoes, created_at, parcelas_acordo(id, numero, valor, data_vencimento, situation, data_pagamento, forma_pagamento)")
      .eq("inquilino_id", id).order("created_at", { ascending: false }),
  ]);

  if (!tenantRes.data) redirect("/dashboard/inquilinos");

  const tenant = {
    ...tenantRes.data,
    imoveis: Array.isArray(tenantRes.data.imoveis) 
      ? tenantRes.data.imoveis[0] || null 
      : tenantRes.data.imoveis || null,
  };

  return (
    <TenantDetailsClient
      tenant={tenant as any}
      historicoPag={(pagsRes.data || []) as any}
      historicoNotif={(notifsRes.data || []) as any}
      acordos={(acordosRes.data || []) as any}
    />
  );
}
