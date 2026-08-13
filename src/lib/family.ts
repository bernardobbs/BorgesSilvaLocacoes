// Sistema familiar — todos os admins veem os mesmos dados do proprietário principal
// Configure FAMILY_OWNER_ID no Vercel: Settings → Environment Variables
const FALLBACK_ID = '360196c2-df33-4848-80a9-1c4984ad028c';

export const FAMILY_OWNER_ID: string = process.env.FAMILY_OWNER_ID || FALLBACK_ID;

// Chamado nas rotas de API para garantir que a env var está configurada em produção.
// Evita que o erro ocorra no build (avaliação de módulo) em vez de na requisição.
export function assertFamilyOwnerConfigured(): void {
  if (!process.env.FAMILY_OWNER_ID && process.env.NODE_ENV === 'production') {
    console.error('[SECURITY] FAMILY_OWNER_ID env var não configurada em produção. Configure no Vercel: Settings → Environment Variables');
    throw new Error('Configuração do servidor incompleta');
  }
}
