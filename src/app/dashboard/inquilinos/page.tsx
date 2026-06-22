import { createClient } from "@/lib/supabase/server";
import TenantsList from "@/modules/dashboard/TenantsList";
import { redirect } from "next/navigation";
import { FAMILY_OWNER_ID } from '@/lib/family';

export default async function TenantsListPage() {
    const supabase = await createClient();

    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        redirect("/login");
    }

    // Carregar dados iniciais no servidor
    const { data, error: fetchError } = await supabase
        .from('inquilinos')
        .select(`
            id,
            nome_completo,
            cpf,
            telefone,
            email,
            imovel_id,
            dia_vencimento,
            data_inicio,
            data_fim,
            status,
            imoveis!inner (
                titulo,
                endereco_rua,
                endereco_numero,
                proprietario_id
            )
        `)
        .eq('imoveis.proprietario_id', FAMILY_OWNER_ID)
        .order('nome_completo', { ascending: true })
        .limit(50);

    if (fetchError) {
        console.error('Erro ao carregar inquilinos no servidor:', fetchError);
    }

    // Transformar dados para corresponder à interface
    const transformedData = (data || []).map((item: any) => ({
        ...item,
        imoveis: Array.isArray(item.imoveis)
            ? (item.imoveis.length > 0 ? item.imoveis[0] : null)
            : (item.imoveis || null)
    }));

    // Buscar scores
    const { data: scores } = await supabase
        .from('score_inquilinos')
        .select('inquilino_id, score, score_label, pontos, total_meses, pagos_em_dia, vencidos, total_notificacoes, total_acordos');

    const scoresMap = Object.fromEntries(
        (scores || []).map((s: any) => [s.inquilino_id, s])
    );

    return <TenantsList initialData={transformedData} initialLoading={false} scoresMap={scoresMap} />;
}
