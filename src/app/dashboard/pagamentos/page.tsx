// Based on Lugo — Copyright (c) 2024 Renilson Medeiros — MIT License
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import PagamentosList from "@/modules/dashboard/PagamentosList";

export default async function PagamentosPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  // Buscar todos os inquilinos ativos com imóvel
  const { data: inquilinos } = await supabase
    .from("inquilinos")
    .select(`
      id, nome_completo, cpf, cnpj, tipo_pessoa, telefone,
      valor_aluguel, dia_vencimento, multa_percentual, juros_percentual,
      imovel_id,
      imoveis!inner (
        id, titulo, endereco_rua, endereco_numero, proprietario_id
      )
    `)
    .eq("imoveis.proprietario_id", session.user.id)
    .eq("status", "ativo")
    .order("nome_completo");

  // Buscar comprovantes dos últimos 6 meses
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const { data: comprovantes } = await supabase
    .from("comprovantes")
    .select(`
      id, inquilino_id, imovel_id, mes_referencia, valor, valor_multa,
      valor_juros, situation, data_vencimento, data_pagamento,
      forma_pagamento, pdf_url, descricao, created_at,
      imoveis!inner (proprietario_id)
    `)
    .eq("imoveis.proprietario_id", session.user.id)
    .gte("mes_referencia", sixMonthsAgo.toISOString().split("T")[0])
    .order("mes_referencia", { ascending: false });

  // Buscar notificações pendentes
  const { data: notificacoes } = await supabase
    .from("notificacoes_pendentes")
    .select("*")
    .eq("proprietario_id", session.user.id);

  const notifs = (notificacoes || []).map((n: any) => ({
    ...n,
    imovel_titulo: n.imovel_titulo,
    dias_atraso: Number(n.dias_atraso),
    valor_total: Number(n.valor_total),
    estagio_atual: Number(n.estagio_atual),
  }));

  // Buscar acordos ativos com parcelas
  const { data: acordosAtivos } = await supabase
    .from("acordos")
    .select(`
      id, valor_acordo, num_parcelas, status, observacoes,
      inquilinos!inner (
        id, nome_completo, telefone, imovel_id,
        imoveis!inner (id, titulo, proprietario_id)
      ),
      parcelas_acordo (
        id, numero, valor, data_vencimento, situation, data_pagamento, forma_pagamento
      )
    `)
    .eq("status", "ativo")
    .eq("inquilinos.imoveis.proprietario_id", session.user.id);

  // IDs dos inquilinos com acordo ativo — para marcar na lista principal
  const inquilinosComAcordo = new Set(
    (acordosAtivos || []).map((a: any) => {
      const inq = Array.isArray(a.inquilinos) ? a.inquilinos[0] : a.inquilinos;
      return inq?.id;
    }).filter(Boolean)
  );

  return (
    <PagamentosList acordosAtivos={(acordosAtivos || []) as any} inquilinosComAcordo={inquilinosComAcordo}
        notificacoes={notifs}
      initialInquilinos={(inquilinos || []).map((i: any) => ({
        ...i,
        imoveis: Array.isArray(i.imoveis) ? i.imoveis[0] : i.imoveis,
      }))}
      initialComprovantes={comprovantes || []}
      userId={session.user.id}
    />
  );
}
