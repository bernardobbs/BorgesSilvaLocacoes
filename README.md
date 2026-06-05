# Borges Silva Locações

Sistema de gestão de locações desenvolvido para uso familiar. Gerencia imóveis, inquilinos, pagamentos, cobranças e documentos jurídicos.

## Stack

- **Frontend:** Next.js 16, TypeScript, Tailwind CSS, shadcn/ui
- **Banco de dados:** Supabase (PostgreSQL)
- **Deploy:** Vercel
- **Storage:** Supabase Storage (fotos de imóveis, PDFs)

## Funcionalidades

### Dashboard
- Visão financeira do mês (recebido, a vencer, inadimplente)
- Taxa de ocupação por categoria (Center Lila / Residenciais)
- Inadimplência com botão WhatsApp direto
- Próximos vencimentos (7 dias)
- Notificações de cobrança pendentes
- Acordos em andamento

### Imóveis
- Cadastro com fotos, endereço e dados do locador
- Status: Alugado / Disponível / Manutenção
- Página de detalhe com histórico de pagamentos
- Locador específico por imóvel (independente da configuração global)

### Inquilinos
- Cadastro completo com garantia (fiador, caução, seguro fiança, título, adiantado)
- Condomínio separado do aluguel
- Score de pontualidade (1–5 estrelas) calculado por: pagamentos em dia, cobranças enviadas e acordos
- Histórico financeiro: mensalidades, acordos e parcelas, notificações enviadas
- Meses cobertos por acordo exibidos como "Em acordo" (não como vencido)

### Pagamentos
- Calendário mensal unificado: mensalidades + parcelas de acordo
- Navegação entre meses
- Filtros por situação
- Nome do inquilino e imóvel clicáveis
- Registrar pagamento com forma de pagamento
- Registrar parcela de acordo (modal próprio)

### Cobranças
- Central unificada: notificações pendentes + histórico enviado
- Mensagem WhatsApp consolidada (todos os meses vencidos em uma mensagem)
- Registro automático de cada envio com data, hora e valor
- Filtro por inquilino e estágio

### Estágios de cobrança (configuráveis)
- D+1 → Aviso amigável
- D+15 → Cobrança formal
- D+30 → Pré-extrajudicial
- Progressão bloqueada: estágio 2 só aparece após estágio 1 enviado
- Pausa automática quando há acordo ativo

### Acordos
- Negociação de dívida com desconto e parcelamento
- Preview das parcelas antes de confirmar
- Pagamento de parcelas individual
- Status: Em andamento / Cumprido / Quebrado

### PDFs gerados
- **Comprovante de pagamento** — ao registrar pagamento
- **Notificação extrajudicial** — D+20+, com fundamentação Lei 8.245/91
- **Relatório de dívida** — ao encerrar contrato, com vistoria e garantia
- **Dossiê jurídico** — pacote completo para advogado com histórico, notificações e fundamentação legal
- Assinatura dinâmica: proprietário legal + procurador (quando configurado)

### Encerramento de contrato
- Vistoria de saída com valor de danos
- Garantia executada (abate da dívida)
- Cálculo automático da dívida líquida
- PDF obrigatório quando há dívida
- Imóvel volta para "Disponível" automaticamente

### Ex-inquilinos
- Separados em "Com dívida" e "Sem dívida"
- Histórico completo expandível
- Geração do dossiê jurídico

### Configurações
- Dados do proprietário legal (nome, CPF, endereço, telefone, e-mail)
- Procurador/gestor (aparece nos PDFs como representante por procuração particular)
- Estágios de cobrança: até 5 estágios configuráveis com templates de mensagem
- Membros da família: admin e operador
- Alterar senha

### Autenticação
- Login restrito a membros cadastrados
- Roles: admin (acesso total) e operador (sem configurações)
- Recuperação de senha por e-mail

## Estrutura do banco

```
profiles          — usuários (admin/operador)
imoveis           — imóveis com locador próprio
inquilinos        — contratos com garantia e condomínio
comprovantes      — mensalidades (open/expired/billed)
acordos           — negociações de dívida
parcelas_acordo   — parcelas de cada acordo
notificacoes_cobranca — histórico de cobranças enviadas
config_notificacoes   — estágios configuráveis
config_sistema    — locador padrão e procurador
```

### Views
- `score_inquilinos` — pontuação por pagamentos, cobranças e acordos
- `notificacoes_pendentes` — próximo estágio a enviar por comprovante vencido
- `dividas_ex_inquilinos` — ex-inquilinos com dívida residual

## Configuração local

```bash
# Instalar dependências
npm install

# Variáveis de ambiente
cp .env.example .env.local
# Preencher NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY

# Rodar em desenvolvimento
npm run dev
```

## Variáveis de ambiente

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

## Deploy

O projeto faz deploy automático no Vercel a cada push na branch `main`.

URL de produção: [borges-silva-locacoes.vercel.app](https://borges-silva-locacoes.vercel.app)

---

*Sistema de uso familiar — Borges Silva Locações · Parnaíba, PI*
