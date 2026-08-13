-- 20260813d_remover_profiles_select_all.sql
--
-- PROBLEMA
--
-- A policy `profiles_select_all` com USING (true) expunha TODOS os perfis —
-- incluindo CPF — a qualquer usuário autenticado. A auditoria de segurança
-- anterior afirmava tê-la removido, mas ela continuava ativa no banco.
--
-- ARMADILHA
--
-- Dropá-la sozinha quebraria o app. A policy que sobraria
-- (`profiles_select_family`) consultava `profiles` de dentro de uma policy
-- SOBRE `profiles`:
--
--     EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND ...)
--
-- Isso dispara "infinite recursion detected in policy for relation profiles".
-- A policy permissiva USING(true) vinha mascarando a recursão — como policies
-- são OR'd, o planner resolvia pelo caminho trivial e nunca avaliava a
-- recursiva. Removida a permissiva, toda leitura de perfil passaria a falhar.
--
-- SOLUÇÃO
--
-- Mover as consultas auxiliares para funções SECURITY DEFINER, que leem
-- profiles sem reentrar na RLS. Já existia current_family_owner_id() nesse
-- padrão; falta a companheira para o papel.
-- (Depende de profiles.relforcerowsecurity = false, verificado.)

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$ SELECT role FROM profiles WHERE id = auth.uid() LIMIT 1; $$;

REVOKE ALL ON FUNCTION public.current_user_role() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;

DROP POLICY IF EXISTS profiles_select_all    ON profiles;
DROP POLICY IF EXISTS profiles_select_family ON profiles;
DROP POLICY IF EXISTS profiles_select_own    ON profiles;

-- Sempre pode ler o próprio perfil; admin/proprietário leem os perfis da
-- mesma família. Ninguém enxerga fora da família.
CREATE POLICY profiles_select_own_or_family ON profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR (
    current_user_role() IN ('admin', 'proprietario')
    AND family_owner_id IS NOT NULL
    AND family_owner_id = current_family_owner_id()
  )
);

-- Validado sob RLS real:
--   admin Bernardo        -> 3 perfis (sem erro de recursão)
--   proprietario Rosalila -> 3 perfis
--   usuário de outra família -> 0 perfis
--   anon -> sem GRANT na tabela, bloqueado antes da RLS
--   Settings.tsx (lista de membros) -> continua retornando os 3
