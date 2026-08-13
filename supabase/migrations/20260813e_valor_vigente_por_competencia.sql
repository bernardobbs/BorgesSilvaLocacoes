-- 20260813e_valor_vigente_por_competencia.sql
--
-- PROBLEMA
--
-- v_parcelas_devidas usava inquilinos.valor_aluguel (o valor ATUAL) para
-- todas as competências passadas. No primeiro reajuste aplicado, os meses
-- anteriores passariam a ser cobrados pelo valor novo e a dívida inflaria
-- sozinha, sem ninguém mexer em nada.
--
-- CORREÇÃO
--
-- A tabela historico_reajustes já registra (data_reajuste, valor_anterior) a
-- cada aplicação — o dado existia, só não era usado. Agora cada competência
-- usa o valor vigente no seu vencimento: o valor_anterior do reajuste mais
-- antigo POSTERIOR àquele vencimento; se nenhum reajuste veio depois, o valor
-- atual do contrato.
--
-- Validado com simulação read-only: reajuste em 01/06 de 1000 -> 1200 deixa
-- mar/abr/mai em 1000 e jun/jul/ago em 1200.
--
-- As views derivadas são recriadas porque dependem desta.

DROP VIEW IF EXISTS score_inquilinos;
DROP VIEW IF EXISTS v_inquilinos_inadimplentes;
DROP VIEW IF EXISTS v_cobrancas_pendentes;
DROP VIEW IF EXISTS v_parcelas_devidas;

CREATE VIEW v_parcelas_devidas AS
WITH competencias AS (
  SELECT
    inq.id                                 AS inquilino_id,
    inq.nome_completo,
    inq.telefone,
    inq.multa_percentual,
    inq.juros_percentual,
    im.id                                  AS imovel_id,
    im.titulo,
    im.endereco_bairro,
    im.proprietario_id,
    m.mes::date                            AS mes_referencia,
    (m.mes::date + inq.dia_vencimento - 1) AS data_vencimento,
    -- Valor que vigorava no vencimento desta competência
    COALESCE(
      (SELECT hr.valor_anterior
         FROM historico_reajustes hr
        WHERE hr.inquilino_id = inq.id
          AND hr.data_reajuste > (m.mes::date + inq.dia_vencimento - 1)
        ORDER BY hr.data_reajuste ASC
        LIMIT 1),
      inq.valor_aluguel
    ) AS valor
  FROM inquilinos inq
  JOIN imoveis im ON inq.imovel_id = im.id
  CROSS JOIN LATERAL generate_series(
    date_trunc('month', inq.data_inicio::timestamp),
    date_trunc('month', CURRENT_DATE::timestamp),
    interval '1 month'
  ) AS m(mes)
  WHERE inq.status = 'ativo'
    AND (inq.data_fim IS NULL OR m.mes <= date_trunc('month', inq.data_fim::timestamp))
    AND (m.mes::date + inq.dia_vencimento - 1) < CURRENT_DATE
    AND NOT EXISTS (
      SELECT 1 FROM comprovantes c
      WHERE c.inquilino_id = inq.id
        AND date_trunc('month', c.mes_referencia::timestamp) = m.mes
        AND c.situation = 'billed'
    )
)
SELECT
  inquilino_id,
  nome_completo,
  telefone,
  imovel_id,
  titulo,
  endereco_bairro,
  proprietario_id,
  mes_referencia,
  data_vencimento,
  (CURRENT_DATE - data_vencimento)::int AS dias_atraso,
  valor,
  ROUND(valor * COALESCE(multa_percentual, 0) / 100, 2) AS valor_multa,
  ROUND(valor * COALESCE(juros_percentual, 1) / 100 / 30
        * (CURRENT_DATE - data_vencimento), 2)          AS valor_juros,
  ROUND(valor
        + valor * COALESCE(multa_percentual, 0) / 100
        + valor * COALESCE(juros_percentual, 1) / 100 / 30
          * (CURRENT_DATE - data_vencimento), 2)        AS valor_total
FROM competencias;

CREATE VIEW v_inquilinos_inadimplentes AS
SELECT
  inquilino_id          AS id,
  nome_completo,
  titulo,
  endereco_bairro,
  proprietario_id,
  COUNT(*)::int         AS parcelas_vencidas,
  SUM(valor_total)      AS valor_total_vencido,
  MAX(dias_atraso)::int AS dias_atraso_maximo,
  telefone
FROM v_parcelas_devidas
GROUP BY inquilino_id, nome_completo, titulo, endereco_bairro, proprietario_id, telefone
ORDER BY MAX(dias_atraso) DESC;

CREATE VIEW v_cobrancas_pendentes AS
SELECT DISTINCT ON (inquilino_id)
  inquilino_id, nome_completo, imovel_id, titulo, proprietario_id,
  NULL::uuid AS comprovante_id,
  mes_referencia, valor_total AS valor, data_vencimento, dias_atraso,
  'expired'::text AS situation,
  CASE WHEN dias_atraso < 7 THEN 0 WHEN dias_atraso < 15 THEN 1
       WHEN dias_atraso < 30 THEN 2 ELSE 3 END AS estagio_cobranca
FROM v_parcelas_devidas
ORDER BY inquilino_id, data_vencimento;

