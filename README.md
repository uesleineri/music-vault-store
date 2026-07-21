# Gospel VS — Loja de Multitracks

Loja online para venda de multitracks (faixas separadas/stems de música) com pagamento via PIX,
carrinho de compras, kits promocionais, entrega automática do arquivo, conta de cliente própria, e
um painel administrativo completo (vendas, financeiro, funil de conversão, notificações em tempo
real, auditoria).

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
- [Carrinho e checkout (single item, kit, ou carrinho multi-item)](#carrinho-e-checkout-single-item-kit-ou-carrinho-multi-item)
- [Fluxo de pagamento (PIX / Asaas)](#fluxo-de-pagamento-pix--asaas)
- [Contas de cliente ("Minha Conta")](#contas-de-cliente-minha-conta)
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

O visitante navega pelo catálogo (com busca por texto e filtros avançados de tom/BPM/gênero/
idioma), escuta um preview, e pode comprar uma música só, um kit promocional, ou montar um
carrinho com vários itens — sempre um único pagamento PIX no final. Recebe o link de download por
e-mail (compartilhamento do Drive) assim que o pagamento é confirmado, e ganha automaticamente uma
conta ("Minha Conta") pra ver o histórico de compras depois, sem precisar preencher nada extra no
checkout.

O administrador gerencia tudo por um painel próprio: catálogo (individual ou em lote), kits,
vendas (com funil de conversão e financeiro), cupons, administradores, e recebe notificação em
tempo real de cada novo pedido/pagamento confirmado.

## Stack tecnológica

**Frontend**
- [Vite](https://vitejs.dev/) + [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [React Router v6](https://reactrouter.com/) — roteamento client-side
- [TanStack Query v5](https://tanstack.com/query) — cache e sincronização de dados do servidor
- [shadcn/ui](https://ui.shadcn.com/) + [Radix UI](https://www.radix-ui.com/) — componentes de UI acessíveis
  (⚠️ ver [Limitações](#limitações-conhecidas-e-pendências) — `@radix-ui/react-collapsible` não é usável aqui)
- [Tailwind CSS](https://tailwindcss.com/) — estilização
- [Recharts](https://recharts.org/) — gráficos (vendas, financeiro, funil) e carrossel de destaques (embla)
- [date-fns](https://date-fns.org/) — formatação de datas (locale pt-BR)
- [Lucide React](https://lucide.dev/) — ícones

**Backend / Infraestrutura**
- [Supabase](https://supabase.com/) — Postgres (banco), Auth (admin + cliente, 2FA, contas
  automáticas), Storage (capas/previews), Edge Functions (Deno), Realtime (notificações)
- [Google Drive API](https://developers.google.com/drive) — armazenamento dos arquivos de
  multitrack, via OAuth2 com conta pessoal do dono da loja
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

- O **banco de dados** guarda só metadados: catálogo (`multitracks`), kits (`bundles`/
  `bundle_items`), pedidos (`sales`), eventos de funil (`funnel_events`), quem é admin
  (`admin_users`). Nunca guarda os arquivos de áudio em si.
- **Capas e previews** ficam no Storage do Supabase (público).
- **Os arquivos de multitrack** ficam no **Google Drive** pessoal do dono da loja, compartilhados
  individualmente por comprador quando o pagamento é confirmado.
- Toda lógica sensível (validar preço, pagamento, Drive, contas, admins) roda em **Edge
  Functions** — o frontend nunca tem acesso direto a chaves externas (Asaas, Google).
- **Realtime** do Supabase entrega eventos de `INSERT`/`UPDATE` em `sales` direto pro painel admin
  (notificações), sem polling.

## Estrutura de pastas

```
src/
├── components/
│   ├── admin/               # Componentes do painel (import em lote, 2FA)
│   ├── ui/                  # Biblioteca shadcn/ui (gerada, evitar editar à mão)
│   ├── AudioPlayer.tsx       # Player de preview
│   ├── BundleCard.tsx / MultitrackCard.tsx  # Cards de produto (kit vs. multitrack)
│   ├── CartDrawer.tsx        # Painel lateral do carrinho
│   ├── Header.tsx / Footer.tsx
│   └── SearchBar.tsx
├── contexts/
│   ├── CartContext.tsx              # Carrinho (localStorage)
│   └── AdminNotificationsContext.tsx # Assinatura Realtime compartilhada (badge + página)
├── hooks/
│   ├── useAuth.ts / useCustomerAuth.ts  # Sessão de admin (MFA) vs. cliente (sem MFA)
│   ├── useMultitracks.ts / useBundles.ts / useSales.ts / useFunnel.ts
├── integrations/supabase/   # Cliente Supabase e tipos gerados do banco
├── layouts/
│   ├── PublicLayout.tsx
│   └── AdminLayout.tsx
├── lib/
│   ├── driveUpload.ts        # Upload pro Drive (resumível) e Storage (capas/previews)
│   ├── funnel.ts             # Log de eventos de funil (client-side)
│   ├── functionError.ts      # Extrai a mensagem real de erro de uma Edge Function
│   └── utils.ts
├── pages/                    # Páginas públicas (Home, Catalog, Checkout, Cart, MyAccount, ...)
│   └── admin/                 # Páginas do painel administrativo
└── types/multitrack.ts       # Tipos TypeScript compartilhados

supabase/
├── functions/                 # Edge Functions (Deno)
│   └── _shared/                # cors.ts, audit.ts, google-drive.ts, coupons.ts,
│                                # sale-items.ts, checkout-group.ts, customer-account.ts
└── migrations/                 # Histórico de mudanças no schema do banco
```

## Funcionalidades — Loja pública

| Página | Rota | O que faz |
|---|---|---|
| Home | `/` | Hero, busca rápida, carrossel de destaques, kits promocionais (se houver algum publicado) |
| Catálogo | `/catalog` | Busca por artista/música + **filtros avançados** (gênero, idioma, tom, faixa de BPM) e ordenação |
| Detalhes da música | `/multitrack/:id` | Capa, preview, preço, "Comprar agora" ou "Adicionar ao carrinho", recomendações "Você também pode gostar" |
| Kits | `/kits`, `/kit/:id` | Catálogo e detalhe de kits promocionais (várias músicas, preço fixo) |
| Carrinho | `/cart` (também acessível pelo painel lateral no header) | Lista de itens, remover, ir pro checkout |
| Checkout | `/checkout/:id` (multitrack), `/checkout/kit/:id` (kit), `/checkout` (carrinho) | Formulário + cupom, gera **um único PIX** mesmo com vários itens |
| Download | `/download/:token` | Token de 48h; entrega o link do Drive de todos os itens da compra |
| Minha Conta | `/minha-conta`, `/minha-conta/definir-senha` | Login e-mail+senha, histórico de compras; conta criada automaticamente na confirmação do pagamento |

Só músicas/kits **publicados** (`is_active = true`) aparecem na loja.

## Funcionalidades — Painel admin

Acesso em `/admin/login`. Administradores só são criados por quem já é admin.

| Seção | Rota | O que faz |
|---|---|---|
| Dashboard | `/admin` | Cards de vendas concluídas/receita/ticket médio/conversão, mais vendidas, vendas recentes, uso do Drive |
| Multitracks | `/admin/multitracks` | CRUD, importação em lote, busca de capa (Deezer/iTunes), metadados de busca avançada (gênero/tom/BPM/idioma) |
| Kits | `/admin/bundles` | CRUD de kits com seletor de músicas |
| Vendas | `/admin/sales` | Vendas iniciadas vs. concluídas, gráficos por dia, exportar CSV, **verificar pagamento**, **cancelar venda travada**, **reenviar download** |
| Financeiro | `/admin/financial` | Receita bruta, taxas da Asaas, lucro líquido, por período |
| Funil de Vendas | `/admin/funnel` | Checkout iniciado → PIX gerado → pago → download realizado, com taxa de queda entre etapas |
| Notificações | `/admin/notifications` | Feed de pedidos/pagamentos em tempo real (Realtime), badge de não-lidas no menu |
| Cupons | `/admin/coupons` | CRUD de cupons de desconto |
| Administradores | `/admin/administrators` | Convite/remoção de admins, 2FA (TOTP) própria |
| Logs de Auditoria | `/admin/audit-logs` | Quem fez o quê, quando, o que mudou (multitracks, kits, cupons, admins, vendas) |

## Carrinho e checkout (single item, kit, ou carrinho multi-item)

Uma venda pode ser de exatamente **um** multitrack, **um** kit, ou **vários itens de um carrinho**
— nos três casos o modelo de dados é o mesmo: uma linha em `sales` por item, todas compartilhando
um `checkout_group_id` gerado no momento do checkout. Isso permite:

- Um **único pagamento PIX** cobrindo N itens (o valor da cobrança é a soma de todos).
- Desconto de cupom e taxa da Asaas **rateados proporcionalmente** entre as linhas do grupo, pra
  relatórios financeiros por item continuarem corretos.
- `asaas-webhook`/`verify-payment`/`get-download`/`resend-download` operam sobre **o grupo
  inteiro** (`.eq('checkout_group_id', ...)`), não numa linha isolada — confirmar pagamento libera
  todos os arquivos do grupo de uma vez, com um `download_token` só.

`create-payment` e `validate-coupon` recebem `items: [{multitrack_id} | {bundle_id}]` — nunca um
produto singular — e rejeitam item duplicado e kit com música interna despublicada.

## Fluxo de pagamento (PIX / Asaas)

1. Cliente finaliza o checkout (item único, kit, ou carrinho) → `create-payment`.
2. `create-payment` recalcula o **preço real no banco** pra cada item (nunca confia no navegador),
   valida que o total é **≥ R$5,00** (mínimo da Asaas pra PIX), cria as linhas de `sales`
   (`pending`, todas com o mesmo `checkout_group_id`), cria/reaproveita o cliente na Asaas e gera
   **uma** cobrança PIX pro total. Retorna QR Code + copia-e-cola.
3. Cliente paga.
4. A Asaas chama `asaas-webhook` (token secreto validado antes de processar qualquer coisa):
   marca todo o grupo como `paid`, rateia a taxa da Asaas entre as linhas, compartilha cada
   arquivo do Drive com o comprador, registra o evento de funil, e **cria a conta do cliente**
   (convite por e-mail) se ainda não existir uma pra esse e-mail.
5. Cliente acompanha por `/download/:token` (48h) ou por "Minha Conta".
6. Se o webhook falhar, o admin usa **"Verificar status"** em Vendas (consulta a Asaas de
   verdade) — ou **"Cancelar"** se a venda nunca teve uma cobrança válida criada (ex: preço abaixo
   do mínimo antes da validação existir).

## Contas de cliente ("Minha Conta")

Não existe nenhum campo de cadastro no checkout. A conta nasce como efeito colateral da
confirmação de pagamento: `ensureCustomerAccount()` (chamado por `asaas-webhook` e
`verify-payment`) verifica se o e-mail do comprador já tem uma conta Supabase Auth e, se não
tiver, chama `supabase.auth.admin.inviteUserByEmail()` — o mesmo mecanismo já usado pra convidar
administradores. O Supabase manda o e-mail de convite nativo; o cliente define a própria senha
pelo link. Nenhuma senha é gerada ou vista pelo servidor.

Uma política de RLS adicional em `sales` (`buyer_email = auth.jwt() ->> 'email'`) deixa o cliente
logado ler só as próprias compras — aditiva à política de admin (não restringe o acesso do admin).

## Armazenamento de arquivos (Google Drive)

- Estrutura no Drive: pasta raiz `Gospel VS - Multitracks` → uma subpasta por música → o arquivo.
- **Upload**: resumível, direto do navegador pro Drive via `drive-init-upload`.
- **Entrega**: compartilhamento individual por e-mail (`role: reader`, com expiração), nunca link
  público. Para uma compra de vários itens (kit/carrinho), todos os arquivos do grupo são
  compartilhados de uma vez.
- **Uso de armazenamento**: `drive-usage` percorre a árvore de pastas recursivamente (o Drive não
  expõe "tamanho de pasta" nativamente).

## Banco de dados

Tabelas principais (Postgres, RLS ativado em todas):

**`multitracks`** — catálogo: `id`, `artist_name`, `song_name`, `price`, `cover_url`, `file_url`
(ID do arquivo no Drive), `preview_url`, `is_active`, e metadados de busca avançada — `genre`,
`key_signature` (tom), `bpm`, `language` (todos opcionais).

**`bundles`** — kits promocionais: `id`, `name`, `description`, `price`, `cover_url`,
`is_active`. **`bundle_items`**: junção `bundle_id` ↔ `multitrack_id`.

**`sales`** — linhas de pedido (uma por item comprado): `id`, `checkout_group_id` (agrupa todas
as linhas do mesmo pagamento PIX), `multitrack_id` **ou** `bundle_id` (exatamente um dos dois,
`CHECK` constraint), `buyer_email`, `amount`, `discount_amount`, `coupon_id`, `payment_status`
(`pending`/`paid`/`failed`), `payment_id` (Asaas), `asaas_fee`/`net_amount` (rateados do payload
da Asaas), `download_token` (compartilhado por todo o grupo), `download_expires_at`.

**`funnel_events`** — `event_type` (`checkout_started`/`pix_generated`/`payment_confirmed`/
`download_completed`), `session_id` (correlaciona os dois primeiros, antes de existir uma venda),
`checkout_group_id` (correlaciona os dois últimos).

**`coupons`**, **`admin_users`**, **`audit_logs`** — cupons de desconto, quem é admin, e log de
auditoria (com trigger `SECURITY DEFINER` em `multitracks`/`coupons`/`bundles`).

**RLS (resumo):**
- `multitracks`/`bundles`/`bundle_items`: leitura pública; escrita só admin.
- `sales`: qualquer um pode **criar**; **admin** lê tudo; **cliente logado** lê só as próprias
  linhas (`buyer_email = auth.jwt() ->> 'email'`) — políticas de SELECT são aditivas (OR'd).
- `funnel_events`: qualquer um insere (`checkout_started`/`pix_generated` são anônimos por
  natureza); só admin lê.
- `admin_users`/`coupons`/`audit_logs`: sem escrita direta do cliente — só via Edge Function
  `service_role` ou trigger `SECURITY DEFINER`.
- Função `get_frequently_bought_with()` (`SECURITY DEFINER`) expõe só `multitrack_id` + contagem
  de `sales` pra recomendações, sem abrir a tabela em si pro público.

## Edge Functions

Todas em `supabase/functions/`, Deno. As de admin verificam sessão + `admin_users`.

| Function | Quem chama | Propósito |
|---|---|---|
| `create-payment` | Checkout (público) | Recebe `items[]`, recalcula preço, valida mínimo de R$5, cria o grupo de vendas e a cobrança PIX |
| `validate-coupon` | Checkout (público) | Pré-visualiza desconto de cupom pra `items[]`, sem confiar no resultado pro cobrança real |
| `asaas-webhook` | Asaas (servidor a servidor) | Confirma/falha pagamento do grupo, rateia taxa, libera arquivos, cria conta de cliente; exige token |
| `verify-payment` | Painel admin | Confirma manualmente consultando a Asaas de verdade (não é "marcar como pago" cego) |
| `cancel-sale` | Painel admin | Marca uma venda travada (sem `payment_id` válido) como `failed` |
| `resend-download` | Painel admin | Reenvia o compartilhamento do Drive pra todo o grupo |
| `get-download` | Página de download (público, token) | Retorna os links do Drive de todos os itens do grupo |
| `manage-admins` | Painel admin | Lista, convida e remove administradores |
| `search-cover` | Painel admin | Busca capas no Deezer/iTunes |
| `drive-init-upload` | Painel admin | Abre sessão de upload resumível pro Drive |
| `drive-usage` | Painel admin | Cota do Drive + tamanho da pasta da loja |

Compartilhado em `supabase/functions/_shared/`: `google-drive.ts`, `cors.ts`, `audit.ts`,
`coupons.ts`, `sale-items.ts` (resolve os arquivos de uma linha, multitrack ou kit),
`checkout-group.ts` (rateio de taxa/desconto, descrição do grupo), `customer-account.ts` (convite
automático de conta de cliente).

## Segurança

- **Preço nunca confia no cliente** — recalculado no servidor, inclusive somando `items[]` de
  carrinho, com checagem de item duplicado e mínimo de R$5 (regra da Asaas).
- **Webhook autenticado** por token secreto.
- **RLS completa**, incluindo a política aditiva que deixa cliente ver só as próprias vendas.
- **CORS restrito** por allowlist.
- **PII mascarada** nos logs de pagamento.
- **Sanitização de busca** contra injeção de filtro PostgREST.
- **2FA (TOTP) opcional** por administrador.
- **Contas de cliente sem senha gerada/emailada em texto puro** — fluxo de convite do Supabase,
  cliente define a própria senha.
- **Token de download** aleatório, expira em 48h.
- **Arquivos nunca públicos** — compartilhados individualmente, com expiração.

## Rotas

```
Públicas (PublicLayout)
  /                          Home
  /catalog                   Catálogo (com filtros avançados)
  /multitrack/:id            Detalhes da música + recomendações
  /checkout/:id              Checkout de um multitrack
  /kits                      Catálogo de kits
  /kit/:id                   Detalhes do kit
  /checkout/kit/:id          Checkout de um kit
  /cart                      Carrinho (página completa; também via painel lateral no header)
  /checkout                  Checkout do carrinho (múltiplos itens, um PIX só)
  /minha-conta               Login / histórico de compras do cliente
  /minha-conta/definir-senha Destino do e-mail de convite/recuperação de senha

Sem layout
  /download/:token           Página de download

Admin (AdminLayout, protegido)
  /admin/login               Login (+ 2FA quando ativado)
  /admin                     Dashboard
  /admin/multitracks         Gestão do catálogo
  /admin/bundles             Gestão de kits
  /admin/sales               Gestão de vendas
  /admin/financial           Financeiro
  /admin/funnel              Funil de vendas
  /admin/notifications       Notificações em tempo real
  /admin/coupons             Cupons
  /admin/administrators      Administradores e 2FA
  /admin/audit-logs          Logs de auditoria

Fallback
  *                          Página 404
```

## Variáveis de ambiente e secrets

**Frontend** (`.env`, valores públicos):
```
VITE_SUPABASE_URL=
VITE_SUPABASE_PROJECT_ID=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

**Edge Functions** (secrets no Supabase, nunca expostos ao navegador):
| Secret | Uso |
|---|---|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REFRESH_TOKEN` | Acesso à API do Google Drive |
| `ASAAS_API_KEY` | Autenticação com a API da Asaas — **configurada** |
| `ASAAS_WEBHOOK_TOKEN` | Validação do webhook — configurado no Supabase, **falta colar no painel da Asaas também** |
| `ALLOWED_ORIGINS` | Allowlist de CORS (hoje só `localhost:8080`) |
| `SITE_URL` | Base URL usada no link do e-mail de convite de conta de cliente (hoje só `localhost:8080`) |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | Injetadas automaticamente pelo Supabase |

**Configuração fora do código**: Supabase Dashboard → Authentication → URL Configuration →
Redirect URLs precisa incluir `.../minha-conta/definir-senha` pro link de convite/recuperação de
senha do cliente funcionar.

## Como rodar localmente

Requisitos: Node.js e npm.

```sh
git clone https://github.com/uesleineri/music-vault-store.git
cd music-vault-store
npm install
npm run dev
```

O servidor sobe em `http://localhost:8080`. É necessário ter o `.env` preenchido com as
credenciais do projeto Supabase.

Para alterações no backend (Edge Functions, migrations), é necessário o
[Supabase CLI](https://supabase.com/docs/guides/cli) e as credenciais de acesso ao projeto.

## Deploy / infraestrutura atual

- **Banco de dados, Auth e Edge Functions**: projeto Supabase próprio (região São Paulo).
- **Arquivos de multitrack**: Google Drive pessoal do dono da loja.
- **Pagamento**: Asaas, chave configurada e testada com sucesso (PIX real gerado).
- **Hospedagem do frontend**: ainda não confirmada publicamente (possivelmente só Lovable) — isso
  não afeta o funcionamento local/backend, mas precisa ser resolvido antes de apontar um domínio
  próprio (e então atualizar `ALLOWED_ORIGINS`/`SITE_URL`/Redirect URLs com o domínio real).

## Limitações conhecidas e pendências

- **`ASAAS_WEBHOOK_TOKEN` precisa ser colado no painel da Asaas** (Configurações → Integrações →
  Webhooks) além de já estar no Supabase — sem isso dos dois lados, a confirmação automática via
  webhook não funciona (só a manual pelo admin).
- **`ALLOWED_ORIGINS`/`SITE_URL` só têm `localhost:8080`** — atualizar com o domínio real quando
  ele existir.
- **Redirect URLs do Supabase Auth** precisam incluir a URL de "definir senha" pro fluxo de conta
  de cliente funcionar em produção.
- **`@radix-ui/react-collapsible` não é usável neste projeto** — a versão instalada (1.1.11) quebra
  com "Invalid hook call" sob React 18.3.1 (parece ser o novo hook `useEffectEvent`/
  `useControllableStateReducer` incompatível). Usar renderização condicional simples em vez desse
  componente até isso ser investigado/corrigido com uma versão diferente.
- **Sem provedor de e-mail transacional** — o único mecanismo de envio de e-mail que funciona hoje
  é o Supabase Auth (templates fixos: convite, recuperação de senha). Funcionalidades que precisem
  de e-mail com conteúdo livre (ex: recuperação de checkout abandonado) precisam de um provedor
  novo (Resend/SendGrid etc.).
- **Sem testes automatizados.**
- **`src/pages/Index.tsx` não é usado** — sobra do template inicial do Lovable; pode ser removida.
