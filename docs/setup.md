# Setup completo — Mendes Lanchonete

Guia do zero pra subir o cardápio + admin + Kanban + WhatsApp.

---

## 1. Pré-requisitos

- Node 20+ e npm
- Conta no [Supabase](https://supabase.com) (free tier serve)
- Conta no [Mercado Pago Developers](https://www.mercadopago.com.br/developers/panel/credentials) (pra Pix)
- n8n rodando (cloud ou self-hosted) com credencial Evolution API configurada
- Cloudflare Tunnel ou domínio próprio apontando pro servidor (recomendado pra webhook MP)

---

## 2. Clonar e instalar

```bash
git clone https://github.com/Jisaiaslima35/mendes-lanchonete.git
cd mendes-lanchonete
npm install
cp .env.example .env.local
```

---

## 3. Configurar Supabase

1. Crie um projeto em <https://supabase.com/dashboard>
2. Em **Project Settings → API**, copie:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` (secret) → `SUPABASE_SERVICE_ROLE_KEY`
3. Em **Project Settings → Database**, copie a **Connection string** (modo "Direct connection") → `DATABASE_URL`

Em seguida aplique as migrations:

```bash
# local: usando psql direto
psql "$DATABASE_URL" -f supabase/migrations/2026-09-12_orders_customer_email.sql
psql "$DATABASE_URL" -f supabase/migrations/2026-09-12_orders_payment.sql
psql "$DATABASE_URL" -f supabase/migrations/2026-09-12_orders_pix_and_payment_status.sql
psql "$DATABASE_URL" -f supabase/migrations/2026-09-12_orders_trigger_after.sql

# ou via Supabase CLI (recomendado em time)
supabase link --project-ref SEU_REF
supabase db push
```

---

## 4. Configurar Mercado Pago (Pix)

1. Crie uma aplicação em <https://www.mercadopago.com.br/developers/panel/applications>
2. Copie as credenciais de **produção** (não as de teste):
   - `Access Token` → `MERCADOPAGO_ACCESS_TOKEN`
   - `Public Key` → `NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY`
3. Cadastre o webhook em **Webhooks → Notificações IPN/Webhook**:
   - URL: `https://SEU_DOMINIO/api/webhooks/mercadopago`
   - Eventos: `payment` (e `merchant_order` se quiser)

Cole em `.env.local`:
```
MP_NOTIFICATION_URL=https://SEU_DOMINIO/api/webhooks/mercadopago
```

> **Importante**: pra Pix em produção o MP exige nome/email/CPF do pagador.
> O backend usa `MP_DEFAULT_PAYER_EMAIL` e `MP_DEFAULT_PAYER_CPF` como
> fallback se o cliente não preencher.

---

## 5. Configurar n8n + Evolution API

### 5.1. Evolution API

Já precisa estar rodando e com uma instância conectada ao WhatsApp do dono.
URL típica: `https://evo.automacaojs.us`. Crie a credencial no n8n em
**Credentials → Evolution API → Header Auth** com a apikey da instância.

### 5.2. Workflows

Importe os 2 JSONs em `infra/n8n/`:

1. **Mendes - Notificar WhatsApp Dono** — recebe payload do pedido novo,
   formata a comanda e manda no WhatsApp do dono.
2. **Mendes - Pedido em Rota** — recebe `{order_id, customer_name, customer_phone, delivery_address}`,
   formata mensagem e manda pro cliente quando o pedido sai pra entrega.

Em cada workflow:
1. **Abra o node HTTP Request** ("Enviar WhatsApp" / "Enviar WhatsApp Cliente")
2. Selecione a credencial Evolution API que você acabou de criar
3. Remova o header `apikey` hardcoded (a credencial injeta automático)

Após ativar, copie a **Production URL** do webhook (ex.:
`https://n8n.automacaojs.us/webhook/mendes-order-XXXXX`) e cole em
`.env.local`:
```
N8N_ORDER_WEBHOOK_URL=https://n8n.automacaojs.us/webhook/mendes-order-XXXXX
N8N_DISPATCH_WEBHOOK_URL=https://n8n.automacaojs.us/webhook/mendes-dispatch-XXXXX
```

---

## 6. Rodar

```bash
npm run dev
```

Acesse:
- **Loja**: <http://localhost:3000>
- **Admin (Kanban)**: <http://localhost:3000/admin/pedidos>

> Em produção (systemd), suba com `next start -p 3000` atrás de um
> reverse proxy (Caddy / nginx / Cloudflare Tunnel). O `systemd unit`
> recomendado é:
> ```ini
> [Service]
> WorkingDirectory=/opt/mendes-lanchonete
> EnvironmentFile=/opt/mendes-lanchonete/.env.local
> ExecStart=/usr/bin/node node_modules/next/dist/bin/next start -p 3000
> Restart=always
> ```

---

## 7. Testar fluxo completo

1. Abra a loja, adicione um lanche, vá pro checkout, escolha Pix
2. Verifique que apareceu o QR — escaneie com o app do banco
3. Confirme o Kanban: o card deve aparecer em `recebido` (sem Realtime demora ~1s)
4. Avance pra `em_preparo` → `pronto` → `saiu_entrega`
5. Verifique que o cliente recebeu a mensagem "🛵💨 Seu pedido #XXX saiu pra entrega"
6. Verifique que o dono recebeu **2 mensagens**: a do pedido novo (Pix confirmado)
   e nenhuma na transição de status (somente no checkout / pagamento)

---

## Problemas comuns

### Webhook do MP não chega

- Teste em produção com `curl` na URL do webhook — tem que responder 200
- Verifique se o Cloudflare Tunnel / proxy está deixando passar POST sem body
- Olhe os logs do Next.js: `journalctl -u mendes-teste -n 200`

### Kanban não atualiza em tempo real

- Confirme que a tabela `orders` tem `REPLICA IDENTITY FULL`:
  ```sql
  ALTER TABLE orders REPLICA IDENTITY FULL;
  ```
- E que ela está no `supabase_realtime` publication:
  ```sql
  ALTER PUBLICATION supabase_realtime ADD TABLE orders;
  ```

### `##0013` (dois `#`)

Cosmético: o `order_number` já vem com `#` do banco, então concatenamos outro.
Remova o `#` no template string em `src/lib/actions/admin-orders.ts`
(`const orderLabel = \`#${data.order_number}\`` → `const orderLabel = data.order_number`).

