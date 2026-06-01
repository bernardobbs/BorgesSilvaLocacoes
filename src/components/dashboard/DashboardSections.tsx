import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { StatsSkeleton, RevenueSkeleton, AlertsSkeleton, PropertiesSkeleton } from "./DashboardSkeletons";
import RevenueChart from "@/components/dashboard/RevenueChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, TrendingUp, AlertCircle, Clock, Plus } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import CombinedDashboardClient from "./CombinedDashboardClient";
import StatsCards from "./StatsCards";
import OccupancyRateCard from "./OccupancyRateCard";

// --- Stats Section ---
export async function StatsSection({ userId }: { userId: string }) {
    const supabase = await createClient();
    const [imoveisRes, tenantsRes, receiptsRes] = await Promise.all([
        supabase.from('imoveis').select('*', { count: 'exact', head: true }).eq('proprietario_id', userId),
        supabase.from('inquilinos').select('id, imoveis!inner(proprietario_id)', { count: 'exact', head: true })
            .eq('status', 'ativo')
            .eq('imoveis.proprietario_id', userId),
        supabase.from('comprovantes').select('id, imoveis!inner(proprietario_id)', { count: 'exact', head: true })
            .eq('tipo', 'pagamento')
            .eq('imoveis.proprietario_id', userId)
    ]);

    const stats = {
        totalImoveis: imoveisRes.count || 0,
        inquilinosAtivos: tenantsRes.count || 0,
        comprovantesGerados: receiptsRes.count || 0,
    };

    return <StatsCards stats={stats} />;
}


// --- Combined Revenue & Occupancy Section ---
export async function CombinedRevenueOccupancySection({ userId }: { userId: string }) {
    const [revenueData, occupancyData] = await Promise.all([
        fetchRevenueData(userId),
        fetchOccupancyData(userId)
    ]);

    return (
        <CombinedDashboardClient 
            revenueData={revenueData} 
            occupancyData={occupancyData} 
        />
    );
}

