// src/lib/supabase/client.ts
// Cliente Supabase para uso no BROWSER (Client Components)
import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

// IMPORTANTE: precisa existir UMA única instância por contexto de browser.
//
// Cada createBrowserClient() instancia um GoTrueClient próprio. Todas as
// instâncias compartilham o mesmo storageKey e, portanto, disputam o mesmo
// lock do navigator.locks ("Multiple GoTrueClient instances detected in the
// same browser context"). Quando uma instância segura o lock — por exemplo
// durante o carregamento do perfil no AuthContext — qualquer getSession()
// de outra instância fica esperando indefinidamente, e a tela que depende
// dessa chamada trava para sempre num spinner.
//
// Memoizar resolve: todo mundo usa o mesmo cliente e o mesmo lock reentrante.
let browserClient: SupabaseClient | undefined

export function createClient(): SupabaseClient {
    if (!browserClient) {
        browserClient = createBrowserClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )
    }
    return browserClient
}
