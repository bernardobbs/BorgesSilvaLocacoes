"use client";

// src/modules/dashboard/TenantDetails.tsx
import EncerrarContratoModal from "@/components/dashboard/EncerrarContratoModal";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  User,
  Phone,
  Mail,
  Building2,
  Calendar,
  Receipt,
  Edit,
  UserMinus,
  ArrowLeft,
  Loader2,
  AlertCircle,
  FileText
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useFormFormatting } from "@/lib/hooks/useFormFormatting";

interface TenantData {
  id: string;
  nome_completo: string;
  cpf: string;
  cnpj?: string;
  rg?: string;
  tipo_pessoa?: string;
  telefone: string;
  email: string | null;
  imovel_id: string;
  dia_vencimento: number;
  data_inicio: string;
  data_fim: string | null;
  status: 'ativo' | 'inativo';
  observacoes: string | null;
  valor_aluguel?: number;
  multa_percentual?: number;
  juros_percentual?: number;
  garantia?: string;
  numero_contrato?: string;
  imoveis: {
    id: string;
    titulo: string;
    endereco_rua: string;
    endereco_numero: string;
    endereco_bairro: string;
    endereco_cidade: string;
    proprietario_id: string;
  } | null;
}

interface Comprovante {
  id: string;
  mes: number;
  ano: number;
  valor_pago: number;
  data_pagamento: string;
  created_at: string;
}

