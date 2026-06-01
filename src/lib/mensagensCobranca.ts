// Based on Lugo — Copyright (c) 2024 Renilson Medeiros — MIT License

export type EstagioCobranca = 1 | 10 | 20;

interface MensagemParams {
  nomeInquilino: string;
  imovelTitulo: string;
  mesReferencia: string;   // "Mai/2026"
  diasAtraso: number;
  valorAluguel: number;
  multa: number;
  juros: number;
  valorTotal: number;
}

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function gerarMensagem(estagio: EstagioCobranca, p: MensagemParams): string {
  const encargos = [
    `• Aluguel: *${fmtBRL(p.valorAluguel)}*`,
    p.multa > 0 ? `• Multa: *${fmtBRL(p.multa)}*` : null,
    p.juros > 0 ? `• Juros (${p.diasAtraso} dias): *${fmtBRL(p.juros)}*` : null,
    `• *Total: ${fmtBRL(p.valorTotal)}*`,
  ].filter(Boolean).join("\n");

  if (estagio === 1) {
    return [
      `Olá, *${p.nomeInquilino}*! 👋`,
      ``,
      `Passando para avisar que o aluguel de *${p.imovelTitulo}* referente a *${p.mesReferencia}* ainda não foi identificado no nosso sistema.`,
      ``,
      `📋 Valores:`,
      encargos,
      ``,
      `Se já realizou o pagamento, por favor envie o comprovante para regularizarmos. Caso contrário, entre em contato para combinarmos.`,
      ``,
      `Obrigado! 🏠`,
      `*Borges Silva Locações*`,
    ].join("\n");
  }

  if (estagio === 10) {
    return [
      `Prezado(a) *${p.nomeInquilino}*,`,
      ``,
      `Informamos que o aluguel referente a *${p.mesReferencia}* do imóvel *${p.imovelTitulo}* encontra-se em aberto há *${p.diasAtraso} dias*.`,
      ``,
      `📋 Demonstrativo atualizado:`,
      encargos,
      ``,
      `Solicitamos a regularização até 48 horas. Caso já tenha efetuado o pagamento, encaminhe o comprovante.`,
      ``,
      `*Borges Silva Locações*`,
    ].join("\n");
  }

  // estagio === 20
  return [
    `*${p.nomeInquilino}*,`,
    ``,
    `⚠️ NOTIFICAÇÃO FORMAL DE INADIMPLÊNCIA`,
    ``,
    `O aluguel referente a *${p.mesReferencia}* do imóvel *${p.imovelTitulo}* permanece em aberto há *${p.diasAtraso} dias*, configurando inadimplência contratual.`,
    ``,
    `📋 Valor total em aberto:`,
    encargos,
    ``,
    `Caso não haja regularização ou contato em *72 horas*, tomaremos as medidas legais cabíveis, incluindo:`,
    `— Notificação extrajudicial com AR`,
    `— Negativação junto aos órgãos de proteção ao crédito`,
    `— Ação de despejo por falta de pagamento`,
    ``,
    `*Borges Silva Locações*`,
    `_Esta mensagem tem caráter de notificação formal._`,
  ].join("\n");
}

export function labelEstagio(e: EstagioCobranca) {
  return { 1: "Aviso amigável", 10: "Cobrança formal", 20: "Pré-extrajudicial" }[e];
}

export function corEstagio(e: EstagioCobranca) {
  return {
    1:  { bg: "bg-yellow-50",  border: "border-yellow-200", text: "text-yellow-700",  badge: "bg-yellow-100 text-yellow-800" },
    10: { bg: "bg-orange-50",  border: "border-orange-200", text: "text-orange-700",  badge: "bg-orange-100 text-orange-800" },
    20: { bg: "bg-red-50",     border: "border-red-200",    text: "text-red-800",     badge: "bg-red-100 text-red-900" },
  }[e];
}
