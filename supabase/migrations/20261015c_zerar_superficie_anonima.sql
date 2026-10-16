-- 20261015c_zerar_superficie_anonima.sql
--
-- Auditoria completa do que o papel `anon` alcançava. anon é a chave pública,
-- embarcada no bundle do cliente: qualquer pessoa com a URL do projeto a tem.
--
-- Estado encontrado — 12 dos 19 objetos do schema public eram legíveis por
-- anon, e 12 graváveis. A RLS barrava a maior parte, mas de um jeito frágil:
-- as policies fazem EXISTS (SELECT 1 FROM imoveis/profiles ...), e como anon
-- havia perdido acesso a essas duas tabelas, as consultas terminavam em
-- "permission denied for table imoveis" em vez de negar limpo. Ou seja, o
-- bloqueio das demais tabelas dependia de um erro encadeado — bastaria
-- alguém reconceder uma tabela ao anon para derrubar a proteção das outras.
--
-- Dois buracos eram reais, não teóricos:
--
--   dividas_ex_inquilinos e notificacoes_pendentes — VIEWS com SELECT para
--   anon. Views não têm RLS própria e estas são SECURITY DEFINER: ignoram a
--   RLS das tabelas de origem. Estão vazias hoje, então não houve vazamento
--   observável — mas no instante em que surgir um ex-inquilino com dívida ou
--   uma notificação pendente, o dado fica público.
--
--   debug_logs — anon com SELECT/INSERT/UPDATE/DELETE. Bloqueado só pelo
--   erro encadeado descrito acima.
--
-- Verificado antes de revogar: nenhuma destas tabelas ou views é consultada
-- fora de dashboard/ e api/, que rodam sempre autenticados. O perfil no
-- signUp é criado pelo trigger handle_new_user (SECURITY DEFINER), não por
-- INSERT do cliente.

-- Views
REVOKE ALL ON public.dividas_ex_inquilinos  FROM anon;
REVOKE ALL ON public.notificacoes_pendentes FROM anon;
GRANT SELECT ON public.dividas_ex_inquilinos  TO authenticated;
GRANT SELECT ON public.notificacoes_pendentes TO authenticated;

-- Tabelas de negócio
REVOKE ALL ON public.debug_logs            FROM anon;
REVOKE ALL ON public.inquilinos            FROM anon;
REVOKE ALL ON public.comprovantes          FROM anon;
REVOKE ALL ON public.acordos               FROM anon;
REVOKE ALL ON public.parcelas_acordo       FROM anon;
REVOKE ALL ON public.auditoria_recibos     FROM anon;
REVOKE ALL ON public.config_notificacoes   FROM anon;
REVOKE ALL ON public.config_sistema        FROM anon;
REVOKE ALL ON public.historico_reajustes   FROM anon;
REVOKE ALL ON public.notificacoes_cobranca FROM anon;

-- profiles e imoveis: antes só o SELECT havia sido revogado; sobravam
-- INSERT/UPDATE/DELETE. A RLS já barrava (as policies comparam com
-- auth.uid(), que é NULL para anon, e comparação com NULL nunca é
-- verdadeira), mas o grant era superfície sem motivo.
REVOKE ALL ON public.profiles FROM anon;
REVOKE ALL ON public.imoveis  FROM anon;

-- Com anon sem grant algum em imoveis, nenhuma avaliação de policy como anon
-- chama mais esta função. Era o último achado do lint
-- anon_security_definer_function_executable.
REVOKE EXECUTE ON FUNCTION public.current_family_owner_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.current_family_owner_id() FROM anon;
GRANT  EXECUTE ON FUNCTION public.current_family_owner_id() TO authenticated;

-- RESULTADO VERIFICADO
--   objetos legíveis por anon:  0 (de 19)
--   objetos graváveis por anon: 0
--   tabelas sem RLS:            0
--   lint anon_security_definer_function_executable: zerado
--
-- Regressão conferida com JWT real de authenticated: profiles 3, imoveis 15,
-- inquilinos 2, comprovantes 4, v_parcelas_devidas 8, inadimplentes 2,
-- cobrancas_pendentes 2, score 2, debug_logs 10, config_sistema 9.
-- Nenhuma tela perdeu dado.
