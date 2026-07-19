# Gospel VS — Loja de Multitracks

Loja online para venda de multitracks (faixas separadas/stems de música) com pagamento via PIX,
entrega automática do arquivo por e-mail, e um painel administrativo completo para gerenciar
catálogo, vendas e acesso ao sistema.

> Projeto originado no [Lovable](https://lovable.dev), depois migrado para infraestrutura própria
> (Supabase + Google Drive) e evoluído manualmente. Este documento descreve o estado atual real do
> sistema — não é o template genérico gerado na criação do projeto.

## Sumário

- [Visão geral](#visão-geral)
- [Stack tecnológica](#stack-tecnológica)
- [Arquitetura](#arquitetura)
- [Estrutura de pastas](#estrutura-de-pastas)
- [Funcionalidades — Loja pública](#funcionalidades--loja-pública)
- [Funcionalidades — Painel admin](#funcionalidades--painel-admin)
- [Fluxo de pagamento (PIX / Asaas)](#fluxo-de-pagamento-pix--asaas)
- [Armazenamento de arquivos (Google Drive)](#armazenamento-de-arquivos-google-drive)
- [Banco de dados](#banco-de-dados)
- [Edge Functions](#edge-functions)
- [Segurança](#segurança)
- [Rotas](#rotas)
- [Variáveis de ambiente e secrets](#variáveis-de-ambiente-e-secrets)
- [Como rodar localmente](#como-rodar-localmente)
- [Deploy / infraestrutura atual](#deploy--infraestrutura-atual)
- [Limitações conhecidas e pendências](#limitações-conhecidas-e-pendências)

## Visão geral

O visitante navega pelo catálogo, escuta um preview da música, compra via PIX informando e-mail e
CPF, e recebe o link de download automaticamente por e-mail assim que o pagamento é confirmado. O
administrador gerencia tudo isso por um painel próprio: cadastro de músicas (individual ou em
lote), acompanhamento de vendas, verificação manual de pagamentos, reenvio de downloads, controle
de quem tem acesso ao painel, e visão de uso de armazenamento.

Não existe conta de comprador — a compra é feita informando e-mail avulso a cada pedido.

## Stack tecnológica

**Frontend**
- [Vite](https://vitejs.dev/) + [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [React Router v6](https://reactrouter.com/) — roteamento client-side
- [TanStack Query v5](https://tanstack.com/query) — cache e sincronização de dados do servidor
- [shadcn/ui](https://ui.shadcn.com/) + [Radix UI](https://www.radix-ui.com/) — componentes de UI acessíveis
- [Tailwind CSS](https://tailwindcss.com/) — estilização
- [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/) — disponíveis no projeto (via shadcn), pouco usados hoje fora dos componentes de formulário da lib de UI
- [Recharts](https://recharts.org/) — gráficos de vendas no painel admin
- [date-fns](https://date-fns.org/) — formatação de datas (locale pt-BR)
- [Lucide React](https://lucide.dev/) — ícones

**Backend / Infraestrutura**
- [Supabase](https://supabase.com/) — Postgres (banco de dados), Auth (login e 2FA), Storage
  (apenas capas/previews, arquivos pequenos), Edge Functions (Deno, lógica de servidor)
- [Google Drive API](https://developers.google.com/drive) — armazenamento dos arquivos de
  multitrack (podem ser centenas de MB/GB cada), via OAuth2 com conta pessoal do dono da loja
- [Asaas](https://www.asaas.com/) — gateway de pagamento (PIX)

**Ferramentas de build/lint**
- ESLint + typescript-eslint
- SWC (compilação React via `@vitejs/plugin-react-swc`)

## Arquitetura

```
┌─────────────┐      ┌──────────────────┐      ┌─────────────────┐
│  Navegador   │◄────►│  Supabase Auth/DB │◄────►│  Edge Functions  │
│ (React/Vite) │      │   (Postgres+RLS)  │      │      (Deno)      │
└─────────────┘      └──────────────────┘      └────────┬─────────┘
                                                          │
                                        ┌─────────────────┼─────────────────┐
                                        ▼                 ▼                 ▼
                                 ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
                                 │ Google Drive │   │    Asaas     │   │  Deezer /    │
                                 │ (arquivos de │   │ (pagamento   │   │  iTunes API  │
                                 │  multitrack) │   │     PIX)     │   │ (busca capa) │
                                 └─────────────┘   └─────────────┘   └─────────────┘
```

- O **banco de dados** (Postgres via Supabase) guarda só metadados: catálogo (`multitracks`),
  vendas (`sales`) e quem é admin (`admin_users`). Nunca guarda os arquivos de áudio em si.
- **Capas e previews de áudio** (arquivos pequenos, públicos) ficam no Storage do Supabase.
- **Os arquivos de multitrack** (grandes, o produto vendido de fato) ficam no **Google Drive**
  pessoal do dono da loja, organizados em pastas por música. O acesso é concedido por música/comprador
  via API do Drive quando o pagamento é confirmado.
- Toda lógica sensível (validar preço, verificar pagamento, falar com o Drive, gerenciar admins)
  roda em **Edge Functions** no servidor — o frontend nunca tem acesso direto a chaves de API
  externas (Asaas, Google).

## Estrutura de pastas

```
src/
├── components/
│   ├── admin/              # Componentes específicos do painel (import em lote, 2FA)
│   ├── ui/                 # Biblioteca shadcn/ui (não editar manualmente, é gerada)
│   ├── AudioPlayer.tsx      # Player de preview de áudio
│   ├── Header.tsx / Footer.tsx / NavLink.tsx
│   ├── MultitrackCard.tsx  # Card de música no catálogo
│   └── SearchBar.tsx
├── hooks/
│   ├── useAuth.ts          # Sessão, admin check, fluxo de 2FA
│   ├── useMultitracks.ts   # CRUD + busca/paginação do catálogo
│   └── useSales.ts         # Vendas, estatísticas, top vendidas
├── integrations/supabase/  # Cliente Supabase e tipos gerados do banco
├── layouts/
│   ├── PublicLayout.tsx    # Header/Footer da loja
│   └── AdminLayout.tsx     # Sidebar + guarda de rota do painel admin
├── lib/
│   ├── driveUpload.ts      # Upload para o Drive (resumível) e para o Storage (capas/previews)
│   └── utils.ts
├── pages/                  # Páginas públicas (Home, Catalog, Checkout, etc.)
│   └── admin/               # Páginas do painel administrativo
└── types/multitrack.ts     # Tipos TypeScript compartilhados

supabase/
├── functions/               # Edge Functions (Deno) — ver seção própria abaixo
│   └── _shared/              # Código compartilhado entre functions (Drive API, CORS)
└── migrations/               # Histórico de mudanças no schema do banco
```

## Funcionalidades — Loja pública

| Página | Rota | O que faz |
|---|---|---|
| Home | `/` | Hero, busca rápida, destaques (últimas músicas) |
| Catálogo | `/catalog` | Lista paginada (12/página) com busca por artista/música e ordenação (recentes, nome, preço) |
| Detalhes da música | `/multitrack/:id` | Capa, preview de áudio, preço, botão de compra |
| Checkout | `/checkout/:id` | Formulário (nome, e-mail, CPF com validação de dígito verificador, celular), gera PIX (QR Code + código copia-e-cola) |
| Download | `/download/:token` | Acessado pelo link enviado por e-mail; valida token e expiração, entrega o link do Drive |

Só músicas **publicadas** (`is_active = true`) aparecem no catálogo, na home e nos detalhes —
mesmo que alguém tenha o link direto de uma música despublicada, ela não carrega.

## Funcionalidades — Painel admin

Acesso em `/admin/login`. Não existe cadastro público — administradores só são criados por quem já
é admin (tela de Administradores) ou diretamente no banco.

| Seção | Rota | O que faz |
|---|---|---|
| Dashboard | `/admin` | Cards de total de músicas, vendas, receita; lista de mais vendidas; vendas recentes; uso de armazenamento do Google Drive (conta inteira + pasta específica da loja) |
| Multitracks | `/admin/multitracks` | CRUD completo, busca, paginação, toggle publicar/despublicar, busca automática de capa (Deezer/iTunes) ou upload manual, upload de preview de áudio, **importação em lote** (vários arquivos de uma vez, com artista/música sugeridos pelo nome do arquivo) |
| Vendas | `/admin/sales` | Filtro por período, gráficos de vendas/receita por dia, tabela detalhada, **exportar CSV**, **verificar pagamento na Asaas** (para vendas pendentes, sem confiar em clique manual), **reenviar download** (para vendas pagas) |
| Administradores | `/admin/administrators` | Listar/adicionar (convite por e-mail)/remover administradores; ativar/desativar **autenticação em duas etapas (2FA/TOTP)** para a própria conta |

## Fluxo de pagamento (PIX / Asaas)

1. Cliente preenche o checkout → chama a Edge Function `create-payment`.
2. `create-payment` busca o **preço real da música no banco** (nunca confia em valor vindo do
   navegador), cria um registro de venda (`sales`, status `pending`), cria/reaproveita o cliente na
   Asaas e gera uma cobrança PIX. Retorna o QR Code e o código copia-e-cola.
3. Cliente paga pelo app do banco.
4. A Asaas chama o webhook `asaas-webhook` avisando que o pagamento foi confirmado.
   - O webhook **valida um token secreto** enviado pela Asaas antes de processar qualquer coisa
     (sem isso, qualquer request forjado poderia liberar arquivos de graça).
   - Marca a venda como `paid` e compartilha o arquivo do Drive com o e-mail do comprador — o
     próprio Google dispara o e-mail "compartilhou um arquivo com você" automaticamente.
5. Cliente também pode acompanhar pelo link `/download/:token` (token de 48h de validade),
   que reforça o compartilhamento no Drive caso o passo 4 tenha atrasado.
6. Se o webhook falhar por algum motivo, o admin pode clicar em **"Verificar status"** na tela de
   Vendas — que consulta a Asaas de verdade antes de liberar (não é um "marcar como pago" cego).

## Armazenamento de arquivos (Google Drive)

Os arquivos de multitrack (que podem passar de 500 MB cada) ficam na conta pessoal do Google Drive
do dono da loja, não no Supabase — o plano gratuito do Supabase Storage (1 GB) não comportaria o
acervo real (100 GB+).

- Estrutura no Drive: pasta raiz `Gospel VS - Multitracks` → uma subpasta por música
  (`Artista - Música`) → o arquivo em si.
- **Upload**: o navegador nunca manda o arquivo grande para a Edge Function. `drive-init-upload`
  abre uma *sessão de upload resumível* direto com a API do Drive e devolve a URL; o navegador
  sobe o arquivo direto pro Drive por essa URL. Isso evita limites de tamanho/tempo de execução das
  Edge Functions.
- **Entrega**: em vez de link público, o arquivo é compartilhado especificamente com o e-mail de
  quem comprou (`role: reader`, com data de expiração), usando um token OAuth2 de longa duração
  (refresh token) da conta do dono da loja, guardado como secret nas Edge Functions.
- **Uso de armazenamento**: como o Drive não expõe "tamanho de uma pasta" na API, a função
  `drive-usage` percorre a árvore de pastas recursivamente e soma o tamanho de cada arquivo — é
  isso que aparece no card do dashboard.

## Banco de dados

Três tabelas principais (Postgres, com Row Level Security ativado em todas):

**`multitracks`** — catálogo
| Coluna | Tipo | Observação |
|---|---|---|
| `id` | uuid | |
| `artist_name`, `song_name` | text | |
| `price` | numeric | fonte da verdade do preço — nunca confiar no valor vindo do cliente |
| `cover_url` | text | URL pública (Storage ou CDN externo) |
| `file_url` | text | **ID do arquivo no Google Drive** (não é uma URL) |
| `preview_url` | text | URL pública do preview de áudio (Storage) |
| `is_active` | boolean | controla se aparece na loja (publicar/despublicar) |

**`sales`** — pedidos
| Coluna | Tipo | Observação |
|---|---|---|
| `id` | uuid | usado como `externalReference` na Asaas |
| `multitrack_id` | uuid | FK |
| `buyer_email` | text | único dado do comprador que persiste (CPF/nome ficam só na Asaas) |
| `amount` | numeric | calculado no servidor no momento da compra |
| `payment_status` | text | `pending` \| `paid` \| `failed` |
| `payment_id` | text | ID da cobrança na Asaas |
| `download_token` | uuid | token do link `/download/:token` |
| `download_expires_at` | timestamp | validade de 48h |

**`admin_users`** — quem tem acesso ao painel
| Coluna | Tipo |
|---|---|
| `id` | uuid |
| `user_id` | uuid (FK para `auth.users` do Supabase) |

**RLS (resumo):**
- `multitracks`: leitura pública; escrita só por quem está em `admin_users`.
- `sales`: qualquer um pode **criar** (checkout anônimo); só admin pode **atualizar**
  diretamente — na prática, quem muda o status pra `paid` são as Edge Functions
  (via `service_role`, que ignora RLS), não o cliente.
- `admin_users`: **sem política de escrita para clientes** — só uma Edge Function com
  `service_role` pode adicionar/remover administradores (feito assim de propósito).

## Edge Functions

Todas em `supabase/functions/`, rodando em Deno. As marcadas "admin" verificam a sessão do usuário
e conferem se ele está em `admin_users` antes de fazer qualquer coisa.

| Function | Quem chama | Propósito |
|---|---|---|
| `create-payment` | Checkout (público) | Cria a venda e a cobrança PIX na Asaas; recalcula o preço no servidor |
| `asaas-webhook` | Asaas (servidor a servidor) | Confirma pagamento e libera o arquivo; exige token de autenticação |
| `get-download` | Página de download (público, token na URL) | Retorna o link do Drive pro comprador |
| `search-cover` | Painel admin | Busca capas no Deezer/iTunes por artista+música |
| `drive-init-upload` | Painel admin | Abre sessão de upload resumível pro Drive |
| `verify-payment` | Painel admin | Confere status real na Asaas antes de marcar venda como paga |
| `resend-download` | Painel admin | Reenvia o compartilhamento do Drive (força novo e-mail) |
| `manage-admins` | Painel admin | Lista, convida e remove administradores |
| `drive-usage` | Painel admin | Cota da conta do Drive + tamanho da pasta da loja |

Código compartilhado entre elas fica em `supabase/functions/_shared/`:
`google-drive.ts` (toda a integração com a API do Drive) e `cors.ts` (allowlist de origens).

## Segurança

Itens implementados após uma revisão de segurança dedicada:

- **Preço nunca confia no cliente** — sempre recalculado a partir do banco em `create-payment`.
- **Webhook da Asaas autenticado** por token secreto (`ASAAS_WEBHOOK_TOKEN`), evitando que
  qualquer request forjado libere arquivos de graça.
- **RLS em todas as tabelas**, com `admin_users` só gravável via função privilegiada.
- **CORS restrito** por allowlist (`ALLOWED_ORIGINS`) em vez de `*` liberado pra qualquer site.
- **PII mascarada nos logs** — CPF, telefone e e-mail são mascarados antes de qualquer log das
  Edge Functions relacionadas a pagamento.
- **Sanitização de busca** — caracteres especiais do PostgREST (`, ( ) % _`) são removidos do termo
  de busca antes de montar o filtro, evitando injeção de filtro.
- **Sem auto-cadastro de admin** — só quem já é admin pode convidar outro.
- **2FA (TOTP) opcional** por administrador, com QR Code de ativação e exigência do código no
  login quando ativado.
- **Token de download** aleatório (UUID) com expiração de 48h, sem enumeração possível.
- **Arquivos de multitrack nunca públicos** — sempre compartilhados individualmente por e-mail do
  comprador, com expiração, não por link aberto.

## Rotas

```
Públicas (PublicLayout)
  /                       Home
  /catalog                Catálogo
  /multitrack/:id         Detalhes da música
  /checkout/:id           Checkout / PIX

Sem layout
  /download/:token        Página de download

Admin (AdminLayout, protegido)
  /admin/login             Login (+ 2FA quando ativado)
  /admin                   Dashboard
  /admin/multitracks       Gestão do catálogo
  /admin/sales              Gestão de vendas
  /admin/administrators    Gestão de administradores e 2FA

Fallback
  *                        Página 404
```

## Variáveis de ambiente e secrets

**Frontend** (`.env`, valores públicos — feito pra ir no bundle do navegador):
```
VITE_SUPABASE_URL=
VITE_SUPABASE_PROJECT_ID=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

**Edge Functions** (secrets no Supabase, nunca expostos ao navegador):
| Secret | Uso |
|---|---|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REFRESH_TOKEN` | Acesso à API do Google Drive |
| `ASAAS_API_KEY` | Autenticação com a API da Asaas (**pendente de configurar**) |
| `ASAAS_WEBHOOK_TOKEN` | Validação do webhook de pagamento |
| `ALLOWED_ORIGINS` | Lista de origens permitidas por CORS (hoje só `localhost:8080`) |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | Injetadas automaticamente pelo Supabase, não precisam ser configuradas manualmente |

## Como rodar localmente

Requisitos: Node.js e npm.

```sh
git clone https://github.com/uesleineri/music-vault-store.git
cd music-vault-store
npm install
npm run dev
```

O servidor sobe em `http://localhost:8080`. É necessário ter o `.env` preenchido com as
credenciais do projeto Supabase (não versionadas com valores reais de produção).

Para alterações no backend (Edge Functions, migrations), é necessário o
[Supabase CLI](https://supabase.com/docs/guides/cli) e as credenciais de acesso ao projeto.

## Deploy / infraestrutura atual

- **Banco de dados e Edge Functions**: projeto Supabase próprio (região São Paulo).
- **Arquivos de multitrack**: Google Drive pessoal do dono da loja.
- **Pagamento**: Asaas (chave de API ainda não configurada — checkout gera erro até isso ser feito).
- **Hospedagem do frontend**: originalmente pensado para Vercel; não há confirmação de qual
  provedor está servindo o site publicamente hoje (possivelmente ainda via Lovable). Isso não
  afeta o funcionamento local nem o backend, mas é preciso confirmar antes de apontar um domínio
  próprio — inclusive porque `ALLOWED_ORIGINS` precisa ser atualizado com esse domínio real.

## Limitações conhecidas e pendências

- **Pagamento ainda não está ao vivo** — falta configurar `ASAAS_API_KEY`.
- **CORS liberado só para localhost** — falta adicionar o domínio de produção em `ALLOWED_ORIGINS`
  assim que ele for definido.
- **Sem conta de comprador** — histórico de compra e reenvio de download são só via e-mail avulso
  ou pelo admin; um sistema de contas para autoatendimento é uma evolução possível, não implementada.
- **Sem testes automatizados.**
- **`src/pages/Index.tsx` não é usado** — sobra do template inicial do Lovable, substituída por
  `Home.tsx`; pode ser removida com segurança.
