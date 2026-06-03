// Based on Lugo — Copyright (c) 2024 Renilson Medeiros — MIT License
"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, MessageCircle, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { renderMensagem, corConfig } from "@/lib/mensagensCobranca";
import { toast } from "sonner";

interface Notificacao {
  inquilino_id: string;
  nome_completo: string;
  telefone: string;
  valor_aluguel: number;
  multa_percentual: number;
  juros_percentual: number;
  imovel_id: string;
  imovel_titulo: string;
  comprovante_id: string;
  mes_referencia: string;
  dias_atraso: number;
  valor_total: number;
  config_id: string;
  estagio_atual: number;
  estagio_label: string;
  mensagem_template: string;
  ja_enviado: boolean;
  anterior_enviado: boolean;
}

interface Props { notificacoes: Notificacao[]; compact?: boolean; }

function mesLabel(iso: string) {
  const [y,m] = iso.split("-");
  const M=["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  return `${M[parseInt(m)-1]}/${y}`;
}
function fmtPhone(tel: string) {
  const d = tel.replace(/\D/g,"").replace(/^0/,"55");
  return d.startsWith("55") ? d : "55"+d;
}
function fmtBRL(v: number) { return v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"}); }
function fmtData(iso: string) {
  const [y,m,d] = iso.split("-"); return `${d}/${m}/${y}`;
}

export default function NotificacoesCobranca({ notificacoes, compact = false }: Props) {
  const [enviados, setEnviados] = useState<Set<string>>(new Set());
  const [expandido, setExpandido] = useState(!compact);

  // Filtrar: não enviado, anterior enviado (progressão)
  const pendentes = notificacoes.filter(n =>
    !n.ja_enviado &&
    n.anterior_enviado &&
    !enviados.has(`${n.comprovante_id}-${n.config_id}`)
  );

  const total = pendentes.length;

  async function enviar(n: Notificacao) {
    const multa  = n.valor_aluguel * (n.multa_percentual / 100);
    const juros  = n.valor_aluguel * (n.juros_percentual / 100 / 30) * n.dias_atraso;

    const mensagem = renderMensagem(n.mensagem_template, {
      nome: n.nome_completo,
      imovel: n.imovel_titulo,
      mes: mesLabel(n.mes_referencia),
      dias: n.dias_atraso,
      valorBase: n.valor_aluguel,
      multa, juros,
      valorTotal: n.valor_total,
      vencimento: n.mes_referencia ? fmtData(n.mes_referencia) : "",
    });

    const url = `https://wa.me/${fmtPhone(n.telefone)}?text=${encodeURIComponent(mensagem)}`;
    window.open(url, "_blank");

    try {
      await fetch("/api/notificacoes/marcar-enviado", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inquilino_id: n.inquilino_id,
          comprovante_id: n.comprovante_id,
          imovel_id: n.imovel_id,
          estagio: n.estagio_atual,
          config_id: n.config_id,
          dias_atraso: n.dias_atraso,
          valor_total: n.valor_total,
          mes_referencia: n.mes_referencia,
        }),
      });
      setEnviados(prev => new Set([...prev, `${n.comprovante_id}-${n.config_id}`]));
      toast.success("Enviado!", { description: `${n.nome_completo} · ${n.estagio_label}` });
    } catch { toast.error("Erro ao registrar envio"); }
  }

  if (total === 0) {
    if (compact) return null;
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
          <p className="text-sm font-medium">Nenhuma notificação pendente</p>
          <p className="text-xs text-muted-foreground mt-1">Todos os estágios em dia ou inquilinos em acordo.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={compact ? "border-orange-200" : ""}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Bell className="h-4 w-4 text-orange-500" />
            Notificações pendentes
            <span className="bg-orange-100 text-orange-800 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{total}</span>
          </CardTitle>
          {compact && (
            <button onClick={() => setExpandido(!expandido)} className="text-muted-foreground hover:text-foreground">
              {expandido ? <ChevronUp className="h-4 w-4"/> : <ChevronDown className="h-4 w-4"/>}
            </button>
          )}
        </div>
        {compact && !expandido && (
          <p className="text-xs text-muted-foreground mt-1">
            {pendentes.slice(0,3).map(n=>n.nome_completo.split(" ")[0]).join(", ")}
            {total > 3 ? ` e mais ${total-3}` : ""}
          </p>
        )}
      </CardHeader>

      {expandido && (
        <CardContent className="space-y-2 pt-0">
          {pendentes.map(n => {
            const cor = corConfig(n.estagio_atual);
            return (
              <div key={`${n.comprovante_id}-${n.config_id}`}
                className={`rounded-lg border p-3 ${cor.bg} ${cor.border}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cor.badge}`}>
                        {n.estagio_label}
                      </span>
                      <span className={`text-xs ${cor.text}`}>D+{n.dias_atraso}</span>
                    </div>
                    <p className={`text-sm font-medium mt-1 ${cor.text}`}>{n.nome_completo}</p>
                    <p className="text-xs text-muted-foreground">{n.imovel_titulo} · {mesLabel(n.mes_referencia)}</p>
                    <p className={`text-xs font-semibold mt-0.5 ${cor.text}`}>{fmtBRL(n.valor_total)} c/ encargos</p>
                  </div>
                  <Button size="sm" onClick={() => enviar(n)}
                    className="bg-[#25D366] hover:bg-[#128C7E] text-white shrink-0 gap-1.5">
                    <MessageCircle className="h-3.5 w-3.5" />Enviar
                  </Button>
                </div>
              </div>
            );
          })}
          <p className="text-xs text-center text-muted-foreground pt-1">
            Clique em Enviar — o WhatsApp abre e o envio é registrado automaticamente.
          </p>
        </CardContent>
      )}
    </Card>
  );
}
