-- 20260813_fix_v_cobrancas_pendentes.sql
--
-- Problema: a seção "Inadimplentes" da tela de Cobranças nunca aparecia.
-- Ela só renderiza com pendentesView.length > 0, e v_cobrancas_pendentes
-- retornava zero linhas sempre.
--
-- Causa: a view exigia c.situation = 'expired' E data_vencimento não-nula.
-- Comprovante só é criado quando um pagamento é registrado — e sempre nasce
-- como 'billed', com data_vencimento nula. Ou seja, nenhuma linha jamais
-- satisfazia o filtro. Mesma família de bug da v_inquilinos_inadimplentes.
--
-- Correção: UNION ALL de dois ramos —
--   1. comprovantes realmente vencidos (lógica anterior, protegida contra NULL)
--   2. inquilinos ativos sem comprovante no mês corrente cujo dia_vencimento
--      já passou — o caso real de quem simplesmente não pagou
--
-- Limiar de atraso reduzido de 7 para 1 dia.

DROP VIEW IF EXISTS v_cobrancas_pendentes;

CREATE VIEW v_cobrancas_pendentes AS
WITH base AS (
  SELECT
    inq.id            AS inquilino_id,
    inq.nome_completo,
    im.id             AS imovel_id,
    im.titulo,
    c.id              AS comprovante_id,
    c.mes_referencia,
    c.valor,
    c.data_vencimento,
    (CURRENT_DATE - c.data_vencimento)::int AS dias_atraso,
    c.situation
  FROM comprovantes c
  JOIN inquilinos inq ON c.inquilino_id = inq.id
  JOIN imoveis   im  ON c.imovel_id     = im.id
  WHERE inq.status = 'ativo'
    AND c.situation = 'expired'
    AND c.data_vencimento IS NOT NULL
    AND (CURRENT_DATE - c.data_vencimento) >= 1

  UNION ALL

  SELECT
    inq.id,
    inq.nome_completo,
    im.id,
    im.titulo,
    NULL::uuid AS comprovante_id,
    DATE_TRUNC('month', CURRENT_DATE)::date AS mes_referencia,
    inq.valor_aluguel AS valor,
    (DATE_TRUNC('month', CURRENT_DATE)::date + inq.dia_vencimento - 1) AS data_vencimento,
    (CURRENT_DATE - (DATE_TRUNC('month', CURRENT_DATE)::date + inq.dia_vencimento - 1))::int AS dias_atraso,
    'expired'::text AS situation
  FROM inquilinos inq
  JOIN imoveis im ON inq.imovel_id = im.id
  WHERE inq.status = 'ativo'
    AND (DATE_TRUNC('month', CURRENT_DATE)::date + inq.dia_vencimento - 1) < CURRENT_DATE
    AND NOT EXISTS (
      SELECT 1 FROM comprovantes c
      WHERE c.inquilino_id = inq.id
        AND DATE_TRUNC('month', c.mes_referencia::date) = DATE_TRUNC('month', CURRENT_DATE)
    )
)
SELECT DISTINCT ON (inquilino_id)
  inquilino_id,
  nome_completo,
  imovel_id,
  titulo,
  comprovante_id,
  mes_referencia,
  valor,
  data_vencimento,
  dias_atraso,
  situation,
  CASE
    WHEN dias_atraso < 7  THEN 0
    WHEN dias_atraso < 15 THEN 1
    WHEN dias_atraso < 30 THEN 2
    ELSE 3
  END AS estagio_cobranca
FROM base
ORDER BY inquilino_id, data_vencimento;

REVOKE ALL ON v_cobrancas_pendentes FROM anon;
GRANT SELECT ON v_cobrancas_pendentes TO authenticated;
