-- 20260813b_v_parcelas_devidas.sql
--
-- PROBLEMA DE FUNDO
--
-- O sistema só grava em `comprovantes` quando um pagamento é registrado —
-- e sempre com situation='billed'. Meses em que o inquilino simplesmente
-- não pagou não existem como linha em lugar nenhum do banco.
--
-- Consequência: toda a inadimplência era invisível. As views e a edge
-- function procuravam comprovantes com situation='expired', que nunca
-- existem. Exemplo real: contrato de 2026-03-01, apenas 2 pagamentos
-- registrados (mai e ago) — os 4 meses devidos (mar, abr, jun, jul) não
-- apareciam em tela alguma, e "Msg. consolidada" respondia
-- "Sem parcelas vencidas".
--
-- SOLUÇÃO
--
-- v_parcelas_devidas GERA a série de competências esperada pelo contrato
-- (data_inicio → mês corrente, limitada por data_fim) e considera devida
-- toda competência já vencida sem comprovante pago. Passa a ser a fonte
-- única: v_inquilinos_inadimplentes e v_cobrancas_pendentes derivam dela,
-- e a edge function gerar_mensagem_consolidada também.
--
-- LIMITAÇÃO CONHECIDA: usa inquilinos.valor_aluguel (valor atual) para todas
-- as competências. Se houver reajuste no meio do contrato, meses anteriores
-- ao reajuste ficam com o valor novo. Corrigir exige histórico de valores.

DROP VIEW IF EXISTS v_inquilinos_inadimplentes;
DROP VIEW IF EXISTS v_cobrancas_pendentes;
DROP VIEW IF EXISTS v_parcelas_devidas;

CREATE VIEW v_parcelas_devidas AS
SELECT
  inq.id                                   AS inquilino_id,
  inq.nome_completo,
  inq.telefone,
  im.id                                    AS imovel_id,
  im.titulo,
  im.endereco_bairro,
  im.proprietario_id,
  m.mes::date                              AS mes_referencia,
  (m.mes::date + inq.dia_vencimento - 1)   AS data_vencimento,
  (CURRENT_DATE - (m.mes::date + inq.dia_vencimento - 1))::int AS dias_atraso,
  inq.valor_aluguel                        AS valor,
  ROUND(inq.valor_aluguel * COALESCE(inq.multa_percentual, 0) / 100, 2) AS valor_multa,
  ROUND(
    inq.valor_aluguel
      * COALESCE(inq.juros_percentual, 1) / 100 / 30
      * (CURRENT_DATE - (m.mes::date + inq.dia_vencimento - 1)),
    2
  )                                        AS valor_juros,
  ROUND(
    inq.valor_aluguel
      + inq.valor_aluguel * COALESCE(inq.multa_percentual, 0) / 100
      + inq.valor_aluguel * COALESCE(inq.juros_percentual, 1) / 100 / 30
        * (CURRENT_DATE - (m.mes::date + inq.dia_vencimento - 1)),
    2
  )                                        AS valor_total
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
  );

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

-- Uma linha por inquilino: a parcela mais antiga em aberto, que define o
-- estágio de cobrança.
CREATE VIEW v_cobrancas_pendentes AS
SELECT DISTINCT ON (inquilino_id)
  inquilino_id,
  nome_completo,
  imovel_id,
  titulo,
  proprietario_id,
  NULL::uuid      AS comprovante_id,
  mes_referencia,
  valor_total     AS valor,
  data_vencimento,
  dias_atraso,
  'expired'::text AS situation,
  CASE
    WHEN dias_atraso < 7  THEN 0
    WHEN dias_atraso < 15 THEN 1
    WHEN dias_atraso < 30 THEN 2
    ELSE 3
  END AS estagio_cobranca
FROM v_parcelas_devidas
ORDER BY inquilino_id, data_vencimento;

-- A chave anon fica embarcada no bundle do cliente e não deve ler dados
-- de inquilinos. As telas consultam autenticadas.
REVOKE ALL ON v_parcelas_devidas FROM anon;
REVOKE ALL ON v_inquilinos_inadimplentes FROM anon;
REVOKE ALL ON v_cobrancas_pendentes FROM anon;
GRANT SELECT ON v_parcelas_devidas TO authenticated;
GRANT SELECT ON v_inquilinos_inadimplentes TO authenticated;
GRANT SELECT ON v_cobrancas_pendentes TO authenticated;
