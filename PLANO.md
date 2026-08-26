# Mendes Lanchonete e Padaria — Plano de Implementação

Documento de referência para execução. Contém as decisões de arquitetura já
tomadas e o modelo de dados completo. Quem implementar deve seguir isto sem
re-decidir.

## Stack

- Next.js 16.2 (App Router) + React 19.2 + TypeScript
- Tailwind CSS v4 (via `@tailwindcss/postcss`, sem `tailwind.config`)
- Supabase (Postgres + Auth + Storage)
- Zod v4 para validação, lucide-react para ícones, `qrcode` para QR
- Deploy: Vercel

### Atenção — Next.js 16 tem breaking changes

- `middleware.ts` **não existe mais** → arquivo é `src/proxy.ts`, função exportada
  chamada `proxy`. Runtime é sempre `nodejs`.
- `params` e `searchParams` em `page.tsx`/`layout.tsx`/`route.ts` são **Promises**.
  Sempre `const { id } = await params`.
- `cookies()` e `headers()` são **async**.
- `revalidateTag(tag)` agora exige 2º argumento (`revalidateTag(tag, 'max')`).
  Preferir `revalidatePath(path)`, que não mudou.
- Turbopack é o default. `next lint` foi removido — usar `eslint` direto.
- `images.domains` está deprecado → usar `images.remotePatterns`.

## Princípios de arquitetura

1. **Preços nunca vêm do cliente.** O checkout envia apenas
   `{ productId, quantity, optionIds[], notes }`. O servidor rebusca preços no
   banco, recalcula tudo e grava. Isso impede manipulação de valores.
2. **Escritas públicas não passam por RLS anon.** Pedidos são criados por uma
   Server Action que usa `service_role`. O anon key só tem `SELECT` no catálogo.
3. **Multiempresa preparada, não ativada.** Toda tabela de negócio tem
   `tenant_id`. Hoje existe um único tenant, resolvido por
   `NEXT_PUBLIC_TENANT_SLUG`. No futuro, resolver por domínio no `proxy.ts`
   sem alterar schema.
4. **Mobile-first.** Layout desenhado para 360–430px de largura; desktop é
   progressive enhancement. Barra de carrinho fixa no rodapé.
5. **Server Components por padrão.** `"use client"` só onde há estado/interação
   (carrinho, formulários, filtros).

## Estrutura de pastas

```
src/
  app/
    layout.tsx                    raiz + metadata + fontes
    globals.css                   tokens Tailwind v4 (@theme)
    page.tsx                      Home
    cardapio/page.tsx             Cardápio completo (categorias + busca)
    produto/[slug]/page.tsx       Detalhe + personalização
    carrinho/page.tsx             Carrinho
    checkout/page.tsx             Checkout
    pedido/[token]/page.tsx       Confirmação (token público, não sequencial)
    admin/
      login/page.tsx
      (painel)/layout.tsx         guard de sessão + sidebar
      (painel)/page.tsx           Dashboard
      (painel)/pedidos/…
      (painel)/produtos/…
      (painel)/categorias/…
      (painel)/adicionais/…
      (painel)/bairros/…
      (painel)/promocoes/…
      (painel)/clientes/…
      (painel)/horarios/…
      (painel)/configuracoes/…
      (painel)/qrcode/page.tsx
  components/
    ui/          primitivos acessíveis (Button, Input, Select, Sheet, …)
    site/        Header, Footer, StatusLoja, ProdutoCard, CarrinhoBar, …
    admin/       Sidebar, DataTable, StatusPedidoSelect, ImageUpload, …
  lib/
    env.ts               ✅ feito
    utils.ts             ✅ feito (cn, formatCurrency, formatPhone, slugify…)
    errors.ts            ✅ feito (AppError, ActionResult, toUserMessage)
    supabase/
      client.ts          ✅ feito (browser)
      server.ts          ✅ feito (SSR, cookies)
      admin.ts           ✅ feito (service_role)
    tenant.ts            resolve tenant atual (hoje: por slug)
    horario.ts           lojaEstaAberta(), proximaAbertura()
    precos.ts            cálculo de item, subtotal, frete, desconto, total
    whatsapp.ts          montagem da mensagem + link wa.me
    validation/          schemas Zod por domínio
    carrinho/
      contexto.tsx       CarrinhoProvider (localStorage)
      tipos.ts
    queries/             leituras tipadas (catálogo, config, pedidos)
    actions/             Server Actions (admin CRUD, checkout)
  types/database.ts      tipos do schema Supabase
  proxy.ts               refresh de sessão + proteção de /admin
supabase/
  migrations/
    0001_schema.sql      enums, tabelas, índices, triggers
    0002_rls.sql         políticas
    0003_functions.sql   número do pedido, métricas do dashboard
    0004_storage.sql     buckets
  seed.sql               tenant Mendes + categorias + produtos exemplo
```

## Modelo de dados

