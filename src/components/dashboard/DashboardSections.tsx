import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, AlertCircle } from "lucide-react";

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
