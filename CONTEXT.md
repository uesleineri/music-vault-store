# Contexto do projeto — Gospel VS (music-vault-store)

> Documento de continuidade. Escrito ao final de uma sessão longa de trabalho pra quem (você ou uma
> IA assistente) retomar o projeto do zero, sem precisar reconstruir esse histórico do zero.
> **Não contém segredos reais** (senhas, chaves, tokens) — só indica onde cada um está guardado.

## Sumário

- [O que é o projeto](#o-que-é-o-projeto)
- [Linha do tempo desta sessão](#linha-do-tempo-desta-sessão)
- [Estado atual da infraestrutura](#estado-atual-da-infraestrutura)
- [Onde estão as credenciais](#onde-estão-as-credenciais)
- [O que já foi implementado](#o-que-já-foi-implementado)
- [Segurança — o que foi corrigido](#segurança--o-que-foi-corrigido)
- [Bugs corrigidos](#bugs-corrigidos)
- [Pendências reais (bloqueiam produção)](#pendências-reais-bloqueiam-produção)
- [Roadmap restante](#roadmap-restante)
- [Como retomar o trabalho](#como-retomar-o-trabalho)
- [Lições aprendidas / pegadinhas do projeto](#lições-aprendidas--pegadinhas-do-projeto)

## O que é o projeto

Loja de multitracks (faixas separadas/stems de música gospel) com pagamento via PIX (Asaas) e
entrega automática do arquivo por e-mail via Google Drive. Painel administrativo completo pra
gerenciar catálogo, vendas, cupons, administradores e auditoria.

Veja o [README.md](README.md) para a documentação técnica completa (stack, arquitetura, rotas,
schema do banco, Edge Functions). Este arquivo aqui é sobre **histórico e continuidade**, não
documentação de referência.

## Linha do tempo desta sessão

1. **Migração de infraestrutura.** O projeto começou hospedado no [Lovable](https://lovable.dev)
   com um Supabase antigo (`nskbbfpciuoredlkezhw`) ao qual o dono perdeu acesso à conta (não sabia
   mais o e-mail/senha da conta Supabase, só do login admin do próprio app). Foi feita uma
   recuperação: login no app antigo via reset de senha, extração dos 5 registros de catálogo e dos
   arquivos de áudio reais (até 653MB cada) do Storage privado do projeto antigo.
2. **Novo Supabase.** Criado projeto novo (`nhbuivrsbiivimeoyqqr`, nome "Gospel VS", org "Ueslei
   Neri", região São Paulo) na conta principal do dono. Schema + RLS + os 5 registros + arquivos
   migrados. **Descoberta importante**: as chaves novas do Supabase (`sb_publishable_`/`sb_secret_`)
   não vêm com os grants de tabela padrão (`GRANT SELECT/INSERT/...`) que as chaves antigas tinham —
   foi preciso rodar `GRANT ALL ... TO anon, authenticated, service_role` manualmente (ver migrations
   `20260718233935` e `20260718234405`).
3. **Armazenamento migrado para Google Drive.** Os arquivos de multitrack (100GB+ no total, alguns
   arquivos de 500MB+) não cabiam no plano gratuito do Supabase Storage (1GB). Decisão: manter
   banco/auth/functions no Supabase (grátis) e mover os arquivos de áudio pro Google Drive pessoal
   do dono (5TB de espaço), via OAuth2 com refresh token de longa duração. Upload é resumível
   (o navegador sobe direto pro Drive, sem passar pela Edge Function) e a entrega é por
   compartilhamento individual (não link público) — o comprador recebe o e-mail nativo do Google
   "compartilhou um arquivo com você".
4. **Revisão de segurança pedida pelo usuário**, seguida de correções:
   - **Crítico**: webhook da Asaas não validava origem (qualquer um podia forjar "pagamento
     confirmado" e liberar arquivo de graça) → corrigido com token secreto (`ASAAS_WEBHOOK_TOKEN`).
   - **Crítico**: preço da compra vinha do que o navegador mandava → corrigido, `create-payment`
     recalcula sempre a partir do banco.
   - CORS liberado (`*`) em todas as Edge Functions → allowlist via secret `ALLOWED_ORIGINS`.
   - CPF/telefone/e-mail em texto puro nos logs → mascarados.
   - Busca vulnerável a injeção de filtro do PostgREST → sanitizada.
   - 2FA (TOTP) opcional adicionado pra contas de admin.
5. **Roadmap de funcionalidades** (baseado num arquivo `Novas implementações.md` que o usuário
   trouxe, com 5 itens do lado cliente e 10 do lado admin). Decidido atacar o lado admin primeiro,
   um item por vez, com o Claude escolhendo a ordem quando pedido. Implementados nesta sessão:
   - Logs de Auditoria (ações + histórico de mudança de dados)
   - Dashboard analítico avançado (ticket médio, taxa de conversão, produtos estagnados, presets
     de período incluindo "Todo o período")
   - Cupons de desconto (CRUD admin + validação/aplicação segura no checkout)
6. **Correção de bugs** apontados pelo usuário após testar o painel:
   - Logo do admin linkava pra home pública (`/`) em vez de ficar em `/admin`
   - Botões de ação (publicar/despublicar, verificar pagamento, reenviar download) desabilitavam
     a linha errada da tabela (todas as linhas travavam, não só a que estava processando)
   - Contador final da importação em lote sempre errado (closure obsoleta)
   - **Achado durante a varredura, não reportado pelo usuário**: a FK de `sales.multitrack_id` tinha
     `ON DELETE CASCADE` — excluir uma música do catálogo apagava silenciosamente todo o histórico
     de vendas dela. Trocado pra `RESTRICT` (bloqueia a exclusão se já houver venda), com mensagem
     clara pedindo pra usar "Despublicar" em vez disso.

Todas as mudanças foram commitadas e enviadas pro GitHub (`github.com/uesleineri/music-vault-store`,
branch `main`) ao longo do caminho — o histórico de commits ali é o registro detalhado de cada passo.

## Estado atual da infraestrutura

| Peça | Onde | Status |
|---|---|---|
| Banco de dados / Auth / Edge Functions | Supabase, projeto `nhbuivrsbiivimeoyqqr` ("Gospel VS") | ✅ Ativo |
| Arquivos de multitrack | Google Drive pessoal (`uesleineri1@gmail.com`), pasta "Gospel VS - Multitracks" | ✅ Ativo, 5 músicas migradas |
| Capas/previews | Supabase Storage (buckets `covers`/`previews`, públicos) | ✅ Ativo |
| Pagamento | Asaas (PIX) | ⚠️ **Não configurado ainda** — falta `ASAAS_API_KEY` |
| Frontend em produção | Incerto — originalmente pensado pra Vercel, mas não confirmado onde está publicado hoje (possivelmente ainda só no Lovable) | ⚠️ A confirmar |
| Repositório | `github.com/uesleineri/music-vault-store`, branch `main` | ✅ Tudo commitado e enviado |

## Onde estão as credenciais

Não estão neste arquivo. Localização de cada uma:

- **`.env` local** (na raiz do projeto, já no `.gitignore`... **exceto que ele estava versionado
  no git desde a criação original pelo Lovable** — vale considerar remover do controle de versão em
  algum momento): `VITE_SUPABASE_URL`, `VITE_SUPABASE_PROJECT_ID`, `VITE_SUPABASE_PUBLISHABLE_KEY`
  (essa última é pública por natureza, feita pra ir no bundle do navegador).
- **Secrets das Edge Functions** (Supabase Dashboard → Project Settings → Edge Functions → Secrets,
  ou `npx supabase secrets list --project-ref nhbuivrsbiivimeoyqqr`): `GOOGLE_CLIENT_ID`,
  `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `ASAAS_WEBHOOK_TOKEN`, `ALLOWED_ORIGINS`, e (a
  configurar) `ASAAS_API_KEY`.
- **Senha do Postgres** do projeto novo: só o usuário sabe (definida na criação do projeto). Se
  perdida, resetar em Project Settings → Database → Reset database password.
- **Login do admin do painel** (`/admin/login`): e-mail `uesleineri1@gmail.com`, senha só o usuário
  sabe. 2FA está disponível mas desativado no momento (foi testado e desligado de propósito pra não
  trancar o usuário fora).
- **Token de acesso pessoal do Supabase CLI** (`sbp_...`, usado pra rodar `supabase functions
  deploy` / `db push` sem login interativo): gerado em supabase.com/dashboard/account/tokens. Não
  fica salvo em lugar nenhum do projeto — precisa gerar de novo quando for usar o CLI numa sessão
  nova (ou usar `supabase login` interativo, se disponível no ambiente).

## O que já foi implementado

Funcionalidades completas, testadas ao vivo no navegador, e publicadas:

**Loja pública**: catálogo com busca/paginação/ordenação, detalhes com preview de áudio, checkout
PIX com cupom de desconto, página de download por token, tema claro/escuro.

**Painel admin** (`/admin`): dashboard (receita, ticket médio, taxa de conversão, mais
vendidas/recentes/estagnados, uso do Google Drive), CRUD de multitracks (individual + importação em
lote), gestão de vendas (verificar pagamento na Asaas, reenviar download, exportar CSV, filtros de
período incluindo "todo o período"), cupons de desconto, administradores (convite/remoção + 2FA
própria), logs de auditoria (quem fez o quê, quando, o que mudou).

Consulte o [README.md](README.md) pra detalhes técnicos de cada um (schema, Edge Functions
envolvidas, etc.) — aqui é só o inventário.

## Segurança — o que foi corrigido

Ver seção "Linha do tempo" acima, item 4. Resumo do estado atual: preço sempre validado no
servidor, webhook autenticado, RLS completo em todas as tabelas (com `audit_logs`, `coupons` e
`admin_users` sem política de escrita pro cliente — só via Edge Function com `service_role` ou
trigger `SECURITY DEFINER`), CORS restrito por allowlist, PII mascarada em logs, 2FA disponível.

## Bugs corrigidos

Ver seção "Linha do tempo" acima, item 6, e o commit `d2ab06a` no histórico do git pra detalhes
técnicos de cada correção.

## Pendências reais (bloqueiam produção)

1. **`ASAAS_API_KEY` não configurada** — sem isso, o checkout gera erro `"ASAAS_API_KEY not
   configured"` ao tentar pagar. É a única coisa que impede vendas reais agora. Quando tiver a
   chave, configurar com:
   ```
   npx supabase secrets set ASAAS_API_KEY="..." --project-ref nhbuivrsbiivimeoyqqr
   ```
2. **`ASAAS_WEBHOOK_TOKEN`** já está configurado no Supabase, mas **precisa ser colado também no
   painel da Asaas** (Configurações → Integrações → Webhooks → campo de token de autenticação) — sem
   isso dos dois lados, o webhook real também vai ser rejeitado, não só os falsos.
3. **`ALLOWED_ORIGINS`** só tem `http://localhost:8080` hoje. Assim que houver um domínio de
   produção definido, atualizar:
   ```
   npx supabase secrets set ALLOWED_ORIGINS="http://localhost:8080,https://seudominio.com" --project-ref nhbuivrsbiivimeoyqqr
   ```
   Sem isso, o checkout para de funcionar em produção (CORS bloqueando).
4. **Onde o frontend está hospedado em produção não foi confirmado** nesta sessão — o usuário
   mencionou que talvez ainda esteja só no Lovable, não na Vercel como se pensava originalmente.
   Vale confirmar antes de anunciar a loja pro público, e então resolver o item 3 acima.

## Roadmap restante

Do arquivo original `Novas implementações.md` (o usuário pode ter esse arquivo salvo em
`C:\Users\Ueslei Neri\Documents\Novas implementações.md` fora do repo). Itens ainda não atacados:

**Lado admin:**
- Kits promocionais (bundles) — agrupar várias músicas em produto único com preço fixo
- Avaliações e prova social — notas/comentários de compradores, exibição pública
- Recuperação de checkout abandonado — e-mail automático pra PIX gerado e não pago após 2h
  (precisa de agendamento — Supabase Cron — e de um provedor de e-mail, já que hoje só existe
  entrega via compartilhamento nativo do Drive, não um serviço de e-mail transacional de verdade)
- Análise de funil de vendas — rastrear checkout iniciado → PIX gerado → PIX pago → download feito
  (precisa de uma tabela de eventos nova, hoje isso não é rastreado)
- Central de notificações internas — alertas em tempo real no painel (precisa de Supabase Realtime)
- Módulo financeiro — receita bruta, taxas da Asaas, lucro líquido (precisa investigar se a API da
  Asaas expõe taxas de forma utilizável)

**Lado cliente** (nenhum atacado ainda):
- Carrinho de compras (múltiplos itens, um PIX só)
- Sistema de contas de cliente (cadastro/login)
- Área "Minha Conta" (compras, downloads, licenças, reenvio de acesso)
- Motor de busca avançado (filtros por tom, BPM, estilo, idioma, etc. — hoje só existe artista/música)
- Recomendações ("Você também pode gostar")

## Como retomar o trabalho

```sh
# Rodar localmente
cd "C:\Users\Ueslei Neri\Documents\Music\music-vault-store"
npm install
npm run dev   # sobe em http://localhost:8080

# Aplicar uma migration nova no banco (precisa da senha do Postgres)
npx supabase db push --db-url "postgresql://postgres:SENHA_URL_ENCODED@db.nhbuivrsbiivimeoyqqr.supabase.co:5432/postgres" --include-all --yes

# Deploy de Edge Functions (precisa de um Personal Access Token, sbp_...)
export SUPABASE_ACCESS_TOKEN="sbp_..."
npx supabase functions deploy --project-ref nhbuivrsbiivimeoyqqr

# Commit e push
git add -A -- ':!.claude' ':!supabase/.temp'
git commit -m "..."
git push origin main
```

Se for continuar com uma IA assistente numa sessão nova: aponte pra este arquivo (`CONTEXT.md`) e
pro [README.md](README.md) logo no início — juntos eles cobrem tanto o "porquê"/histórico quanto o
"como" técnico, sem precisar re-explorar o projeto do zero.

## Lições aprendidas / pegadinhas do projeto

- **Chaves novas do Supabase (`sb_publishable_`/`sb_secret_`) não têm os grants automáticos** que
  as antigas (JWT `anon`/`service_role`) tinham. Toda tabela nova precisa checar se `anon`,
  `authenticated` e `service_role` têm `GRANT` — RLS sozinho não basta, é uma camada em cima do
  grant, não substitui ele.
- **Sessões de login podem invalidar** (`session_not_found`) depois de múltiplos logins/resets de
  senha feitos via API na mesma conta — se o app parecer "deslogado do nada" no navegador, tente
  relogar antes de assumir que é bug de código.
- **O ambiente de preview/browser às vezes mostra logs de erro em cache** de uma aba antiga mesmo
  depois do código corrigido — ao investigar um erro, prefira abrir uma aba nova pra confirmar se
  ele é real ou só resíduo.
- **Google Drive não expõe tamanho de pasta** na API — o "uso da pasta Gospel VS" no dashboard é
  calculado somando o tamanho de cada arquivo recursivamente (função `getAppFolderUsage`), não é
  nativo do Drive.
- **`request.headers` do PostgREST** é a forma de capturar IP/user-agent dentro de triggers SQL
  (`current_setting('request.headers', true)::json ->> 'x-forwarded-for'`) — usado nos triggers de
  auditoria.
