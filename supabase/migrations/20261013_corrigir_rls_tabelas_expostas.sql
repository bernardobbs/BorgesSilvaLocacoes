-- =====================================================================
-- ALERTA SUPABASE: "Table publicly accessible" (rls_disabled_in_public)
-- Projeto CenterLila — uwuzzvnbvrobozjpkigv — alerta de 11/10/2026
--
-- Cole no SQL Editor do Supabase: Dashboard > SQL Editor > New query.
-- Rode o PASSO 1 primeiro e guarde o resultado.
-- =====================================================================


-- ---------------------------------------------------------------------
-- PASSO 1 — DIAGNÓSTICO (somente leitura, não altera nada)
--
-- Mostra cada tabela do schema public: se a RLS está ligada, quantas
-- policies existem, e o que o papel `anon` pode fazer. `anon` é a chave
-- pública, embarcada no bundle do cliente — qualquer pessoa com a URL do
-- projeto pode usá-la. Tabela com rls_ativo = false E anon_select = true
-- está exposta à internet.
-- ---------------------------------------------------------------------
SELECT
  c.relname                                   AS tabela,
  c.relrowsecurity                            AS rls_ativo,
  (SELECT count(*) FROM pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = c.relname) AS policies,
  has_table_privilege('anon', format('public.%I', c.relname), 'SELECT') AS anon_le,
  has_table_privilege('anon', format('public.%I', c.relname), 'INSERT') AS anon_insere,
  has_table_privilege('anon', format('public.%I', c.relname), 'UPDATE') AS anon_altera,
  has_table_privilege('anon', format('public.%I', c.relname), 'DELETE') AS anon_apaga
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'          -- só tabelas; views não têm RLS própria
ORDER BY c.relrowsecurity ASC, c.relname;


-- ---------------------------------------------------------------------
-- PASSO 2 — ESTANCAR O VAZAMENTO (seguro, aplicar já)
--
-- Revoga todo acesso do papel `anon` às tabelas de negócio. Isso elimina
-- a exposição descrita no alerta imediatamente.
--
-- Por que é seguro: todas estas tabelas só são acessadas por páginas de
-- /dashboard ou rotas de /api, sempre com usuário autenticado. Nenhuma é
-- lida por página pública. Revogar `anon` não afeta `authenticated` nem
-- `service_role`.
--
-- NÃO substitui ligar a RLS (passo 3) — apenas fecha a porta aberta agora.
-- ---------------------------------------------------------------------
REVOKE ALL ON public.acordos               FROM anon;
REVOKE ALL ON public.auditoria_recibos     FROM anon;
REVOKE ALL ON public.config_notificacoes   FROM anon;
REVOKE ALL ON public.dividas_ex_inquilinos FROM anon;
REVOKE ALL ON public.documentos            FROM anon;
REVOKE ALL ON public.historico_reajustes   FROM anon;
REVOKE ALL ON public.notificacoes_cobranca FROM anon;
REVOKE ALL ON public.parcelas_acordo       FROM anon;

-- config_sistema: só revogue DEPOIS de publicar a correção do keepalive
-- (a rota passou a usar a service role em vez de agir como anon). Se
-- revogar antes, o cron de keepalive começa a responder 500 e o projeto
-- pode ser pausado por inatividade no plano free.
-- REVOKE ALL ON public.config_sistema FROM anon;

-- Se o PASSO 1 revelar outras tabelas com anon_le = true que não estejam
-- nesta lista, acrescente-as antes de rodar.


-- ---------------------------------------------------------------------
-- PASSO 3 — LIGAR A RLS (fazer depois, com as policies corretas)
--
-- ATENÇÃO: ligar a RLS SEM criar policies bloqueia TAMBÉM o papel
-- `authenticated` — o app para de ler essas tabelas e várias telas ficam
-- vazias. Não rode este passo isolado.
--
-- As policies corretas dependem das colunas de cada tabela (qual coluna
-- liga a linha ao inquilino/imóvel/proprietário). Rode o PASSO 1 e envie
-- o resultado junto com a saída da consulta abaixo, que lista as colunas
-- de ligação de cada tabela — com isso dá para escrever as policies
-- exatas, no mesmo padrão já usado em imoveis/inquilinos/comprovantes
-- (função current_family_owner_id()).
-- ---------------------------------------------------------------------
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('acordos','auditoria_recibos','config_notificacoes',
                     'config_sistema','dividas_ex_inquilinos','documentos',
                     'historico_reajustes','notificacoes_cobranca',
                     'parcelas_acordo')
  AND (column_name LIKE '%_id' OR column_name IN ('chave','proprietario_id'))
ORDER BY table_name, ordinal_position;
