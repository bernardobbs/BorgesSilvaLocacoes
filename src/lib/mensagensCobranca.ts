// Based on Lugo — Copyright (c) 2024 Renilson Medeiros — MIT License

export interface ConfigNotificacao {
  id: string;
  ordem: number;
  dias_atraso: number;
  label: string;
  mensagem_template: string;
  ativo: boolean;
}

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Substitui variáveis no template da mensagem
 * Variáveis disponíveis: {{nome}}, {{imovel}}, {{mes}}, {{dias}},
 *   {{valor_base}}, {{multa}}, {{juros}}, {{valor_total}}, {{vencimento}}
 */
export function renderMensagem(
  template: string,
  vars: {
    nome: string;
    imovel: string;
    mes: string;
    dias: number;
    valorBase: number;
    multa: number;
    juros: number;
    valorTotal: number;
    vencimento?: string;
  }
): string {
  return template
    .replace(/{{nome}}/g,        vars.nome)
    .replace(/{{imovel}}/g,      vars.imovel)
    .replace(/{{mes}}/g,         vars.mes)
    .replace(/{{dias}}/g,        vars.dias.toString())
    .replace(/{{valor_base}}/g,  fmtBRL(vars.valorBase))
    .replace(/{{multa}}/g,       fmtBRL(vars.multa))
    .replace(/{{juros}}/g,       fmtBRL(vars.juros))
    .replace(/{{valor_total}}/g, fmtBRL(vars.valorTotal))
    .replace(/{{vencimento}}/g,  vars.vencimento || "");
}

export function corConfig(ordem: number) {
  const cores: Record<number, { bg: string; border: string; text: string; badge: string }> = {
    1: { bg:"bg-yellow-50",  border:"border-yellow-200", text:"text-yellow-700",  badge:"bg-yellow-100 text-yellow-800" },
    2: { bg:"bg-orange-50",  border:"border-orange-200", text:"text-orange-700",  badge:"bg-orange-100 text-orange-800" },
    3: { bg:"bg-red-50",     border:"border-red-200",    text:"text-red-800",     badge:"bg-red-100 text-red-900" },
    4: { bg:"bg-red-950/10", border:"border-red-900",    text:"text-red-900",     badge:"bg-red-900 text-red-50" },
    5: { bg:"bg-red-950/20", border:"border-red-900",    text:"text-red-950",     badge:"bg-red-950 text-red-50" },
  };
  return cores[ordem] || cores[3];
}
