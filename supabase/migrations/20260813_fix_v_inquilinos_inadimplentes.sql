-- 20260813_fix_v_inquilinos_inadimplentes.sql
--
-- Problema: o dashboard mostrava "Nenhum inadimplente este mês" mesmo com
-- inquilinos em atraso (Gilton D+12, Bernardo D+3).
--
-- Causa: a view só considerava inquilinos com comprovantes em situation='expired'.
-- Comprovantes só são criados quando um pagamento é registrado — inquilinos que
-- simplesmente não pagaram não têm comprovante nenhum, então a view retornava vazia.
--
-- Correção: UNION ALL de dois ramos —
--   1. inquilinos com comprovantes vencidos (lógica anterior)
--   2. inquilinos sem comprovante no mês atual cujo dia_vencimento já passou
--
-- Também reduz o limiar de atraso de 7 para 1 dia, para que o inadimplente
-- apareça no painel já no primeiro dia de atraso.

DROP VIEW IF EXISTS v_inquilinos_inadimplentes;

CREATE VIEW v_inquilinos_inadimplentes AS
WITH
  com_comp AS (
    SELECT
      inq.id,
      inq.nome_completo,
      im.titulo,
      im.endereco_bairro,
      COUNT(DISTINCT c.id)::int AS parcelas_vencidas,
      SUM(c.valor) AS valor_total_vencido,
      MAX(CURRENT_DATE - c.data_vencimento)::int AS dias_atraso_maximo,
      inq.telefone
    FROM inquilinos inq
    JOIN imoveis im ON inq.imovel_id = im.id
    JOIN comprovantes c ON inq.id = c.inquilino_id
    WHERE
      inq.status = 'ativo'
      AND c.situation = 'expired'
      AND (CURRENT_DATE - c.data_vencimento) >= 1
    GROUP BY inq.id, inq.nome_completo, inq.telefone, im.titulo, im.endereco_bairro
    HAVING COUNT(DISTINCT c.id) > 0
  ),

  sem_comp AS (
    SELECT
      inq.id,
      inq.nome_completo,
      im.titulo,
      im.endereco_bairro,
      1::int AS parcelas_vencidas,
      inq.valor_aluguel AS valor_total_vencido,
      (CURRENT_DATE - (DATE_TRUNC('month', CURRENT_DATE)::date + inq.dia_vencimento - 1))::int AS dias_atraso_maximo,
      inq.telefone
    FROM inquilinos inq
    JOIN imoveis im ON inq.imovel_id = im.id
    WHERE
      inq.status = 'ativo'
      AND (DATE_TRUNC('month', CURRENT_DATE)::date + inq.dia_vencimento - 1) < CURRENT_DATE
      AND NOT EXISTS (
        SELECT 1 FROM comprovantes c
        WHERE c.inquilino_id = inq.id
          AND DATE_TRUNC('month', c.mes_referencia::date) = DATE_TRUNC('month', CURRENT_DATE)
      )
      AND inq.id NOT IN (SELECT id FROM com_comp)
  )

SELECT * FROM com_comp
UNION ALL
SELECT * FROM sem_comp
ORDER BY dias_atraso_maximo DESC;

-- Privilégios: view é somente leitura e não deve ser legível pela chave
-- pública (anon), que fica embarcada no bundle do cliente.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON v_inquilinos_inadimplentes FROM anon, authenticated;
REVOKE ALL ON v_inquilinos_inadimplentes FROM anon;
GRANT SELECT ON v_inquilinos_inadimplentes TO authenticated;
