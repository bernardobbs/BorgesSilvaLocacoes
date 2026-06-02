// Based on Lugo — Copyright (c) 2024 Renilson Medeiros — MIT License
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import InativosClient from "./InativosClient";

export default async function InativosPage() {
  const supabase = await createClient();
  const { data:{ session } } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  const { data: inativos } = await supabase
    .from("inquilinos")
    .select(`
      id, nome_completo, cpf, cnpj, tipo_pessoa, telefone, email,
      data_inicio, data_fim, data_desocupacao, motivo_encerramento,
      valor_aluguel, divida_residual, relatorio_pdf_url, obs_encerramento,
      garantia, fiador_nome, fiador_cpf, fiador_telefone, numero_contrato,
      imovel_id,
      imoveis!inner (
        id, titulo, endereco_rua, endereco_numero, endereco_bairro,
        endereco_cidade, endereco_estado, proprietario_id
      )
    `)
    .eq("imoveis.proprietario_id", session.user.id)
    .eq("status", "inativo")
    .order("data_desocupacao", { ascending: false });

  // Para cada inativo, buscar comprovantes e notificações
  const ids = (inativos||[]).map((i:any)=>i.id);
  const [compsRes, notifsRes, acordosRes] = await Promise.all([
    ids.length ? supabase.from("comprovantes").select("*").in("inquilino_id", ids).order("mes_referencia") : Promise.resolve({data:[]}),
    ids.length ? supabase.from("notificacoes_cobranca").select("*, profiles(nome_completo), config_notificacoes(label)").in("inquilino_id", ids).order("enviado_em") : Promise.resolve({data:[]}),
    ids.length ? supabase.from("acordos").select("*, parcelas_acordo(*)").in("inquilino_id", ids) : Promise.resolve({data:[]}),
  ]);

  return (
    <InativosClient
      inativos={(inativos||[]) as any}
      comprovantesMap={groupBy(compsRes.data||[], "inquilino_id")}
      notificacoesMap={groupBy(notifsRes.data||[], "inquilino_id")}
      acordosMap={groupBy(acordosRes.data||[], "inquilino_id")}
    />
  );
}

function groupBy(arr: any[], key: string) {
  return arr.reduce((acc, item) => {
    const k = item[key];
    if (!acc[k]) acc[k] = [];
    acc[k].push(item);
    return acc;
  }, {} as Record<string, any[]>);
}