Todas as tabelas usam `id uuid primary key default gen_random_uuid()`,
`created_at timestamptz default now()` e, onde houver edição, `updated_at`
mantido por trigger.

### Enums

```
fulfillment_type : delivery | pickup
payment_method   : pix | cash | card
order_status     : novo | confirmado | em_preparo | pronto | saiu_entrega | entregue | cancelado
selection_type   : single | multiple
promotion_type   : percent | fixed | free_delivery | banner
admin_role       : owner | manager | staff
```

### tenants
`name`, `slug` (unique), `is_active`.
Uma linha hoje: slug `mendes`.

### settings (1 linha por tenant)
Identidade: `business_name`, `logo_url`, `banner_url`, `primary_color`,
`accent_color`.
Contato: `whatsapp_number` (só dígitos, com DDI), `phone`, `instagram_url`,
`facebook_url`, `maps_url`.
Endereço: `address_street`, `address_number`, `address_complement`,
`address_district`, `address_city`, `address_state`, `address_zip`.
Operação: `avg_delivery_minutes`, `avg_pickup_minutes`, `min_order_value`,
`free_delivery_threshold` (nullable), `accepts_delivery`, `accepts_pickup`,
`manual_closed` (fecha a loja na hora), `closed_message`.
Pagamento: `payment_pix`, `payment_cash`, `payment_card`, `pix_key`,
`pix_key_type`.
Pedido: `order_prefix`.

### business_hours
`tenant_id`, `weekday` (0=domingo … 6=sábado), `opens_at time`, `closes_at time`,
`is_closed bool`. Permite múltiplas linhas por dia (ex.: almoço e jantar).
Se `closes_at < opens_at`, o intervalo cruza a meia-noite — `lib/horario.ts`
precisa tratar isso.

### admins
`id uuid` referenciando `auth.users(id)` (PK), `tenant_id`, `name`, `email`,
`role admin_role`, `is_active`.
O login usa Supabase Auth; a autorização é a existência de linha ativa aqui.

### categories
`tenant_id`, `name`, `slug`, `description`, `image_url`, `sort_order int`,
`is_active bool`. Unique `(tenant_id, slug)`.
Seed: Lanches, Pastéis, Porções, Bebidas, Combos, Padaria.
"Promoções" **não** é categoria — é uma seção virtual que agrupa produtos com
`promo_price` preenchido.

### products
`tenant_id`, `category_id`, `name`, `slug`, `description`,
`price numeric(10,2)`, `promo_price numeric(10,2) null`, `image_url`,
`is_featured bool`, `is_available bool` (esgotado), `prep_minutes int`,
`sort_order int`, `is_active bool` (oculto do cardápio), `sold_count int`.
Unique `(tenant_id, slug)`. Índices em `category_id`, `is_featured`.
Check: `promo_price is null or promo_price < price`.

**Preço efetivo** = `coalesce(promo_price, price)`. Regra única, usada no
cardápio e no recálculo do checkout.

### option_groups + options + product_option_groups
Modelo genérico que resolve tamanhos **e** adicionais com a mesma estrutura.

`option_groups`: `tenant_id`, `name` ("Tamanho", "Adicionais"), `description`,
`selection_type`, `min_select int`, `max_select int null`, `is_required bool`,
`sort_order`, `is_active`.

