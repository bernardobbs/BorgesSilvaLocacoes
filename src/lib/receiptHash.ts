// Based on Lugo — Copyright (c) 2024 Renilson Medeiros — MIT License
// Geração de hash HMAC-SHA256 para autenticação de recibos
// Equivalente ao hash_hmac('sha256', $payload, $secret) do PHP

import { createHmac } from "crypto";

export interface ReceiptPayload {
  receiptNumber: string;
  comprovante_id: string;
  imovel_id: string;
  inquilino_id: string;
  valor: number;
  data_pagamento: string;
  mes_referencia: string;
}

/**
 * Gera hash HMAC-SHA256 único e imutável para o recibo.
 * O mesmo payload sempre gera o mesmo hash — determinístico.
 * Qualquer alteração em qualquer campo muda completamente o hash.
 */
export function gerarReceiptHash(payload: ReceiptPayload): string {
  const secret = process.env.RECEIPT_SECRET;
  if (!secret) throw new Error("RECEIPT_SECRET não configurado nas variáveis de ambiente");

  const payloadStr = [
    payload.receiptNumber,
    payload.comprovante_id,
    payload.imovel_id,
    payload.inquilino_id,
    payload.valor.toFixed(2),
    payload.data_pagamento,
    payload.mes_referencia,
  ].join("|");

  return createHmac("sha256", secret).update(payloadStr).digest("hex");
}

/**
 * Gera número sequencial do recibo: REC-YYYYMM-XXXX
 * Ex: REC-202606-0001
 */
export function gerarReceiptNumber(mesReferencia: string, sequencia: number): string {
  const [y, m] = mesReferencia.split("-");
  return `REC-${y}${m}-${String(sequencia).padStart(4, "0")}`;
}

/**
 * Exibe hash truncado para documentos (primeiros 20 chars + ...)
 */
export function hashCurto(hash: string): string {
  return hash.slice(0, 20).toUpperCase() + "...";
}