export default function TenantDetails() {
  const router = useRouter();
  const params = useParams();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const { formatarCPF, formatarTelefone, formatarMoeda } = useFormFormatting();

  const [tenant, setTenant] = useState<TenantData | null>(null);
  const [comprovantes, setComprovantes] = useState<Comprovante[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTerminateDialog, setShowTerminateDialog] = useState(false);
  const [historicoNotif, setHistoricoNotif] = useState<any[]>([]);
  const [historicoPag, setHistoricoPag] = useState<any[]>([]);
  const [acordos, setAcordos] = useState<any[]>([]);
  const [isTerminating, setIsTerminating] = useState(false);
  const [encerrarOpen, setEncerrarOpen] = useState(false);

  useEffect(() => {
    if (id) {
      loadTenantData();
      loadHistoricoPag();
      loadHistoricoNotif();
      loadAcordos();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadAcordos = async () => {
    if (!id) return;
    try {
    const { data } = await supabase
      .from("acordos")
      .select("id, valor_original, valor_acordo, desconto, num_parcelas, valor_parcela, status, observacoes, created_at, parcelas_acordo(id, numero, valor, data_vencimento, situation, data_pagamento, forma_pagamento)")
      .eq("inquilino_id", id)
      .order("created_at", { ascending: false });
    setAcordos(data || []);
    } catch(e) { console.error("loadAcordos:", e); }
  };

  const loadHistoricoPag = async () => {
    if (!id) return;
    const { data } = await supabase
      .from("comprovantes")
      .select("id, mes_referencia, valor, valor_multa, valor_juros, situation, data_vencimento, data_pagamento, forma_pagamento")
      .eq("inquilino_id", id)
      .order("mes_referencia", { ascending: false });
    setHistoricoPag(data || []);
  };

  const loadHistoricoNotif = async () => {
    if (!id) return;
    const { data } = await supabase
      .from("notificacoes_cobranca")
      .select("id, estagio, dias_atraso, valor_total, enviado_em, mes_referencia, config_id, config_notificacoes(label), profiles(nome_completo)")
      .eq("inquilino_id", id)
      .order("enviado_em", { ascending: false });
    setHistoricoNotif(data || []);
  };

  const loadTenantData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Carregar dados do inquilino
      const { data: tenantData, error: tenantError } = await supabase
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
          observacoes,
          valor_aluguel,
          multa_percentual,
          juros_percentual,
          garantia,
          numero_contrato,
          imoveis (
            id,
            titulo,
            endereco_rua,
            endereco_numero,
            endereco_bairro,
            endereco_cidade,
            proprietario_id
          )
        `)
        .eq('id', id)
        .maybeSingle();

      if (tenantError) throw new Error(`DB error: ${tenantError.code} — ${tenantError.message} — ${tenantError.details}`);
      if (!tenantData) throw new Error(`Inquilino não encontrado. ID: ${id}`);

      const transformedData = {
        ...tenantData,
        imoveis: Array.isArray(tenantData.imoveis)
          ? (tenantData.imoveis.length > 0 ? tenantData.imoveis[0] : null)
          : (tenantData.imoveis || null)
      } as TenantData;

      setTenant(transformedData);

      // Carregar comprovantes
      const { data: comprovantesData, error: comprovantesError } = await supabase
        .from('comprovantes')
        .select('id, mes_referencia, valor, valor_multa, valor_juros, situation, data_vencimento, data_pagamento, forma_pagamento, created_at')
        .eq('inquilino_id', id)
        .order('created_at', { ascending: false })
        .limit(12);

      if (comprovantesError) {
        console.error('Erro ao carregar comprovantes:', comprovantesError);
        // Não lançar erro, apenas deixar vazio
        setComprovantes([]);
      } else {
        // Transformar os dados para o formato esperado
        const transformedComprovantes = (comprovantesData || []).map(comp => {
          let mes = 0;
          let ano = 0;

          if (comp.mes_referencia) {
            if (comp.mes_referencia.includes('/')) {
              const parts = comp.mes_referencia.split('/');
              mes = parseInt(parts[0]);
              ano = parseInt(parts[1]);
            } else if (comp.mes_referencia.includes('-')) {
              // Assume YYYY-MM-DD or YYYY-MM
              const date = new Date(comp.mes_referencia);
              if (!isNaN(date.getTime())) {
                mes = date.getMonth() + 1; // getMonth is 0-indexed
                ano = date.getFullYear();
              } else {
                 // Try explicit split if YYYY-MM
                 const parts = comp.mes_referencia.split('-');
                 if (parts.length >= 2) {
                     ano = parseInt(parts[0]);
                     mes = parseInt(parts[1]);
                 }
              }
            } else {
                // Try parsing as date object directly
                 const date = new Date(comp.mes_referencia);
                 if (!isNaN(date.getTime())) {
                    mes = date.getMonth() + 1;
                    ano = date.getFullYear();
                 }
            }
          }

          return {
            id: comp.id,
            mes: mes || 0,
            ano: ano || 0,
            valor_pago: comp.valor || 0,
            data_pagamento: comp.created_at,
            created_at: comp.created_at
          };
        });
        setComprovantes(transformedComprovantes);
      }
    } catch (err: any) {
      console.error('Erro ao carregar dados:', err);
      const msg = err?.message || err?.details || JSON.stringify(err) || 'Erro desconhecido';
      setError(msg);
      toast.error('Erro ao carregar dados');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTerminateLease = async () => {
    if (!tenant) return;

    try {
      setIsTerminating(true);

      // Deletar PDFs dos comprovantes
      const { data: comprovantes } = await supabase
        .from('comprovantes')
        .select('pdf_url')
        .eq('inquilino_id', tenant.id);

      if (comprovantes && comprovantes.length > 0) {
        const pdfPaths = comprovantes
          .filter(c => c.pdf_url)
          .map(c => {
            const url = new URL(c.pdf_url!);
            const pathParts = url.pathname.split('/');
            const bucketIndex = pathParts.findIndex(p => p === 'imoveis-fotos');
            return pathParts.slice(bucketIndex + 1).join('/');
          });

        if (pdfPaths.length > 0) {
          await supabase.storage
            .from('imoveis-fotos')
            .remove(pdfPaths);
        }
      }

      // Deletar comprovantes
      await supabase.from('comprovantes').delete().eq('inquilino_id', tenant.id);

      // Inativar inquilino
      const { error: tenantError } = await supabase
        .from('inquilinos')
        .update({
          status: 'inativo',
          data_fim: new Date().toISOString().split('T')[0]
        })
        .eq('id', tenant.id);

      // Atualizar imóvel para disponível
      const { error: propertyError } = await supabase
        .from('imoveis')
        .update({ status: 'disponivel' })
        .eq('id', tenant.imovel_id);

      if (propertyError) throw propertyError;

      toast.success('Locação finalizada com sucesso!');
      router.push('/dashboard/inquilinos');
    } catch (error) {
      console.error('Erro ao finalizar locação:', error);
      toast.error('Erro ao finalizar locação');
    } finally {
      setIsTerminating(false);
      setShowTerminateDialog(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const getMonthName = (month: number) => {
    const months = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return months[month - 1];
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-tertiary mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando dados...</p>
        </div>
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <Card className="py-12">
        <CardContent className="flex flex-col items-center justify-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
          <h3 className="mt-4 font-display text-lg font-semibold">Erro ao carregar dados</h3>
          <p className="mt-1 text-sm text-muted-foreground">{error || 'Inquilino não encontrado'}</p>
          <p className="mt-1 text-xs text-muted-foreground">ID: {id}</p>
          <Button onClick={() => router.back()} variant="outline" className="mt-4">
            Voltar
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0"
              onClick={() => router.back()}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="font-display text-2xl font-bold sm:text-3xl">Detalhes do Inquilino</h1>
              <p className="text-muted-foreground">Informações completas e histórico</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Link href={`/dashboard/inquilinos/${tenant.id}/editar`}>
              <Button variant="outline" className="gap-2">
                <Edit className="h-4 w-4" />
                Editar
              </Button>
            </Link>
            {tenant.status === 'ativo' && (
              <Button
                variant="outline"
                className="gap-2 text-orange-600 border-orange-600 hover:bg-orange-50"
                onClick={() => setEncerrarOpen(true)}
              >
                <UserMinus className="h-4 w-4" />
                Finalizar Locação
              </Button>
            )}
          </div>
        </div>

        {/* Informações Principais */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-tertiary" />
                Informações Pessoais
              </CardTitle>
              <Badge
                    variant="outline"
                    className={`hidden md:inline-block ${
                      tenant.status === 'ativo'
                        ? 'bg-green-50 text-green-500 border-green-200'
                        : 'bg-red-50 text-red-500 border-red-200'
                    }`}
                  >
                    {tenant.status === 'ativo' ? 'Ativo' : 'Inativo'}
                  </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-baseline justify-between md:justify-start gap-4">
                <div>
                  <p className="text-sm font-medium text-secondary">Nome Completo</p>
                  <p className="text-sm text-muted-foreground">{tenant.nome_completo}</p>
                </div>
                
                <div>
                  <Badge
                    variant="outline"
                    className={`inline-block md:hidden ${
                      tenant.status === 'ativo'
                        ? 'bg-green-50 text-green-500 border-green-200'
                        : 'bg-red-50 text-red-500 border-red-200'
                    }`}
                  >
                    {tenant.status === 'ativo' ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-secondary">CPF</p>
                <p className="text-sm text-muted-foreground">{formatarCPF(tenant.cpf)}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-secondary">Telefone</p>
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Phone className="h-4 w-4 text-tertiary" />
                  {formatarTelefone(tenant.telefone)}
                </p>
              </div>
              {tenant.email && (
                <div>
                  <p className="text-sm font-medium text-secondary">E-mail</p>
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Mail className="h-4 w-4 text-tertiary" />
                    {tenant.email}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Informações do Imóvel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-tertiary" />
              Imóvel
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {tenant.imoveis ? (
              <>
                <div>
                  <p className="text-sm font-medium text-secondary">Título</p>
                  <p className="text-sm text-muted-foreground">{tenant.imoveis.titulo}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-secondary">Endereço</p>
                  <p className="text-sm text-muted-foreground">
                    {tenant.imoveis.endereco_rua}, {tenant.imoveis.endereco_numero} - {tenant.imoveis.endereco_bairro}, {tenant.imoveis.endereco_cidade}
                  </p>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground">Imóvel não encontrado</p>
            )}
          </CardContent>
        </Card>

        {/* Informações da Locação */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-tertiary" />
              Informações da Locação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-sm font-medium text-secondary">Data de Início</p>
                <p className="text-sm text-muted-foreground">{formatDate(tenant.data_inicio)}</p>
              </div>
              {tenant.data_fim && (
                <div>
                  <p className="text-sm font-medium text-secondary">Data de Término</p>
                  <p className="text-sm text-muted-foreground">{formatDate(tenant.data_fim)}</p>
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-secondary">Dia de Vencimento</p>
                <p className="text-sm text-muted-foreground">Dia {tenant.dia_vencimento}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Observações */}
        {tenant.observacoes && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-tertiary" />
                Observações
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
                {tenant.observacoes}
              </p>
            </CardContent>
          </Card>
        )}

        {/* ── HISTÓRICO FINANCEIRO ── */}
        {historicoPag.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-5 w-5 text-tertiary" />
                Histórico financeiro
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Sumário */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label:"Pagos", val:historicoPag.filter(p=>p.situation==="billed").length, cls:"text-green-700 bg-green-50" },
                  { label:"Em aberto", val:historicoPag.filter(p=>p.situation==="open").length, cls:"text-blue-700 bg-blue-50" },
                  { label:"Vencidos", val:historicoPag.filter(p=>p.situation==="expired").length, cls:"text-red-700 bg-red-50" },
                  { label:"Acordos", val:acordos.length, cls:"text-purple-700 bg-purple-50" },
                ].map(({label,val,cls})=>(
                  <div key={label} className={`${cls.split(" ")[1]} rounded-lg p-2.5 text-center`}>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className={`text-xl font-semibold ${cls.split(" ")[0]}`}>{val}</p>
                  </div>
                ))}
              </div>
              {/* Lista */}
              <div className="rounded-lg border overflow-hidden">
                {historicoPag.map((p:any)=>{
                  const total=(p.valor||0)+(p.valor_multa||0)+(p.valor_juros||0);
                  const [py,pm]=p.mes_referencia.split("-");
                  const meses=["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
                  const mes=`${meses[parseInt(pm)-1]}/${py}`;
                  const fmtV=(v:number)=>v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
                  const fmtD=(iso:string|null)=>{if(!iso)return"—";const[y,m,d]=iso.split("-");return`${d}/${m}/${y}`;};
                  const formaMap:Record<string,string>={pix:"Pix",dinheiro:"Dinheiro",transferencia:"Transferência",cartao:"Cartão",cheque:"Cheque"};
                  return (
                    <div key={p.id} className={`flex items-center gap-3 px-3 py-2.5 text-sm border-b last:border-0 ${p.situation==="billed"?"bg-green-50/50":p.situation==="expired"?"bg-red-50/50":""}`}>
                      <span className="font-medium w-16 shrink-0">{mes}</span>
                      <span className="text-xs text-muted-foreground shrink-0">venc. {fmtD(p.data_vencimento)}</span>
                      <span className="font-medium">{fmtV(total)}</span>
                      {(p.valor_multa||0)+(p.valor_juros||0)>0 && <span className="text-xs text-red-500">c/ enc.</span>}
                      <span className="ml-auto text-xs font-medium">
                        {p.situation==="billed" && <span className="text-green-700">✓ {fmtD(p.data_pagamento)}{p.forma_pagamento?` · ${formaMap[p.forma_pagamento]||p.forma_pagamento}`:""}</span>}
                        {p.situation==="expired" && <span className="text-red-700">✗ Vencido</span>}
                        {p.situation==="open" && <span className="text-blue-700">Em aberto</span>}
                      </span>
                    </div>
                  );
                })}
              </div>
              {/* Acordos */}
              {acordos.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Acordos</p>
                  {acordos.map((a:any)=>{
                    const parcelas=a.parcelas_acordo||[];
                    const pagas=parcelas.filter((p:any)=>p.situation==="billed").length;
                    const fmtV=(v:number)=>(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
                    const fmtD=(iso:string|null)=>{if(!iso)return"—";const[y,m,d]=iso.split("-");return`${d}/${m}/${y}`;};
                    const formaMap:Record<string,string>={pix:"Pix",dinheiro:"Dinheiro",transferencia:"Transferência",cartao:"Cartão",cheque:"Cheque"};
                    return (
                      <div key={a.id} className="rounded-lg border overflow-hidden">
                        <div className={`flex items-center justify-between px-3 py-2.5 text-sm ${a.status==="cumprido"?"bg-green-50":a.status==="quebrado"?"bg-red-50":"bg-blue-50"}`}>
                          <span className="font-medium">{fmtV(a.valor_acordo)} em {a.num_parcelas}x de {fmtV(a.valor_parcela)}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{pagas}/{a.num_parcelas} pagas</span>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${a.status==="cumprido"?"bg-green-100 text-green-700":a.status==="quebrado"?"bg-red-100 text-red-700":"bg-blue-100 text-blue-700"}`}>
                              {a.status==="cumprido"?"Cumprido":a.status==="quebrado"?"Quebrado":"Em andamento"}
                            </span>
                          </div>
                        </div>
                        <div className="divide-y">
                          {parcelas.sort((x:any,y:any)=>x.numero-y.numero).map((p:any)=>(
                            <div key={p.id} className={`flex items-center gap-3 px-3 py-2 text-xs ${p.situation==="billed"?"bg-green-50/30":p.situation==="expired"?"bg-red-50/30":""}`}>
                              <span className="font-medium w-16">Parcela {p.numero}</span>
                              <span className="text-muted-foreground">{fmtD(p.data_vencimento)}</span>
                              <span className="font-medium">{fmtV(p.valor)}</span>
                              <span className="ml-auto font-medium">
                                {p.situation==="billed" && <span className="text-green-700">✓ Pago {fmtD(p.data_pagamento)}{p.forma_pagamento?` · ${formaMap[p.forma_pagamento]||p.forma_pagamento}`:""}</span>}
                                {p.situation==="expired" && <span className="text-red-700">✗ Vencido</span>}
                                {p.situation==="open" && <span className="text-blue-700">Em aberto</span>}
                              </span>
                            </div>
                          ))}
                        </div>
                        {a.observacoes && <p className="px-3 py-2 text-xs text-muted-foreground border-t bg-muted/20">📝 {a.observacoes}</p>}
                      </div>
                    );
                  })}
                </div>
              )}
              {/* Notificações */}
              {historicoNotif.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notificações enviadas ({historicoNotif.length})</p>
                  <div className="rounded-lg border overflow-hidden">
                    {historicoNotif.map((n:any)=>{
                      const cfg=Array.isArray(n.config_notificacoes)?n.config_notificacoes[0]:n.config_notificacoes;
                      const prof=Array.isArray(n.profiles)?n.profiles[0]:n.profiles;
                      const [y,m,d]=(n.enviado_em||"").split("T")[0].split("-");
                      return (
                        <div key={n.id} className="flex items-center gap-3 px-3 py-2.5 border-b last:border-0 text-sm">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{cfg?.label||`Estágio ${n.estagio}`}</span>
                              <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">D+{n.dias_atraso}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">{d}/{m}/{y}{prof?.nome_completo?` · por ${prof.nome_completo}`:""}</p>
                          </div>
                          <span className="text-sm font-medium text-red-600">{(n.valor_total||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Modal de encerramento */}
      {encerrarOpen && tenant && (
        <EncerrarContratoModal
          open={encerrarOpen}
          onClose={() => setEncerrarOpen(false)}
          onSuccess={() => { setEncerrarOpen(false); router.push('/dashboard/inquilinos'); }}
          inquilinoId={tenant.id}
          imovelId={tenant.imovel_id}
          nomeInquilino={tenant.nome_completo}
          docInquilino={tenant.cpf||""}
          imovelTitulo={tenant.imoveis?.titulo||""}
          imovelEndereco={tenant.imoveis?`${tenant.imoveis.endereco_rua}, ${tenant.imoveis.endereco_numero}`:""}
          dataInicio={tenant.data_inicio||""}
          comprovantes={historicoPag}
        />
      )}
    </>
  );
}
