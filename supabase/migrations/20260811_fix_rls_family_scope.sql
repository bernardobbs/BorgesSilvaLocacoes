-- Correção crítica de segurança: isola o acesso de membros familiares
-- ao proprietário correto, evitando vazamento cross-tenant.
--
-- Problema anterior: OR role IN ('proprietario'...) sem vincular ao
-- proprietário da família — qualquer usuário registrado via a condição.
--
-- Solução: coluna family_owner_id em profiles aponta para o
-- proprietário cujos dados o membro pode acessar. As policies passam
-- a exigir p.family_owner_id = <proprietario_id da tabela>.

-- ── 1. Adiciona coluna family_owner_id em profiles ──────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS family_owner_id UUID REFERENCES auth.users(id);

-- O proprietário principal aponta para si mesmo
UPDATE profiles
  SET family_owner_id = id
  WHERE id = '360196c2-df33-4848-80a9-1c4984ad028c'
    AND family_owner_id IS NULL;

-- Todos os outros membros existentes apontam para o proprietário principal
UPDATE profiles
  SET family_owner_id = '360196c2-df33-4848-80a9-1c4984ad028c'
  WHERE id != '360196c2-df33-4848-80a9-1c4984ad028c'
    AND family_owner_id IS NULL;

-- ── 2. Helpers ────────────────────────────────────────────────────────
-- Função que retorna o family_owner_id do usuário atual (cacheada por tx)
CREATE OR REPLACE FUNCTION current_family_owner_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT family_owner_id FROM profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- ── 3. IMOVEIS ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS imoveis_select ON imoveis;
CREATE POLICY imoveis_select ON imoveis FOR SELECT USING (
  proprietario_id = auth.uid()
  OR status = 'disponivel'
  OR proprietario_id = current_family_owner_id()
);

DROP POLICY IF EXISTS imoveis_insert ON imoveis;
CREATE POLICY imoveis_insert ON imoveis FOR INSERT WITH CHECK (
  proprietario_id = auth.uid()
  OR proprietario_id = current_family_owner_id()
);

DROP POLICY IF EXISTS imoveis_update ON imoveis;
CREATE POLICY imoveis_update ON imoveis FOR UPDATE USING (
  proprietario_id = auth.uid()
  OR proprietario_id = current_family_owner_id()
);

DROP POLICY IF EXISTS imoveis_delete ON imoveis;
CREATE POLICY imoveis_delete ON imoveis FOR DELETE USING (
  proprietario_id = auth.uid()
  OR (
    proprietario_id = current_family_owner_id()
    AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','proprietario'))
  )
);

-- ── 4. INQUILINOS ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS inquilinos_select ON inquilinos;
CREATE POLICY inquilinos_select ON inquilinos FOR SELECT USING (
  EXISTS (SELECT 1 FROM imoveis WHERE imoveis.id = inquilinos.imovel_id
          AND (imoveis.proprietario_id = auth.uid()
               OR imoveis.proprietario_id = current_family_owner_id()))
);

DROP POLICY IF EXISTS inquilinos_insert ON inquilinos;
CREATE POLICY inquilinos_insert ON inquilinos FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM imoveis WHERE imoveis.id = inquilinos.imovel_id
          AND (imoveis.proprietario_id = auth.uid()
               OR imoveis.proprietario_id = current_family_owner_id()))
);

DROP POLICY IF EXISTS inquilinos_update ON inquilinos;
CREATE POLICY inquilinos_update ON inquilinos FOR UPDATE USING (
  EXISTS (SELECT 1 FROM imoveis WHERE imoveis.id = inquilinos.imovel_id
          AND (imoveis.proprietario_id = auth.uid()
               OR imoveis.proprietario_id = current_family_owner_id()))
);

DROP POLICY IF EXISTS inquilinos_delete ON inquilinos;
CREATE POLICY inquilinos_delete ON inquilinos FOR DELETE USING (
  EXISTS (SELECT 1 FROM imoveis WHERE imoveis.id = inquilinos.imovel_id
          AND (imoveis.proprietario_id = auth.uid()
               OR imoveis.proprietario_id = current_family_owner_id()))
  AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','proprietario'))
);

-- ── 5. COMPROVANTES ───────────────────────────────────────────────────
DROP POLICY IF EXISTS comprovantes_select ON comprovantes;
CREATE POLICY comprovantes_select ON comprovantes FOR SELECT USING (
  EXISTS (SELECT 1 FROM imoveis WHERE imoveis.id = comprovantes.imovel_id
          AND (imoveis.proprietario_id = auth.uid()
               OR imoveis.proprietario_id = current_family_owner_id()))
);

DROP POLICY IF EXISTS comprovantes_insert ON comprovantes;
CREATE POLICY comprovantes_insert ON comprovantes FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM imoveis WHERE imoveis.id = comprovantes.imovel_id
          AND (imoveis.proprietario_id = auth.uid()
               OR imoveis.proprietario_id = current_family_owner_id()))
);

DROP POLICY IF EXISTS comprovantes_update ON comprovantes;
CREATE POLICY comprovantes_update ON comprovantes FOR UPDATE USING (
  EXISTS (SELECT 1 FROM imoveis WHERE imoveis.id = comprovantes.imovel_id
          AND (imoveis.proprietario_id = auth.uid()
               OR imoveis.proprietario_id = current_family_owner_id()))
);

DROP POLICY IF EXISTS comprovantes_delete ON comprovantes;
CREATE POLICY comprovantes_delete ON comprovantes FOR DELETE USING (
  EXISTS (SELECT 1 FROM imoveis WHERE imoveis.id = comprovantes.imovel_id
          AND (imoveis.proprietario_id = auth.uid()
               OR imoveis.proprietario_id = current_family_owner_id()))
  AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','proprietario'))
);
