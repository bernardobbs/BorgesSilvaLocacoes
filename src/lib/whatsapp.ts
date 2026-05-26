// Based on Lugo — Copyright (c) 2024 Renilson Medeiros — MIT License

/**
 * Formata telefone para o padrão internacional sem símbolos
 * Ex: "(44) 99999-1234" → "5544999991234"
 */
export function formatPhoneWA(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  if (digits.startsWith('0')) return '55' + digits.slice(1);
  return '55' + digits;
}

/**
 * Formata valor em BRL
 */
export function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Calcula valor com encargos por atraso
 */
export function calcularEncargos(
  valorBase: number,
  multaPercentual: number,
  jurosPercentual: number,
  diasAtraso: number
): { multa: number; juros: number; total: number } {
  const multa = valorBase * (multaPercentual / 100);
  const jurosDia = valorBase * (jurosPercentual / 100 / 30);
  const juros = jurosDia * diasAtraso;
  return { multa, juros, total: valorBase + multa + juros };
}

interface MensagemAtrasoParams {
  nomeLocatario: string;
  identificacaoImovel: string; // "Loja 07" ou "Rua das Flores, 120"
  mesReferencia: string;       // "Abril/2025"
  dataVencimento: string;      // "10/04/2025"
  valorTotal: number;
  diasAtraso: number;
  nomeEmpresa?: string;        // "Borges Silva Locações"
}

/**
 * Gera mensagem de cobrança WhatsApp
 */
export function gerarMensagemAtraso(p: MensagemAtrasoParams): string {
  const empresa = p.nomeEmpresa ?? 'Borges Silva Locações';
  return (
    `Olá, *${p.nomeLocatario}*! 👋\n\n` +
    `Identificamos que o aluguel de *${p.identificacaoImovel}* ` +
    `referente a *${p.mesReferencia}* está em aberto.\n\n` +
    `📅 Vencimento: ${p.dataVencimento}\n` +
    `⏳ Dias em atraso: ${p.diasAtraso}\n` +
    `💰 Valor atualizado: *${formatBRL(p.valorTotal)}*\n` +
    `_(aluguel + multa + juros pro rata)_\n\n` +
    `Por favor, entre em contato para regularizar.\n\n` +
    `*${empresa}*`
  );
}

/**
 * Abre WhatsApp com mensagem pré-preenchida
 */
export function abrirWhatsApp(phone: string, mensagem: string): void {
  const numero = formatPhoneWA(phone);
  const url = `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
  window.open(url, '_blank');
}
