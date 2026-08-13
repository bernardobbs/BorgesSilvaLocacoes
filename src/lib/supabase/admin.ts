import { createClient } from '@supabase/supabase-js';

/**
 * Chaves do Supabase (JWT ou sb_secret_…) contêm apenas caracteres ASCII
 * (base64url: A-Z a-z 0-9 . _ -). Quando a chave é colada através de apps com
 * "traço inteligente" (Word, PDF, WhatsApp, Notas), um hífen (-) pode ser
 * convertido em travessão (— U+2014 ou – U+2013). Esse caractere tem code point
 * > 255 e quebra os headers HTTP (erro "Cannot convert argument to a ByteString")
 * em toda requisição que use a chave (ex.: criar/remover membro).
 *
 * Convertemos travessões de volta para hífen e removemos qualquer outro
 * caractere > 255 por segurança, deixando a chave utilizável em headers.
 */
export function sanitizeSupabaseKey(key?: string): string {
    const limpa = (key || '')
        .replace(/[‐-―]/g, '-') // travessões/hífens tipográficos → hífen ASCII
        .replace(/[^\x00-\xFF]/g, '')     // remove qualquer caractere restante > 255
        .trim();

    // Uma chave real (JWT ou sb_secret_…) nunca contém espaços/quebras de linha.
    // Se contiver, a variável de ambiente foi preenchida com um texto/nota em vez
    // da chave — devolvemos um erro claro em vez do críptico "invalid header value".
    if (/\s/.test(limpa)) {
        throw new Error(
            'SUPABASE_SERVICE_ROLE_KEY inválida: o valor configurado não parece ser uma chave (contém espaços/texto). ' +
            'Configure no Vercel a chave "service_role" (secret) do Supabase → Project Settings → API.'
        );
    }
    return limpa;
}

export function createAdminClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = sanitizeSupabaseKey(process.env.SUPABASE_SERVICE_ROLE_KEY);

    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurada');
    }

    return createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });
}
