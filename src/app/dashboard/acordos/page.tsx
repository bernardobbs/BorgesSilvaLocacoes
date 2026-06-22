// Based on Lugo — Copyright (c) 2024 Renilson Medeiros — MIT License
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AcordosList from "@/modules/dashboard/AcordosList";
import { FAMILY_OWNER_ID } from '@/lib/family';

export default async function AcordosPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  const { data: acordos } = await supabase
    .from("acordos")
    .select(`
      id, valor_original, valor_acordo, desconto, num_parcelas,
      valor_parcela, primeira_parcela, status, observacoes, created_at,
      inquilinos!inner (id, nome_completo, telefone, imovel_id,
        imoveis!inner (id, titulo, proprietario_id)
      ),
      parcelas_acordo (id, numero, valor, data_vencimento, situation, data_pagamento, forma_pagamento)
    `)
    .eq('inquilinos.imoveis.proprietario_id', FAMILY_OWNER_ID)
    .order("created_at", { ascending: false });

  return <AcordosList acordos={(acordos || []) as any} />;
}
