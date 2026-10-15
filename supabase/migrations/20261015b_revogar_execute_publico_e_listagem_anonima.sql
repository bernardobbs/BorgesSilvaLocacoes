-- 20261015b_revogar_execute_publico_e_listagem_anonima.sql
--
-- Dois achados colhidos junto com o alerta principal, no mesmo advisor.
--
-- 1) FUNÇÕES SECURITY DEFINER INVOCÁVEIS SEM LOGIN
--    (lint anon_security_definer_function_executable)
--
-- Toda função nasce com EXECUTE concedido ao pseudo-papel PUBLIC, que anon e
-- authenticated herdam. Elas ficam expostas em /rest/v1/rpc/<nome>. Como são
-- SECURITY DEFINER, rodam com os privilégios do dono — ignorando RLS.
--
-- ATENÇÃO ao corrigir: revogar de `anon` sem revogar de `PUBLIC` não tem
-- efeito nenhum, porque o privilégio continua herdado. Foi o que aconteceu na
-- primeira tentativa. É preciso revogar de PUBLIC e então conceder
-- explicitamente a quem precisa.
--
--   next_receipt_seq(text)          — incrementa o contador a cada chamada;
--                                     anônimo podia queimar números em massa
--   handle_new_user()               — função de TRIGGER, não deveria ser RPC;
--                                     revogar EXECUTE não afeta o trigger
--   inquilino_pertence_familia(uuid)— permitia sondar se um UUID pertence
--                                     à família
--   current_user_role()             — auxiliar da RLS de profiles
--   current_family_owner_id()       — auxiliar da RLS; ver item 2

REVOKE EXECUTE ON FUNCTION public.next_receipt_seq(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.next_receipt_seq(text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.next_receipt_seq(text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.inquilino_pertence_familia(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.inquilino_pertence_familia(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.inquilino_pertence_familia(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.current_user_role() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.current_user_role() FROM anon;
GRANT  EXECUTE ON FUNCTION public.current_user_role() TO authenticated;


-- 2) LISTAGEM ANÔNIMA DE IMÓVEIS
--
-- O papel anon tinha SELECT em imoveis, e a policy imoveis_select liberava
-- linhas para não autenticados:
--
--   ... OR (status = 'disponivel' AND auth.uid() IS NULL)
--
-- Na prática qualquer um com a URL do projeto listava endereço, bairro,
-- valor de aluguel e fotos dos imóveis disponíveis. Esse ramo é código
-- morto: nenhuma página pública consulta imoveis (verificado em todo o src/
-- fora de dashboard/ e api/).

REVOKE SELECT ON public.imoveis FROM anon;


-- 3) PENDENTE — não aplicado
--
-- As duas instruções abaixo NÃO foram aplicadas: o DROP POLICY em imoveis
-- estourou o timeout do conector três vezes seguidas, sem qualquer lock
-- visível em pg_stat_activity e sem erro do Postgres nem com lock_timeout.
-- O travamento é da camada de API, não do banco.
--
-- Não são urgentes: com o REVOKE acima, anon não lê imoveis de forma alguma,
-- então o ramo anônimo da policy já é inalcançável. Valem como defesa em
-- profundidade — se alguém reconceder SELECT ao anon no futuro, o buraco
-- reabre. Rode no SQL Editor do dashboard:
--
--   DROP POLICY IF EXISTS imoveis_select ON public.imoveis;
--   CREATE POLICY imoveis_select ON public.imoveis
--   FOR SELECT TO authenticated
--   USING (
--     proprietario_id = auth.uid()
--     OR proprietario_id = current_family_owner_id()
--   );
--
--   REVOKE EXECUTE ON FUNCTION public.current_family_owner_id() FROM PUBLIC;
--   REVOKE EXECUTE ON FUNCTION public.current_family_owner_id() FROM anon;
--   GRANT  EXECUTE ON FUNCTION public.current_family_owner_id() TO authenticated;
--
-- Ordem importa: a policy primeiro. Enquanto o ramo anônimo existir, uma
-- avaliação como anon chamaria a função e falharia por falta de EXECUTE.
