-- Correção crítica: remove policy USING(true) em profiles que expõe
-- CPF e dados sensíveis para qualquer usuário autenticado ou anônimo.

-- Remove as policies conflitantes criadas pelas migrations anteriores
DROP POLICY IF EXISTS "Acesso público limitado a perfis" ON profiles;
DROP POLICY IF EXISTS "Proprietários veem próprio perfil completo" ON profiles;
DROP POLICY IF EXISTS "profiles_select" ON profiles;

-- Usuários autenticados veem apenas o próprio perfil completo
CREATE POLICY profiles_select_own ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Admins veem todos os perfis da mesma família (para gestão de membros)
CREATE POLICY profiles_select_family ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin','proprietario')
        AND (p.family_owner_id = profiles.family_owner_id
             OR p.id = profiles.family_owner_id
             OR profiles.id = p.family_owner_id)
    )
  );

-- Garante que anônimos não leem nada de profiles
REVOKE SELECT ON profiles FROM anon;

-- Usuários autenticados têm SELECT via RLS (as policies acima controlam o quê)
GRANT SELECT ON profiles TO authenticated;
