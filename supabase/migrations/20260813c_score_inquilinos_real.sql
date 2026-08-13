-- 20260813c_score_inquilinos_real.sql
--
-- PROBLEMA
--
-- Um inquilino com 4 parcelas em aberto e 156 dias de atraso aparecia como
-- "Excelente pagador", 100/100. E não era caso isolado: TODO inquilino
-- nascia Excelente.
--
-- Causa, a mesma cegueira estrutural das outras views:
--
--   1. `vencidos` contava comprovantes com situation='expired'. Comprovante
--      só é criado ao registrar pagamento, sempre como 'billed' — nunca há
--      linha 'expired'. Logo, vencidos = 0 sempre.
--   2. `pagos_em_dia` comparava data_pagamento <= data_vencimento, mas
--      data_vencimento é NULL nos comprovantes gravados. Comparação com NULL
--      dá NULL, então o pagamento não contava nem como pontual nem atrasado.
--
--   Resultado: pontos = 100 + 0 - 0 - 0 - 0 = 100, para todo mundo.
--
-- CORREÇÃO
--
-- O score passa a derivar de v_parcelas_devidas (que gera a série de
-- competências do contrato) e da pontualidade real, com vencimento efetivo
-- calculado via COALESCE quando data_vencimento é nula.
--
-- Regra de negócio adicional: quem tem parcela em aberto hoje não pode ser
-- "Bom" nem "Excelente", por melhor que seja o histórico anterior.

DROP VIEW IF EXISTS score_inquilinos;

CREATE VIEW score_inquilinos AS
WITH
esperadas AS (
  SELECT inq.id AS inquilino_id, COUNT(*)::bigint AS meses_esperados
  FROM inquilinos inq
  CROSS JOIN LATERAL generate_series(
    date_trunc('month', inq.data_inicio::timestamp),
    date_trunc('month', CURRENT_DATE::timestamp),
    interval '1 month'
  ) AS m(mes)
  WHERE (inq.data_fim IS NULL OR m.mes <= date_trunc('month', inq.data_fim::timestamp))
    AND (m.mes::date + inq.dia_vencimento - 1) < CURRENT_DATE
  GROUP BY inq.id
),
abertas AS (
  SELECT inquilino_id,
         COUNT(*)::bigint      AS em_aberto,
         MAX(dias_atraso)::int AS dias_atraso_maximo
  FROM v_parcelas_devidas
  GROUP BY inquilino_id
),
pagamentos AS (
  SELECT c.inquilino_id,
    COUNT(*) FILTER (
      WHERE c.situation = 'billed'
        AND c.data_pagamento IS NOT NULL
        AND c.data_pagamento <= COALESCE(
              c.data_vencimento,
              c.mes_referencia::date + inq.dia_vencimento - 1)
    )::bigint AS pagos_em_dia,
    COUNT(*) FILTER (
      WHERE c.situation = 'billed'
        AND c.data_pagamento IS NOT NULL
        AND c.data_pagamento > COALESCE(
              c.data_vencimento,
              c.mes_referencia::date + inq.dia_vencimento - 1)
    )::bigint AS pagos_em_atraso
  FROM comprovantes c
  JOIN inquilinos inq ON inq.id = c.inquilino_id
  GROUP BY c.inquilino_id
),
notificacoes AS (
  SELECT inquilino_id, COUNT(*)::bigint AS total_notificacoes
  FROM notificacoes_cobranca GROUP BY inquilino_id
),
acordo_resumo AS (
  SELECT inquilino_id,
         COUNT(*)::bigint AS total_acordos,
         COUNT(*) FILTER (WHERE status = 'quebrado')::bigint AS acordos_quebrados
  FROM acordos GROUP BY inquilino_id
),
calc AS (
  SELECT
    i.id   AS inquilino_id,
    i.nome_completo,
    im.proprietario_id,
    COALESCE(e.meses_esperados, 0)   AS total_meses,
    COALESCE(pg.pagos_em_dia, 0)     AS pagos_em_dia,
    COALESCE(pg.pagos_em_atraso, 0)  AS pagos_em_atraso,
    COALESCE(a.em_aberto, 0)         AS vencidos,
    COALESCE(a.dias_atraso_maximo,0) AS dias_atraso_maximo,
    COALESCE(n.total_notificacoes,0) AS total_notificacoes,
    COALESCE(ar.total_acordos, 0)    AS total_acordos,
    COALESCE(ar.acordos_quebrados,0) AS acordos_quebrados,
    GREATEST(0, LEAST(100,
      100
      - COALESCE(a.em_aberto, 0) * 25
      - LEAST(40, COALESCE(a.dias_atraso_maximo, 0) / 3)
      - COALESCE(pg.pagos_em_atraso, 0) * 5
      - COALESCE(n.total_notificacoes, 0) * 5
      - COALESCE(ar.total_acordos, 0) * 10
      - COALESCE(ar.acordos_quebrados, 0) * 15
    ))::bigint AS pontos
  FROM inquilinos i
  JOIN imoveis im ON i.imovel_id = im.id
  LEFT JOIN esperadas     e  ON e.inquilino_id  = i.id
  LEFT JOIN abertas       a  ON a.inquilino_id  = i.id
  LEFT JOIN pagamentos    pg ON pg.inquilino_id = i.id
  LEFT JOIN notificacoes  n  ON n.inquilino_id  = i.id
  LEFT JOIN acordo_resumo ar ON ar.inquilino_id = i.id
)
SELECT
  inquilino_id,
  nome_completo,
  proprietario_id,
  total_meses,
  pagos_em_dia,
  pagos_em_atraso,
  vencidos,
  dias_atraso_maximo,
  total_notificacoes,
  total_acordos,
  acordos_quebrados,
  pontos,
  CASE
    WHEN total_meses = 0                THEN NULL::integer
    WHEN vencidos = 0 AND pontos >= 85  THEN 5
    WHEN vencidos = 0 AND pontos >= 65  THEN 4
    WHEN vencidos <= 1 AND pontos >= 45 THEN 3
    WHEN pontos >= 25                   THEN 2
    ELSE 1
  END AS score,
  CASE
    WHEN total_meses = 0                THEN 'Sem histórico'
    WHEN vencidos = 0 AND pontos >= 85  THEN 'Excelente pagador'
    WHEN vencidos = 0 AND pontos >= 65  THEN 'Bom pagador'
    WHEN vencidos <= 1 AND pontos >= 45 THEN 'Pagador regular'
    WHEN pontos >= 25                   THEN 'Pagador com pendências'
    ELSE 'Inadimplente crítico'
  END AS score_label
FROM calc;

REVOKE ALL ON score_inquilinos FROM anon;
GRANT SELECT ON score_inquilinos TO authenticated;