// --- Revenue Section (Original Chart) ---
export async function RevenueSection({ userId }: { userId: string }) {
    const revenueData = await fetchRevenueData(userId);

    return (
        <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
                <CardTitle className="font-display text-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    Receita Bruta Mensal
                    {revenueData.length > 0 && (
                        <span className="text-xs font-normal text-muted-foreground bg-accent px-2 py-1 rounded-md w-fit">
                            Últimos 6 meses
                        </span>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
                {revenueData.length > 0 ? (
                    <RevenueChart data={revenueData} />
                ) : (
                    <div className="flex h-[300px] flex-col items-center justify-center text-center mt-4">
                        <TrendingUp className="h-8 w-8 text-muted-foreground/30 mb-2" />
                        <p className="text-sm text-muted-foreground">Sem dados de pagamento para exibir.</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// --- Revenue Trend Section (New Light Alternative) ---
import RevenueTrendCard from "./RevenueTrendCard";

export async function RevenueTrendSection({ userId }: { userId: string }) {
    const revenueData = await fetchRevenueData(userId);
    return <RevenueTrendCard data={revenueData} />;
}

// Helper to fetch and format revenue data
async function fetchRevenueData(userId: string) {
    const supabase = await createClient();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    const dateStr = sixMonthsAgo.toISOString().split('T')[0];

    const { data } = await supabase
        .from('comprovantes')
        .select('valor, mes_referencia, imoveis!inner(proprietario_id)')
        .eq('tipo', 'pagamento')
        .eq('imoveis.proprietario_id', userId)
        .gte('mes_referencia', dateStr)
        .order('mes_referencia', { ascending: true });

    const months: Record<string, number> = {};
    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${monthNames[d.getMonth()]}/${d.getFullYear().toString().slice(-2)}`;
        months[key] = 0;
    }

    data?.forEach((item: any) => {
        const date = new Date(item.mes_referencia);
        if (date >= sixMonthsAgo) {
            const key = `${monthNames[date.getMonth()]}/${date.getFullYear().toString().slice(-2)}`;
            if (months[key] !== undefined) months[key] += Number(item.valor);
        }
    });

    return Object.entries(months).map(([month, total]) => ({ month, total }));
}

async function fetchOccupancyData(userId: string) {
    const supabase = await createClient();
    const { data: imoveis } = await supabase
        .from('imoveis')
        .select('status')
        .eq('proprietario_id', userId);

    const total = imoveis?.length || 0;
    const stats = {
        total,
        alugado: imoveis?.filter(i => i.status === 'alugado').length || 0,
        disponivel: imoveis?.filter(i => i.status === 'disponivel').length || 0,
        manutencao: imoveis?.filter(i => i.status === 'manutencao').length || 0,
        rate: total > 0 ? Math.round((imoveis?.filter(i => i.status === 'alugado').length || 0) / total * 100) : 0
    };

    return stats;
}

// --- Occupancy Rate Section ---
import { ChartPie } from "lucide-react";

export async function OccupancyRateSection({ userId }: { userId: string }) {
    const supabase = await createClient();
    const [imoveisRes, tenantsRes] = await Promise.all([
        supabase.from('imoveis').select('*', { count: 'exact', head: true }).eq('proprietario_id', userId),
        supabase.from('inquilinos').select('id, imoveis!inner(proprietario_id)', { count: 'exact', head: true })
            .eq('status', 'ativo')
            .eq('imoveis.proprietario_id', userId)
    ]);

    const totalImoveis = imoveisRes.count || 0;
    const inquilinosAtivos = tenantsRes.count || 0;
    const occupancyRate = totalImoveis > 0 ? Math.round((inquilinosAtivos / totalImoveis) * 100) : 0;

    return <OccupancyRateCard rate={occupancyRate} />;
}

// --- Alerts Section ---
import AlertsCarousel from "./AlertsCarousel";
import { Button } from "../ui/button";

export async function AlertsSection({ userId }: { userId: string }) {
    const supabase = await createClient();
    const now = new Date();
    const today = now.getDate();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentMonthStart = new Date(currentYear, currentMonth, 1).toISOString();

    const [tenantsRes, receiptsRes] = await Promise.all([
        supabase
            .from('inquilinos')
            .select('id, nome_completo, dia_vencimento, valor_aluguel, multa_percentual, juros_percentual, data_inicio, imoveis!inner (endereco_rua, endereco_numero, titulo, proprietario_id)')
            .eq('status', 'ativo')
            .eq('imoveis.proprietario_id', userId),
        supabase
            .from('comprovantes')
            .select('inquilino_id, situation, imoveis!inner(proprietario_id)')
            .eq('tipo', 'pagamento')
            .eq('imoveis.proprietario_id', userId)
            .gte('mes_referencia', currentMonthStart)
    ]);

    // Apenas 'billed' = pago. 'open' e 'expired' continuam aparecendo nos alertas
    const paidInquilinoIds = new Set(
        receiptsRes.data?.filter((r: any) => r.situation === 'billed').map((r: any) => r.inquilino_id) || []
    );
    const alerts: any[] = [];

    tenantsRes.data?.forEach((tenant: any) => {
        if (paidInquilinoIds.has(tenant.id)) return; // pago = sem alerta

        const dueDay = tenant.dia_vencimento;
        const property = Array.isArray(tenant.imoveis) ? tenant.imoveis[0] : tenant.imoveis;
        const propertyName = property?.titulo || (property ? `${property.endereco_rua}, ${property.endereco_numero}` : 'Imóvel');

        // Calcular dias em atraso
        const venc = new Date(currentYear, currentMonth, dueDay);
        const diasAtraso = Math.max(0, Math.floor((now.getTime() - venc.getTime()) / 86400000));
        const multa = diasAtraso > 0 ? tenant.valor_aluguel * ((tenant.multa_percentual || 10) / 100) : 0;
        const juros = diasAtraso > 0 ? tenant.valor_aluguel * ((tenant.juros_percentual || 1) / 100 / 30) * diasAtraso : 0;
        const totalComEncargos = tenant.valor_aluguel + multa + juros;

        const contractStartDate = tenant.data_inicio ? new Date(tenant.data_inicio + 'T12:00:00') : null;
        if (contractStartDate) {
            const firstDueMonth = contractStartDate.getDate() > dueDay
                ? contractStartDate.getMonth() + 1
                : contractStartDate.getMonth();
            const firstDueYear = firstDueMonth > 11 ? contractStartDate.getFullYear() + 1 : contractStartDate.getFullYear();
            const normalizedFirstDueMonth = firstDueMonth > 11 ? 0 : firstDueMonth;
            if (currentYear < firstDueYear || (currentYear === firstDueYear && currentMonth < normalizedFirstDueMonth)) return;
        }

        // Vencido: dueDay já passou
        if (diasAtraso > 0) {
        }

        // Lógica original de alertas
        if (dueDay < today) {
            alerts.push({ id: `overdue-${tenant.id}`, tenantName: tenant.nome_completo, propertyName, dueDate: dueDay, type: 'overdue', amount: totalComEncargos, diasAtraso });
        } else {
            // Em aberto — sempre mostrar se não pago
            alerts.push({ id: `upcoming-${tenant.id}`, tenantName: tenant.nome_completo, propertyName, dueDate: dueDay, type: 'upcoming', amount: tenant.valor_aluguel, diasAtraso: 0 });
        }
    });

    return <AlertsCarousel alerts={alerts} />;
}

// --- Properties Preview Section ---
import PropertiesPreviewClient from "./PropertiesPreviewClient";

export async function PropertiesPreviewSection({ userId }: { userId: string }) {
    const supabase = await createClient();
    const { data: imoveisRecentes } = await supabase
        .from('imoveis')
        .select('id, endereco_rua, endereco_numero, status, created_at, inquilinos(nome_completo)')
        .eq('proprietario_id', userId)
        .order('created_at', { ascending: false })
        .range(0, 11); 

    const formattedProperties = imoveisRecentes?.map((imovel: any) => ({
        id: imovel.id,
        endereco_rua: imovel.endereco_rua,
        endereco_numero: imovel.endereco_numero,
        status: imovel.status,
        inquilino_nome: imovel.inquilinos?.[0]?.nome_completo || null,
    })) || [];

    return <PropertiesPreviewClient properties={formattedProperties} />;
}

export async function NotificacoesSection({ userId }: { userId: string }) {
    const supabase = await createClient();

    const { data: notificacoes } = await supabase
        .from('notificacoes_pendentes')
        .select('*')
        .eq('proprietario_id', userId);

    const NotificacoesCobranca = (await import('./NotificacoesCobranca')).default;

    return (
        <NotificacoesCobranca
            notificacoes={(notificacoes || []).map((n: any) => ({
                ...n,
                imovel_titulo: n.imovel_titulo,
                dias_atraso: Number(n.dias_atraso),
                valor_total: Number(n.valor_total),
                estagio_atual: Number(n.estagio_atual),
            }))}
            compact={true}
        />
    );
}

export async function DividasExInquilinosSection({ userId }: { userId: string }) {
    const supabase = await createClient();
    const { data } = await supabase
        .from('dividas_ex_inquilinos')
        .select('*')
        .eq('proprietario_id', userId)
        .order('data_desocupacao', { ascending: false });

    if (!data || data.length === 0) return null;

    const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const fmtData = (iso: string | null) => {
        if (!iso) return '—';
        const [y, m, d] = iso.split('-');
        return `${d}/${m}/${y}`;
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Dívidas de ex-inquilinos
                </h3>
                <span className="bg-red-100 text-red-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{data.length}</span>
            </div>
            {data.map((d: any) => (
                <div key={d.id} className="rounded-lg border border-red-200 bg-red-50 p-3">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-sm font-medium text-red-900">{d.nome_completo}</p>
                            <p className="text-xs text-red-600">{d.imovel_titulo} · saiu em {fmtData(d.data_desocupacao)}</p>
                            <p className="text-xs font-bold text-red-800 mt-1">Dívida: {fmtBRL(Number(d.divida_residual))}</p>
                        </div>
                        {d.relatorio_pdf_url && (
                            <a href={d.relatorio_pdf_url} target="_blank" rel="noreferrer"
                                className="text-xs text-red-700 underline whitespace-nowrap">
                                Ver relatório
                            </a>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}