`options`: `group_id`, `name` ("Bacon extra", "Ovo", "Cheddar", "Hambúrguer
extra"), `price_delta numeric(10,2) default 0` (pode ser negativo),
`is_available`, `sort_order`.

`product_option_groups`: PK `(product_id, group_id)` + `sort_order`.
Permite reaproveitar "Adicionais" em vários lanches.

Validação no servidor: para cada grupo obrigatório, a quantidade de opções
escolhidas deve respeitar `min_select`/`max_select`; grupo `single` aceita
exatamente 1.

### neighborhoods (bairros)
`tenant_id`, `name`, `city`, `delivery_fee numeric(10,2)`,
`min_order_value numeric(10,2) default 0`,
`free_delivery_threshold numeric null` (sobrepõe o global),
`estimated_minutes int`, `is_active`.

### customers
`tenant_id`, `name`, `phone`, `email null`, `notes`, `orders_count int`,
`total_spent numeric`, `last_order_at`. Unique `(tenant_id, phone)`.
Upsert por telefone no checkout.

### addresses
`customer_id`, `neighborhood_id null`, `zip`, `street`, `number`,
`complement`, `district`, `reference`, `city`, `state`, `is_default`.

### promotions
`tenant_id`, `title`, `description`, `image_url`, `type promotion_type`,
`value numeric`, `coupon_code text null`, `min_order_value`, `starts_at`,
`ends_at`, `is_active`, `sort_order`.
`type=banner` só aparece na home; os outros aplicam desconto via cupom.

### orders
`tenant_id`, `order_number text` (unique por tenant, ex. `#0042`),
`public_token text` unique (usado na URL de confirmação — não sequencial),
`customer_id null`, `customer_name`, `customer_phone`,
`fulfillment fulfillment_type`,
snapshot do endereço (`address_zip`, `address_street`, `address_number`,
`address_complement`, `address_district`, `address_reference`,
`neighborhood_id null`, `neighborhood_name`),
`payment_method`, `change_for numeric null` (troco para),
`items_total`, `delivery_fee`, `discount`, `total`,
`coupon_code null`, `notes`, `status order_status default 'novo'`,
`status_updated_at`, `whatsapp_sent bool`.
Snapshot do endereço é intencional: se o bairro mudar de taxa depois, o
pedido histórico não muda.

### order_items
`order_id`, `product_id null` (`on delete set null`), `product_name`,
`unit_price` (preço efetivo no momento), `quantity`,
`options jsonb` (`[{ groupName, optionName, priceDelta }]`),
`options_total`, `notes`, `line_total`.
Nome e preço são copiados para o pedido não se alterar quando o produto mudar.

### order_status_history
`order_id`, `status`, `changed_by uuid null`, `changed_at`.
Alimentada por trigger em `orders` quando `status` muda.

## RLS

- `anon`: `SELECT` em `settings`, `business_hours`, `categories`, `products`,
  `option_groups`, `options`, `product_option_groups`, `neighborhoods`,
  `promotions` — apenas registros com `is_active = true`. Nada mais.
- `anon`: **nenhum** `INSERT`/`UPDATE`. Pedidos entram via `service_role`.
- `authenticated`: acesso total às tabelas do tenant, condicionado a
  `is_admin()` — função `security definer` que verifica linha ativa em `admins`.
- `orders` / `order_items` / `customers` / `addresses`: sem política para
  `anon`. Leitura da confirmação é server-side por `public_token`.

## Funções SQL

- `is_admin()` → boolean, `security definer`, checa `admins` pelo `auth.uid()`.
- `next_order_number(p_tenant uuid)` → text. Usa tabela `order_counters`
  (`tenant_id`, `current int`) com `update … returning` para ser atômica.
  Formata como `order_prefix || lpad(current::text, 4, '0')`.
- `dashboard_metrics(p_tenant uuid, p_from timestamptz, p_to timestamptz)`
  → json com `orders_count`, `revenue`, `avg_ticket`, `by_status`,
  `top_products`. Cancelados fora do faturamento.
- Trigger `set_updated_at()` genérico.
- Trigger `log_order_status()` para `order_status_history`.

## Storage

Bucket `midia`, público para leitura. Escrita só para `is_admin()`.
Pastas: `produtos/`, `categorias/`, `promocoes/`, `marca/`.
Registrar o hostname do Supabase em `images.remotePatterns`.

## Fluxo do checkout (crítico)

1. Cliente monta carrinho no `localStorage` (`mendes:carrinho:v1`).
2. `POST` via Server Action com `{ itens: [{productId, quantity, optionIds, notes}], fulfillment, cliente, endereco, pagamento, changeFor, coupon }`.
3. Servidor: valida Zod → checa loja aberta → rebusca produtos e opções →
   valida grupos obrigatórios → calcula `items_total` → resolve frete pelo
   bairro (grátis se atingir threshold) → aplica cupom → valida pedido mínimo →
   gera `order_number` e `public_token` → upsert `customers` → insere `orders`
   e `order_items` → retorna `{ orderNumber, publicToken, whatsappUrl }`.
4. Cliente limpa o carrinho, abre `whatsappUrl` (`window.open`) e navega para
   `/pedido/[token]`.

Abrir o WhatsApp no cliente, nunca por redirect do servidor — precisa ser
resultado de gesto do usuário para não ser bloqueado como popup.

### Mensagem do WhatsApp

```
*PEDIDO #0042* — Mendes Lanchonete

*Cliente*
Nome — Telefone

*Entrega*  (ou *Retirada no local*)
Rua, Nº — Complemento
Bairro
Ref: ponto de referência

*Itens*
1x X-Bacon .............. R$ 22,00
   + Bacon extra (R$ 4,00)
   + Ovo (R$ 2,00)
   Obs: sem cebola

*Pagamento*
Dinheiro — troco para R$ 50,00

Subtotal  R$ 28,00
Entrega   R$ 5,00
Desconto -R$ 3,00
*Total    R$ 30,00*
```

Montar com `encodeURIComponent` e `\n` reais; link
`https://wa.me/<numero>?text=<msg>`.

## Fases

1. ✅ Arquitetura e fundação
2. Banco de dados e migrations
3. Painel administrativo
4. Home e cardápio
5. Carrinho e checkout
6. Pedidos e WhatsApp
7. Dashboard, relatórios e QR Code
8. Testes, build e otimização

## Expansão futura (não implementar)

Multiempresa e multiunidade (`tenant_id` já existe), entregadores, pagamento
online, impressora térmica, painel de cozinha, fidelidade, API oficial do
WhatsApp. Nenhuma dessas exige alterar as tabelas atuais — apenas adicionar.