CREATE VIEW score_inquilinos AS
WITH
esperadas AS (
  SELECT inq.id AS inquilino_id, COUNT(*)::bigint AS meses_esperados
  FROM inquilinos inq
  CROSS JOIN LATERAL generate_series(
    date_trunc('month', inq.data_inicio::timestamp),
    date_trunc('month', CURRENT_DATE::timestamp),
    interval '1 month') AS m(mes)
  WHERE (inq.data_fim IS NULL OR m.mes <= date_trunc('month', inq.data_fim::timestamp))
    AND (m.mes::date + inq.dia_vencimento - 1) < CURRENT_DATE
  GROUP BY inq.id
),
abertas AS (
  SELECT inquilino_id, COUNT(*)::bigint AS em_aberto, MAX(dias_atraso)::int AS dias_atraso_maximo
  FROM v_parcelas_devidas GROUP BY inquilino_id
),
pagamentos AS (
  SELECT c.inquilino_id,
    COUNT(*) FILTER (WHERE c.situation='billed' AND c.data_pagamento IS NOT NULL
      AND c.data_pagamento <= COALESCE(c.data_vencimento, c.mes_referencia::date + inq.dia_vencimento - 1))::bigint AS pagos_em_dia,
    COUNT(*) FILTER (WHERE c.situation='billed' AND c.data_pagamento IS NOT NULL
      AND c.data_pagamento >  COALESCE(c.data_vencimento, c.mes_referencia::date + inq.dia_vencimento - 1))::bigint AS pagos_em_atraso
  FROM comprovantes c JOIN inquilinos inq ON inq.id = c.inquilino_id
  GROUP BY c.inquilino_id
),
notificacoes AS (
  SELECT inquilino_id, COUNT(*)::bigint AS total_notificacoes
  FROM notificacoes_cobranca GROUP BY inquilino_id
),
acordo_resumo AS (
  SELECT inquilino_id, COUNT(*)::bigint AS total_acordos,
         COUNT(*) FILTER (WHERE status='quebrado')::bigint AS acordos_quebrados
  FROM acordos GROUP BY inquilino_id
),
calc AS (
  SELECT i.id AS inquilino_id, i.nome_completo, im.proprietario_id,
    COALESCE(e.meses_esperados,0) AS total_meses,
    COALESCE(pg.pagos_em_dia,0) AS pagos_em_dia,
    COALESCE(pg.pagos_em_atraso,0) AS pagos_em_atraso,
    COALESCE(a.em_aberto,0) AS vencidos,
    COALESCE(a.dias_atraso_maximo,0) AS dias_atraso_maximo,
    COALESCE(n.total_notificacoes,0) AS total_notificacoes,
    COALESCE(ar.total_acordos,0) AS total_acordos,
    COALESCE(ar.acordos_quebrados,0) AS acordos_quebrados,
    GREATEST(0, LEAST(100,
      100 - COALESCE(a.em_aberto,0)*25
          - LEAST(40, COALESCE(a.dias_atraso_maximo,0)/3)
          - COALESCE(pg.pagos_em_atraso,0)*5
          - COALESCE(n.total_notificacoes,0)*5
          - COALESCE(ar.total_acordos,0)*10
          - COALESCE(ar.acordos_quebrados,0)*15))::bigint AS pontos
  FROM inquilinos i
  JOIN imoveis im ON i.imovel_id = im.id
  LEFT JOIN esperadas e ON e.inquilino_id=i.id
  LEFT JOIN abertas a ON a.inquilino_id=i.id
  LEFT JOIN pagamentos pg ON pg.inquilino_id=i.id
  LEFT JOIN notificacoes n ON n.inquilino_id=i.id
  LEFT JOIN acordo_resumo ar ON ar.inquilino_id=i.id
)
SELECT inquilino_id, nome_completo, proprietario_id, total_meses, pagos_em_dia,
  pagos_em_atraso, vencidos, dias_atraso_maximo, total_notificacoes,
  total_acordos, acordos_quebrados, pontos,
  -- Quem está devendo hoje não pode ser "Bom" nem "Excelente"
  CASE WHEN total_meses=0 THEN NULL::integer
       WHEN vencidos=0 AND pontos>=85 THEN 5
       WHEN vencidos=0 AND pontos>=65 THEN 4
       WHEN vencidos<=1 AND pontos>=45 THEN 3
       WHEN pontos>=25 THEN 2 ELSE 1 END AS score,
  CASE WHEN total_meses=0 THEN 'Sem histórico'
       WHEN vencidos=0 AND pontos>=85 THEN 'Excelente pagador'
       WHEN vencidos=0 AND pontos>=65 THEN 'Bom pagador'
       WHEN vencidos<=1 AND pontos>=45 THEN 'Pagador regular'
       WHEN pontos>=25 THEN 'Pagador com pendências'
       ELSE 'Inadimplente crítico' END AS score_label
FROM calc;

REVOKE ALL ON v_parcelas_devidas FROM anon;
REVOKE ALL ON v_inquilinos_inadimplentes FROM anon;
REVOKE ALL ON v_cobrancas_pendentes FROM anon;
REVOKE ALL ON score_inquilinos FROM anon;
GRANT SELECT ON v_parcelas_devidas TO authenticated;
GRANT SELECT ON v_inquilinos_inadimplentes TO authenticated;
GRANT SELECT ON v_cobrancas_pendentes TO authenticated;
GRANT SELECT ON score_inquilinos TO authenticated;
