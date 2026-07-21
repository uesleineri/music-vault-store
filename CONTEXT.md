# Contexto do projeto — Gospel VS (music-vault-store)

> Documento de continuidade. Escrito ao final de sessões longas de trabalho pra quem (você ou uma
> IA assistente) retomar o projeto sem precisar reconstruir esse histórico do zero.
> **Não contém segredos reais** (senhas, chaves, tokens) — só indica onde cada um está guardado.

## Sumário

- [O que é o projeto](#o-que-é-o-projeto)
- [Linha do tempo](#linha-do-tempo)
- [Estado atual da infraestrutura](#estado-atual-da-infraestrutura)
- [Onde estão as credenciais](#onde-estão-as-credenciais)
- [O que já foi implementado](#o-que-já-foi-implementado)
- [Segurança](#segurança)
- [Pendências reais (bloqueiam produção real)](#pendências-reais-bloqueiam-produção-real)
- [Roadmap restante](#roadmap-restante)
- [Como retomar o trabalho](#como-retomar-o-trabalho)
- [Lições aprendidas / pegadinhas do projeto](#lições-aprendidas--pegadinhas-do-projeto)

## O que é o projeto

Loja de multitracks (faixas separadas/stems de música gospel) com pagamento via PIX (Asaas) e
entrega automática do arquivo por Google Drive. Painel administrativo completo pra gerenciar
catálogo, kits promocionais, vendas, financeiro, funil de conversão, cupons, administradores e
auditoria. Cliente pode montar carrinho com múltiplos itens (um PIX só), buscar por filtros
avançados (tom, BPM, gênero, idioma), ver recomendações, e tem uma conta própria ("Minha Conta")
criada automaticamente na primeira compra confirmada.

Veja o [README.md](README.md) para a documentação técnica completa (stack, arquitetura, rotas,
schema do banco, Edge Functions). Este arquivo aqui é sobre **histórico e continuidade**, não
documentação de referência — mantenha os dois atualizados quando fizer mudanças grandes.

## Linha do tempo

### Sessão 1 — migração de infraestrutura e fundação

1. **Migração de infraestrutura.** Projeto começou no [Lovable](https://lovable.dev) com um
   Supabase antigo ao qual o dono perdeu acesso. Recuperado via reset de senha do login admin do
   próprio app, extraídos os 5 registros de catálogo e os arquivos de áudio reais do Storage antigo.
2. **Novo Supabase** (`nhbuivrsbiivimeoyqqr`, "Gospel VS", região São Paulo). Schema + RLS + dados
   migrados. **Descoberta importante**: as chaves novas do Supabase (`sb_publishable_`/`sb_secret_`)
   não vêm com os grants de tabela padrão — precisou `GRANT ALL ... TO anon, authenticated,
   service_role` manual, e depois `ALTER DEFAULT PRIVILEGES` pra cobrir tabelas futuras também
   (migrations `20260718233935`/`20260718234405`).
3. **Storage migrado pro Google Drive pessoal** do dono (arquivos de até 500MB+, não cabiam no
   plano grátis do Supabase Storage). Upload resumível direto do navegador pro Drive; entrega por
   compartilhamento individual (não link público).
4. **Revisão de segurança**: webhook da Asaas sem validação de origem → token secreto; preço do
   checkout confiava no navegador → recalculado sempre no servidor; CORS `*` → allowlist; PII em
   logs → mascarada; busca vulnerável a injeção de filtro PostgREST → sanitizada; 2FA (TOTP)
   opcional pra admins.
5. Implementado: Logs de Auditoria, Dashboard analítico, Cupons de desconto.
6. Bugs corrigidos: logo do admin linkando errado, botões de ação desabilitando a linha errada da
   tabela, contador de importação em lote errado, FK de `sales.multitrack_id` que cascade-deletava
   histórico de vendas (trocada pra `RESTRICT`).

### Sessão 2 — roadmap completo (kits, carrinho, financeiro, contas de cliente, e mais)

Sessão muito mais longa que implementou o roadmap quase inteiro, um item por vez, sempre com
migração + Edge Functions + deploy + teste no navegador antes de comitar. Nesta ordem:

7. **Módulo financeiro** — receita bruta/taxas da Asaas/lucro líquido em `/admin/financial`.
   Descoberta: o payload da Asaas (webhook e `GET /v3/payments/:id`) traz `value`/`netValue`, e
   `netValue` é o valor líquido após a taxa — não precisou de nenhuma chamada extra à API.
8. **Kits promocionais (bundles)** — tabelas `bundles`/`bundle_items`, `sales.bundle_id` (nullable,
   junto com `multitrack_id` também virando nullable — uma venda é de exatamente um multitrack OU
   um bundle). Páginas públicas `/kits`, `/kit/:id`, `/checkout/kit/:id`, admin `/admin/bundles`.
9. **Carrinho de compras** — o maior refactor: `sales.checkout_group_id` permite que várias linhas
   (uma por item) compartilhem um único pagamento PIX. `create-payment`/`validate-coupon` passaram
   a receber `items: [...]` em vez de um produto só; `asaas-webhook`/`verify-payment`/
   `get-download`/`resend-download` generalizados pra operar no grupo inteiro (rateio de taxa e
   desconto proporcional, compartilhamento de todos os arquivos, um download_token só por grupo).
   `CartContext` (localStorage) + `CartDrawer` (painel lateral, não página).
10. **Central de notificações** (Supabase Realtime na tabela `sales`) — página `/admin/notifications`
    com badge de não-lidas no menu, eventos da mesma compra (várias linhas, um `checkout_group_id`)
    agrupados numa janela de 500ms pra não notificar 3x o mesmo pedido de carrinho.
11. **Revisão profunda de código** (multi-agente, 8 ângulos) sobre todo o trabalho acima. Achados
    corrigidos: item duplicado no carrinho dobrava a cobrança; divisão por zero num carrinho 100%
    grátis; export CSV do financeiro não reconhecia venda de kit; botão "remover capa" de kit não
    persistia; validação de kit não verificava se as músicas dentro dele ainda estavam ativas;
    compartilhamento no Drive rodando sequencial em vez de paralelo; rateio de taxa dependendo de
    ordem de linha não-determinística; métricas de "vendas" contando linha em vez de pedido
    (`countOrders()` — agrupa por `checkout_group_id`); bug real no `CartContext.addItem` (checava
    duplicata dentro do callback do `setState`, sempre retornava `true`).
12. **Funil de vendas** — tabela `funnel_events` (`checkout_started`→`pix_generated` no navegador,
    `payment_confirmed`→`download_completed` no backend), página `/admin/funnel`.
13. **Busca avançada** — colunas `genre`/`key_signature`/`bpm`/`language` em `multitracks`, painel
    de filtros no `/catalog`. **Achado de bug de ambiente**: `@radix-ui/react-collapsible` 1.1.11
    quebra com "Invalid hook call" nesta versão do React 18 do projeto — usado `if/else` de
    renderização condicional em vez do componente `Collapsible`.
14. **Recomendações** ("Você também pode gostar") — função SQL `get_frequently_bought_with()`
    (`SECURITY DEFINER`, já que `sales` é admin-only) + fallback pra mesmo artista → mesmo gênero →
    mais recentes.
15. **Contas de cliente automáticas + "Minha Conta"** — sem nenhuma mudança no checkout. Na
    confirmação do pagamento (`asaas-webhook`/`verify-payment`), `ensureCustomerAccount()` convida
    automaticamente o comprador via `supabase.auth.admin.inviteUserByEmail()` (mesmo mecanismo já
    usado pra convidar admins) se o e-mail ainda não tem conta. Cliente define a própria senha pelo
    link do e-mail — nunca geramos ou vemos uma senha. RLS nova: cliente logado só vê as próprias
    linhas em `sales` (`buyer_email = auth.jwt() ->> 'email'`). **Decisão de segurança**: o usuário
    queria e-mail+CPF como senha, recusado (CPF não é segredo, baixa entropia) — e depois recusado
    também "gerar senha aleatória e mandar por e-mail" (Supabase Auth não manda e-mail com texto
    livre, só templates fixos) até convergir no fluxo de convite.
16. **`ASAAS_API_KEY` configurada** (chave de produção real fornecida pelo usuário) — checkout
    testado de ponta a ponta com sucesso (gerou QR code PIX real). Descoberto durante o teste: a
    Asaas exige mínimo de R$5,00 por cobrança PIX — adicionada validação amigável (admin e
    checkout) em vez do erro técnico da Asaas estourar pro comprador.
17. Ajustes visuais finais no header: botão "Minha Conta" com cor sólida (`variant="default"`),
    "Catálogo"/"Kits" com contorno (`variant="outline"`).

Todas as mudanças foram commitadas e enviadas pro GitHub (`main`) ao longo do caminho — o histórico
de commits é o registro detalhado de cada passo (mensagens de commit são descritivas).

## Estado atual da infraestrutura

| Peça | Onde | Status |
|---|---|---|
| Banco de dados / Auth / Edge Functions | Supabase, projeto `nhbuivrsbiivimeoyqqr` ("Gospel VS") | ✅ Ativo |
| Arquivos de multitrack | Google Drive pessoal (`uesleineri1@gmail.com`), pasta "Gospel VS - Multitracks" | ✅ Ativo |
| Capas/previews | Supabase Storage (buckets `covers`/`previews`, públicos) | ✅ Ativo |
| Pagamento | Asaas (PIX) | ✅ **`ASAAS_API_KEY` configurada e testada com sucesso** (gerou PIX real) |
| Realtime | Habilitado na tabela `sales` (notificações admin) | ✅ Ativo |
| Contas de cliente | Supabase Auth (convite automático na confirmação de pagamento) | ✅ Ativo, mas depende do item de Redirect URLs nas pendências |
| Frontend em produção | Ainda não confirmado onde está publicado publicamente (possivelmente só Lovable) | ⚠️ A confirmar |
| Repositório | `github.com/uesleineri/music-vault-store`, branch `main` | ✅ Tudo commitado e enviado |

## Onde estão as credenciais

Não estão neste arquivo. Localização de cada uma:

- **`.env` local**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PROJECT_ID`, `VITE_SUPABASE_PUBLISHABLE_KEY`
  (pública por natureza).
- **Secrets das Edge Functions** (`npx supabase secrets list --project-ref nhbuivrsbiivimeoyqqr`):
  `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `ASAAS_WEBHOOK_TOKEN`,
  `ASAAS_API_KEY` (configurada), `ALLOWED_ORIGINS`, `SITE_URL` (novo — usado pra montar o link do
  e-mail de convite de conta de cliente; hoje só tem `http://localhost:8080`).
- **Senha do Postgres**: só o usuário sabe. Resetar em Project Settings → Database se perdida.
- **Login do admin do painel** (`/admin/login`): e-mail `uesleineri1@gmail.com`, senha só o usuário
  sabe. 2FA disponível, desativado no momento.
- **Token de acesso pessoal do Supabase CLI** (`sbp_...`): gerar em
  supabase.com/dashboard/account/tokens quando for usar o CLI numa sessão nova.

## O que já foi implementado

**Loja pública**: catálogo com busca (texto + filtros avançados: gênero, idioma, tom, faixa de
BPM), destaques em carrossel na home, kits promocionais, carrinho (múltiplos itens, um PIX só,
painel lateral), checkout PIX com cupom (single/kit/carrinho), recomendações "Você também pode
gostar", download por token, "Minha Conta" (login e-mail+senha, histórico de compras), tema
claro/escuro.

**Painel admin** (`/admin`): dashboard, multitracks (CRUD + importação em lote + metadados de
busca avançada), kits (CRUD com seletor de músicas), vendas (verificar/cancelar pagamento,
reenviar download, exportar CSV, vendas iniciadas vs. concluídas), financeiro (receita
bruta/taxas/lucro líquido), funil de vendas (checkout iniciado → PIX gerado → pago → download),
cupons, administradores (convite + 2FA), notificações em tempo real (badge no menu), logs de
auditoria.

Consulte o [README.md](README.md) pra detalhes técnicos (schema, Edge Functions).

## Segurança

Preço sempre validado no servidor (inclusive em carrinho multi-item, com checagem de item
duplicado), webhook autenticado, RLS completa (incluindo a política nova que deixa cliente ver só
as próprias vendas via claim do JWT, sem abrir a tabela toda), CORS restrito, PII mascarada em
logs, 2FA disponível, contas de cliente sem senha gerada/emailada em texto puro (fluxo de convite
do Supabase — cliente define a própria senha).

## Pendências reais (bloqueiam produção real)

1. **`ASAAS_WEBHOOK_TOKEN`** está configurado no Supabase, mas **precisa ser colado também no
   painel da Asaas** (Configurações → Integrações → Webhooks) — sem isso dos dois lados, a
   confirmação automática de pagamento não funciona (só a verificação manual pelo admin funcionaria).
2. **`ALLOWED_ORIGINS`** só tem `http://localhost:8080`. Atualizar quando houver domínio de
   produção, senão o checkout para de funcionar em produção (CORS).
3. **`SITE_URL`** (novo secret, usado nos e-mails de convite de conta de cliente) também só tem
   `http://localhost:8080` — mesma atualização necessária.
4. **Supabase Dashboard → Authentication → URL Configuration → Redirect URLs**: precisa ter
   `http://localhost:8080/minha-conta/definir-senha` (e depois a URL de produção) na lista, senão o
   link do e-mail de convite de conta de cliente pode não redirecionar corretamente. Ação manual no
   dashboard, não é código.
5. **Onde o frontend está hospedado em produção não foi confirmado** — resolver antes de anunciar a
   loja publicamente, e então resolver os itens 2 e 3 acima com o domínio real.

## Roadmap restante

Do arquivo original `Novas implementações.md` — quase tudo foi implementado nesta sessão. Só isto
ficou de fora:

**Lado admin:**
- Avaliações e prova social — notas/comentários de compradores, exibição pública
- Recuperação de checkout abandonado — e-mail automático pra PIX gerado e não pago após 2h (precisa
  de agendamento — Supabase Cron — **e de um provedor de e-mail transacional de verdade**, já que o
  único mecanismo de e-mail que funciona hoje é o Supabase Auth, limitado a templates fixos de
  auth — não dá pra mandar um e-mail de marketing/lembrete arbitrário com ele)

**Lado cliente**: nenhum item restante — carrinho, contas de cliente/"Minha Conta", busca
avançada e recomendações foram todos implementados nesta sessão.

## Como retomar o trabalho

```sh
# Rodar localmente
cd "C:\Users\Ueslei Neri\Documents\Music\music-vault-store"
npm install
npm run dev   # sobe em http://localhost:8080

# Aplicar uma migration nova no banco (CLI já autenticado nesta máquina;
# senão precisa de SUPABASE_ACCESS_TOKEN=sbp_... ou supabase login)
npx supabase db push --linked --yes

# Deploy de Edge Functions
npx supabase functions deploy --project-ref nhbuivrsbiivimeoyqqr

# Commit e push
git add -A -- ':!.claude' ':!supabase/.temp'
git commit -m "..."
git push origin main
```

Se for continuar com uma IA assistente numa sessão nova: aponte pra este arquivo (`CONTEXT.md`) e
pro [README.md](README.md) logo no início.

## Lições aprendidas / pegadinhas do projeto

- **Chaves novas do Supabase (`sb_publishable_`/`sb_secret_`) não têm os grants automáticos.**
  `ALTER DEFAULT PRIVILEGES` (rodado uma vez) cobre tabelas criadas depois pela mesma role — não
  precisou repetir o `GRANT ALL` manual pras tabelas novas desta sessão (`bundles`, `funnel_events`,
  etc.), mas vale confirmar se uma tabela nova aparece com erro de permissão mesmo com RLS ok.
- **`supabase.functions.invoke()` do lado do navegador esconde a mensagem real de erro** — qualquer
  resposta não-2xx vira só "Edge Function returned a non-2xx status code" em `error.message`. O
  texto real (`{error: "..."}`) está em `error.context` (a `Response` bruta, não lida ainda) —
  criado `src/lib/functionError.ts` (`getFunctionErrorMessage`) pra extrair isso; usado em todo
  `catch`/`onError` que mostra mensagem de Edge Function pro usuário.
- **Asaas exige PIX de no mínimo R$5,00** — descoberto testando uma cobrança de R$1. Validação
  adicionada tanto no formulário de multitrack (admin) quanto no `create-payment` (cobre carrinho e
  kits também, depois de aplicar cupom).
- **`@radix-ui/react-collapsible` 1.1.11 quebra com "Invalid hook call"** neste projeto (React
  18.3.1) — o hook novo `useEffectEvent`/`useControllableStateReducer` parece incompatível. Evitar
  esse componente; usar renderização condicional simples (`{show && (...)}`) no lugar.
- **CPF não é uma senha segura** — baixa entropia (dígito verificador), circula em boletos/notas
  fiscais/outros cadastros. Não usar como credencial de autenticação.
- **Supabase Auth só manda e-mails com templates fixos** (convite, recuperação de senha, magic
  link, confirmação) — não existe API pra mandar um e-mail com texto livre sem integrar um provedor
  transacional (Resend/SendGrid etc.), que este projeto não tem.
- **O preview/browser desta sessão de trabalho às vezes marca a aba como `document.hidden = true`**,
  o que impede qualquer animação baseada em `requestAnimationFrame` (inclusive `screenshot` da
  ferramenta de preview trava) — nesses casos, verificar o estado real via `read_page`/JS direto em
  vez de depender de screenshot.
- **Sessões de login podem invalidar** (`session_not_found`) depois de múltiplos logins/resets via
  API na mesma conta — relogar antes de assumir bug de código.
- **Google Drive não expõe tamanho de pasta** na API — calculado recursivamente
  (`getAppFolderUsage`).
- **`request.headers` do PostgREST** captura IP/user-agent dentro de triggers SQL
  (`current_setting('request.headers', true)::json ->> 'x-forwarded-for'`) — usado na auditoria.
