-- Modelo familiar: todos os membros (admin, operador, proprietario) veem os dados
-- do proprietario principal. Antes, o RLS so liberava para role = 'admin', entao
-- operadores e o novo papel 'proprietario' nao viam inquilinos/pagamentos/imoveis.
-- Leitura e operacoes do dia a dia: qualquer membro. Exclusao (DELETE): apenas
-- papeis de gestao (admin, proprietario) — operador nao apaga dados.

-- ============ IMOVEIS ============
DROP POLICY IF EXISTS imoveis_select ON imoveis;
CREATE POLICY imoveis_select ON imoveis FOR SELECT USING (
  (proprietario_id = auth.uid())
  OR (status = 'disponivel')
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','operador','proprietario'))
);

DROP POLICY IF EXISTS imoveis_update ON imoveis;
CREATE POLICY imoveis_update ON imoveis FOR UPDATE USING (
  (proprietario_id = auth.uid())
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','operador','proprietario'))
);

DROP POLICY IF EXISTS imoveis_delete ON imoveis;
CREATE POLICY imoveis_delete ON imoveis FOR DELETE USING (
  (proprietario_id = auth.uid())
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','proprietario'))
);

-- ============ INQUILINOS ============
DROP POLICY IF EXISTS inquilinos_select ON inquilinos;
CREATE POLICY inquilinos_select ON inquilinos FOR SELECT USING (
  EXISTS (SELECT 1 FROM imoveis WHERE imoveis.id = inquilinos.imovel_id AND imoveis.proprietario_id = auth.uid())
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','operador','proprietario'))
);

DROP POLICY IF EXISTS inquilinos_insert ON inquilinos;
CREATE POLICY inquilinos_insert ON inquilinos FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM imoveis WHERE imoveis.id = inquilinos.imovel_id AND imoveis.proprietario_id = auth.uid())
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','operador','proprietario'))
);

DROP POLICY IF EXISTS inquilinos_update ON inquilinos;
CREATE POLICY inquilinos_update ON inquilinos FOR UPDATE USING (
  EXISTS (SELECT 1 FROM imoveis WHERE imoveis.id = inquilinos.imovel_id AND imoveis.proprietario_id = auth.uid())
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','operador','proprietario'))
);

DROP POLICY IF EXISTS inquilinos_delete ON inquilinos;
CREATE POLICY inquilinos_delete ON inquilinos FOR DELETE USING (
  EXISTS (SELECT 1 FROM imoveis WHERE imoveis.id = inquilinos.imovel_id AND imoveis.proprietario_id = auth.uid())
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','proprietario'))
);

-- ============ COMPROVANTES ============
DROP POLICY IF EXISTS comprovantes_select ON comprovantes;
CREATE POLICY comprovantes_select ON comprovantes FOR SELECT USING (
  EXISTS (SELECT 1 FROM imoveis WHERE imoveis.id = comprovantes.imovel_id AND imoveis.proprietario_id = auth.uid())
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','operador','proprietario'))
);

DROP POLICY IF EXISTS comprovantes_insert ON comprovantes;
CREATE POLICY comprovantes_insert ON comprovantes FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM imoveis WHERE imoveis.id = comprovantes.imovel_id AND imoveis.proprietario_id = auth.uid())
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','operador','proprietario'))
);

DROP POLICY IF EXISTS comprovantes_update ON comprovantes;
CREATE POLICY comprovantes_update ON comprovantes FOR UPDATE USING (
  EXISTS (SELECT 1 FROM imoveis WHERE imoveis.id = comprovantes.imovel_id AND imoveis.proprietario_id = auth.uid())
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','operador','proprietario'))
);

DROP POLICY IF EXISTS comprovantes_delete ON comprovantes;
CREATE POLICY comprovantes_delete ON comprovantes FOR DELETE USING (
  EXISTS (SELECT 1 FROM imoveis WHERE imoveis.id = comprovantes.imovel_id AND imoveis.proprietario_id = auth.uid())
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','proprietario'))
);
