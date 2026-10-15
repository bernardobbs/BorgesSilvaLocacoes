-- 20261015_trancar_receipt_sequences.sql
--
-- ALERTA CRÍTICO DO SUPABASE — rls_disabled_in_public (11/10/2026)
-- "Table publicly accessible: anyone with your project URL can read, edit,
--  and delete all data in this table because Row-Level Security is not
--  enabled."
--
-- A tabela era UMA só: public.receipt_sequences — o contador de numeração
-- de recibos (mes_referencia text, last_seq integer).
--
-- Estado encontrado:
--   relrowsecurity = false
--   anon com SELECT, INSERT, UPDATE e DELETE
--
-- Impacto real: qualquer pessoa com a URL do projeto e a chave anon (que é
-- pública, embarcada no bundle do cliente) podia zerar ou apagar os
-- contadores, fazendo o sistema emitir recibos com números duplicados —
-- documentos de valor legal.
--
-- Por que trancar não quebra nada:
--   - nenhum ponto do código acessa receipt_sequences diretamente
--     (verificado em todo o src/)
--   - a única escrita vem de next_receipt_seq(text), que é SECURITY DEFINER
--     e portanto ignora RLS e grants
--
-- A tabela fica com RLS ligada e SEM policies, de propósito: ninguém deve
-- alcançá-la pela API. O Supabase passa a sinalizar isso como INFO
-- (rls_enabled_no_policy), que aqui é o resultado desejado, não um problema.

ALTER TABLE public.receipt_sequences ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.receipt_sequences FROM anon;
REVOKE ALL ON public.receipt_sequences FROM authenticated;
