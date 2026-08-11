// Rate limiter em memória com janela deslizante.
// Suficiente para instâncias únicas (Vercel serverless por região).
// Para escala multi-instância, substituir por Upstash Redis.

const store = new Map<string, number[]>();

/**
 * Retorna true se a requisição está dentro do limite.
 * @param key   Identificador único (ex: ip + endpoint)
 * @param limit Máximo de requisições na janela
 * @param windowMs Tamanho da janela em ms
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const timestamps = (store.get(key) ?? []).filter(t => now - t < windowMs);
  if (timestamps.length >= limit) return false;
  timestamps.push(now);
  store.set(key, timestamps);
  return true;
}

export function rateLimitResponse() {
  return new Response(
    JSON.stringify({ error: "Muitas requisições. Tente novamente em instantes." }),
    { status: 429, headers: { "Content-Type": "application/json", "Retry-After": "60" } }
  );
}
