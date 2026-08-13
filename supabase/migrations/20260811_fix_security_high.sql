-- Corrigir policy imoveis_select: status='disponivel' expunha dados para todos os usuários autenticados.
-- Agora imóveis disponíveis ficam visíveis apenas para anon (portais públicos) e para a própria família.
DROP POLICY IF EXISTS imoveis_select ON imoveis;

CREATE POLICY imoveis_select ON imoveis FOR SELECT USING (
  proprietario_id = auth.uid()
  OR proprietario_id = current_family_owner_id()
  OR (status = 'disponivel' AND auth.uid() IS NULL)
);
