// src/lib/supabase/index.ts
// Re-exporta tudo do singleton legado + helpers do novo formato

export { createClient as createBrowserClient } from './client'
export { createClient as createServerClient } from './server'
export { updateSession } from './middleware'

// Re-exporta o singleton e helpers do arquivo legado src/lib/supabase.ts
// (mantém compatibilidade com imports `import { supabase } from "@/lib/supabase"`)
export {
  supabase,
  isAuthenticated,
  getCurrentUser,
  getCurrentProfile,
  isAdmin,
  signOut,
} from '../supabase'

// Re-exporta tipos
export type {
  Profile,
  Imovel,
  Inquilino,
  Comprovante,
} from '../supabase'
