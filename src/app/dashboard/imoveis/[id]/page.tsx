// Based on Lugo — Copyright (c) 2024 Renilson Medeiros — MIT License
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Edit2, Building2, MapPin, Users, DollarSign, User } from "lucide-react";
import { FAMILY_OWNER_ID } from '@/lib/family';

function fmtBRL(v: number) { return (v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"}); }
function fmtData(iso: string|null) { if(!iso)return"—"; const[y,m,d]=iso.split("-"); return`${d}/${m}/${y}`; }
function mesLabel(iso: string) { if(!iso)return""; const[y,mo]=iso.split("-"); const M=["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"]; return`${M[parseInt(mo)-1]}/${y}`; }

const STATUS_COLOR: Record<string,string> = {
  alugado:"bg-red-100 text-red-700",
  disponivel:"bg-green-100 text-green-700",
  manutencao:"bg-orange-100 text-orange-700",
};
const STATUS_LABEL: Record<string,string> = {
  alugado:"Alugado", disponivel:"Disponível", manutencao:"Manutenção"
};

export default async function ImovelDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { id } = await params;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  const { data: imovel } = await supabase
    .from("imoveis")
    .select("*")
    .eq("id", id)
    .eq('proprietario_id', FAMILY_OWNER_ID)
    .maybeSingle();

  if (!imovel) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Imóvel não encontrado.</p>
        <a href="/dashboard/imoveis" className="text-primary underline mt-2 block">Voltar para imóveis</a>
      </div>
    );
  }

  // Inquilino ativo
  const { data: inquilino } = await supabase
    .from("inquilinos")
    .select("id, nome_completo, cpf, cnpj, tipo_pessoa, telefone, email, data_inicio, valor_aluguel, dia_vencimento, status")
    .eq("imovel_id", id)
    .eq("status", "ativo")
    .maybeSingle();

  // Histórico de comprovantes
  // Comprovantes via imovel_id (campo existe na tabela)
  const { data: comprovantes } = await supabase
    .from("comprovantes")
    .select("id, mes_referencia, valor, valor_multa, valor_juros, situation, data_vencimento, data_pagamento, forma_pagamento")
    .eq("imovel_id", id)
    .order("mes_referencia", { ascending: false })
    .limit(12);

  const formaMap: Record<string,string> = {pix:"Pix",dinheiro:"Dinheiro",transferencia:"Transferência",cartao:"Cartão",cheque:"Cheque"};

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div>
        <Link href="/dashboard/imoveis" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="h-4 w-4" /> Voltar para imóveis
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{imovel.titulo || `${imovel.tipo} — ${imovel.do_center ? imovel.numero_unidade : imovel.endereco_rua}`}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={STATUS_COLOR[imovel.status]}>{STATUS_LABEL[imovel.status]}</Badge>
              <span className="text-sm text-muted-foreground capitalize">{imovel.tipo}</span>
            </div>
          </div>
          <Link href={`/dashboard/imoveis/${id}/editar`}>
            <Button variant="outline" size="sm"><Edit2 className="h-4 w-4 mr-1.5" />Editar</Button>
          </Link>
        </div>
      </div>

      {/* Dados do imóvel */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><Building2 className="h-4 w-4" />Dados do imóvel</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm">
          {imovel.do_center ? (
            <>
              <div><span className="text-muted-foreground">Unidade</span><p className="font-medium">{imovel.numero_unidade}</p></div>
              <div><span className="text-muted-foreground">Andar</span><p className="font-medium">{imovel.andar||"—"}</p></div>
            </>
          ) : (
            <>
              <div className="col-span-2"><span className="text-muted-foreground">Endereço</span>
                <p className="font-medium">{imovel.endereco_rua}, {imovel.numero} — {imovel.bairro}, {imovel.cidade}–{imovel.estado}</p>
              </div>
            </>
          )}
          {imovel.area_m2 && <div><span className="text-muted-foreground">Área</span><p className="font-medium">{imovel.area_m2} m²</p></div>}
          {imovel.quartos && <div><span className="text-muted-foreground">Quartos</span><p className="font-medium">{imovel.quartos}</p></div>}
          {imovel.vagas && <div><span className="text-muted-foreground">Vagas</span><p className="font-medium">{imovel.vagas}</p></div>}
          <div><span className="text-muted-foreground">Aluguel</span><p className="font-semibold text-primary">{fmtBRL(imovel.valor_aluguel)}/mês</p></div>
          {imovel.valor_condominio > 0 && <div><span className="text-muted-foreground">Condomínio</span><p className="font-medium">{fmtBRL(imovel.valor_condominio)}</p></div>}
          {(imovel.locador_nome) && <div className="col-span-2"><span className="text-muted-foreground">Locador</span><p className="font-medium">{imovel.locador_nome}</p></div>}
        </CardContent>
      </Card>

      {/* Inquilino ativo */}
      {inquilino && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4" />Inquilino atual</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{inquilino.nome_completo}</p>
                <p className="text-sm text-muted-foreground">{inquilino.tipo_pessoa==="juridica" ? inquilino.cnpj : inquilino.cpf} · {inquilino.telefone}</p>
              </div>
              <Link href={`/dashboard/inquilinos/${inquilino.id}`}>
                <Button variant="outline" size="sm">Ver perfil</Button>
              </Link>
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div><span className="text-muted-foreground">Início</span><p className="font-medium">{fmtData(inquilino.data_inicio)}</p></div>
              <div><span className="text-muted-foreground">Aluguel</span><p className="font-medium">{fmtBRL(inquilino.valor_aluguel)}</p></div>
              <div><span className="text-muted-foreground">Vencimento</span><p className="font-medium">Dia {inquilino.dia_vencimento}</p></div>
            </div>
          </CardContent>
        </Card>
      )}

      {!inquilino && (
        <Card>
          <CardContent className="py-6 text-center">
            <p className="text-muted-foreground text-sm mb-3">Imóvel sem inquilino ativo</p>
            <Link href={`/dashboard/imoveis/${id}/inquilino`}>
              <Button size="sm">+ Cadastrar inquilino</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Histórico de pagamentos */}
      {comprovantes && comprovantes.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><DollarSign className="h-4 w-4" />Últimos 12 pagamentos</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {comprovantes.map((c: any) => {
                const total = (c.valor||0)+(c.valor_multa||0)+(c.valor_juros||0);
                return (
                  <div key={c.id} className={`flex items-center gap-3 px-4 py-3 text-sm ${c.situation==="billed"?"bg-green-50/40":c.situation==="expired"?"bg-red-50/40":""}`}>
                    <span className="font-medium w-16 shrink-0">{mesLabel(c.mes_referencia)}</span>
                    <span className="text-muted-foreground text-xs shrink-0">venc. {fmtData(c.data_vencimento)}</span>
                    <span className="font-medium">{fmtBRL(total)}</span>
                    {(c.valor_multa||0)+(c.valor_juros||0) > 0 && (
                      <span className="text-xs text-red-500">c/ encargos</span>
                    )}
                    <span className="ml-auto text-xs font-medium">
                      {c.situation==="billed" && <span className="text-green-700">✓ {fmtData(c.data_pagamento)}{c.forma_pagamento?` · ${formaMap[c.forma_pagamento]||c.forma_pagamento}`:""}</span>}
                      {c.situation==="expired" && <span className="text-red-700">✗ Vencido</span>}
                      {c.situation==="open" && <span className="text-blue-700">Em aberto</span>}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
