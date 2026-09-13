# Mendes Lanchonete — Cardápio Digital

Cardápio digital com Pix, painel administrativo e Kanban de pedidos pra
**Mendes Lanchonete** (Natal/RN).

Stack: **Next.js 16** (App Router) · **Supabase** (Postgres + Realtime +
Storage + Auth) · **Mercado Pago** (Pix) · **n8n + Evolution API**
(notificações WhatsApp).

---

## Funcionalidades

- **Cliente**
  - Cardápio mobile-first com categorias, fotos e descrição
  - Carrinho com adicionais/opções por item
  - Checkout com 3 modalidades: Pix (QR), dinheiro na entrega, cartão na entrega
  - Link de pedido público (`/pedido/[token]`) — sem precisar login
  - Tela de pagamento Pix com animação de check + redirect automático

- **Administrador**
  - Kanban de pedidos em tempo real (Supabase Realtime)
  - Status: `recebido → em_preparo → pronto → saiu_entrega → entregue`
  - Avanço de status com optimistic UI
  - Sincronização automática de `payment_status` via webhook MP
  - Notificações WhatsApp ao dono a cada pedido novo / Pix confirmado
  - Notificação WhatsApp ao cliente quando pedido sai pra entrega

---

## Como rodar localmente

```bash
npm install
cp .env.example .env.local       # preencha com suas chaves
npx supabase db push             # aplica migrations/ na ordem
npm run dev
```

Acesse:

- Loja: <http://localhost:3000>
- Admin: <http://localhost:3000/admin/pedidos> (definir `auth.users` admin)

---

## Estrutura

```
src/
  app/
    (loja)/                  # rotas públicas da loja
      pedido/[token]/        # página de pedido por link público
    admin/(painel)/pedidos/  # kanban admin
    api/
      pagamentos/pix/        # gera cobrança Pix
      webhooks/mercadopago/  # webhook MP → atualiza payment_status
  components/
    admin/                   # kanban-board, kanban-card
    site/                    # carrinho-bar, pix-payment, etc
  lib/
    n8n.ts                   # helpers de webhook (fire-and-forget)
    mercadopago.ts           # SDK MP + tipos Pix
    actions/                 # server actions (checkout, admin orders)
supabase/
  migrations/                # SQL versionado
infra/
  n8n/
    mendes-pedido-novo-whatsapp-dono.json    # workflow "novo pedido → dono"
    mendes-pedido-rota-cliente.json          # workflow "saiu_entrega → cliente"
docs/
  setup.md                                # setup detalhado
```

---

## Webhooks n8n

Dois workflows expõem webhooks públicos que o backend chama:

1. **`Mendes - Notificar WhatsApp Dono`** — recebe payload completo do
   pedido (gerado em `src/lib/n8n.ts > buildOrderPayload`) e formata
   comanda pra o dono. Dispara no checkout (cash/card) e no webhook MP
   (Pix confirmado).

2. **`Mendes - Pedido em Rota`** — recebe payload enxuto
   `{order_id, customer_name, customer_phone, delivery_address}` e
   notifica o cliente. Dispara quando o admin move o card pra
   `saiu_entrega` no Kanban.

Os JSONs versionados em `infra/n8n/` podem ser importados direto na UI
do n8n (Workflows → Import from File). Os tokens `apikey` da
**Evolution API** ficam salvos como **Credentials** no n8n — JSON
exportado vem com `REDACTED_USE_N8N_CREDENTIALS` pra você criar a sua.

---

## Documentação

- [docs/setup.md](docs/setup.md) — setup detalhado do zero
- [PLANO.md](PLANO.md) — roadmap completo do projeto

---

## License

MIT
