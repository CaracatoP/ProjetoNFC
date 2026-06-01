# Mercado Pago Checkout Pro Design

## Goal

Integrar Mercado Pago ao checkout publico do TapLink usando Checkout Pro, webhooks e credenciais por tenant, sem coletar dados sensiveis de cartao no TapLink e sem quebrar o fluxo atual de pedidos manuais.

## Scope

### MVP

- Checkout Pro Mercado Pago
- Webhook para confirmacao automatica de pagamento
- Configuracao manual de credenciais Mercado Pago por tenant
- Pix, cartao de credito e cartao de debito dentro do ambiente seguro do Mercado Pago
- Manter `cash_on_pickup` e `cash_on_delivery`
- Manter `pix` manual como opcional, se o tenant quiser usar junto
- Atualizacao de status de pagamento no admin e no painel cliente

### Out of Scope

- Checkout Transparente
- Formulario proprio de cartao
- Armazenamento de numero de cartao, CVV ou outros dados sensiveis
- OAuth Mercado Pago
- Split payment
- Reembolso automatico
- Assinatura recorrente

## Official References

- Checkout Pro overview: <https://www.mercadopago.com.br/developers/en/docs/checkout-pro/overview>
- Create payment preference: <https://www.mercadopago.com.br/developers/en/docs/checkout-pro/create-payment-preference>
- Webhooks / payment notifications: <https://www.mercadopago.com.br/developers/en/docs/checkout-pro/payment-notifications>
- Webhook signature validation: <https://www.mercadopago.com.br/developers/es/docs/checkout-pro/additional-content/notifications/webhooks>
- Payment methods in preference: <https://www.mercadopago.com.br/developers/en/docs/checkout-pro/additional-settings/payment-methods>
- Get payment by ID: <https://www.mercadopago.com.br/developers/en/reference/payments/_payments_id/get>

## Current Project Fit

- O backend ja cria pedidos publicos e recalcula o total no servidor.
- `Business.paymentSettings` ja existe para pagamentos manuais.
- `Order.payment` ja existe e sera expandido.
- O carrinho publico ja seleciona forma de pagamento e envia pedido.
- Ainda nao existe helper de criptografia para credenciais de seller por tenant.

## Data Model

### Business.paymentSettings

Expandir `paymentSettings` para suportar Mercado Pago:

```js
{
  enabled: boolean,
  provider: "manual" | "mercado_pago",
  methods: {
    pix: boolean,
    creditCard: boolean,
    debitCard: boolean,
    cashOnPickup: boolean,
    cashOnDelivery: boolean
  },
  pix: {
    key: string,
    merchantName: string,
    merchantCity: string
  },
  mercadoPago: {
    enabled: boolean,
    publicKey: string,
    accessTokenEncrypted: string,
    webhookSecretEncrypted: string,
    accountEmail: string,
    connectedAt: Date
  }
}
```

`contact.pix` continua como fallback para o Pix manual. `paymentSettings.pix` continua sendo a fonte canonica do checkout.

### Order.payment

Expandir `Order.payment` para suportar Checkout Pro:

```js
{
  method: "pix" | "credit_card" | "debit_card" | "cash_on_pickup" | "cash_on_delivery",
  provider: "manual" | "mercado_pago",
  status: "pending" | "paid" | "failed" | "cancelled" | "manual",
  amount: number,
  providerPaymentId: string,
  providerPreferenceId: string,
  checkoutUrl: string,
  pixCopyPaste: string,
  pixQrCodeUrl: string,
  paidAt: Date,
  updatedAt: Date
}
```

Campos novos devem ser opcionais para manter compatibilidade com pedidos antigos.

## Security Rules

### Secret Storage

- `accessToken` e `webhookSecret` do Mercado Pago serao armazenados apenas no backend.
- Persistencia usando criptografia simetrica com `AES-256-GCM`.
- Chave de criptografia vinda de `PAYMENT_CREDENTIALS_ENCRYPTION_KEY`.
- Frontend nunca recebe secrets, nem texto puro, nem mascarado.

### Safe DTO

O DTO devolvido ao frontend para configuracao Mercado Pago deve conter apenas:

```js
{
  enabled: boolean,
  connected: boolean,
  accountEmail: string,
  hasAccessToken: boolean,
  hasWebhookSecret: boolean,
  publicKey: string
}
```

Nao retornar:

- `accessTokenEncrypted`
- `webhookSecretEncrypted`
- token mascarado
- secret mascarado

### Tenant Isolation

- Toda operacao de configuracao, checkout e webhook deve validar `businessId`.
- Nao confiar no frontend para definir provider, total ou tenant.
- Endpoints de painel/admin continuam bloqueando cross-tenant.

## Checkout Pro Flow

1. Cliente escolhe `pix`, `credit_card` ou `debit_card` no carrinho.
2. `POST /api/public/site/:slug/orders` cria pedido com `payment.status = pending`.
3. Backend valida que o metodo esta ativo para o tenant e recalcula total.
4. Backend descriptografa o token do tenant e cria uma `preference` Mercado Pago.
5. Backend salva `providerPreferenceId` e `checkoutUrl` no pedido.
6. Frontend redireciona o cliente para `checkoutUrl`.
7. Cliente paga no ambiente seguro do Mercado Pago.
8. Webhook recebe notificacao do pagamento.
9. Backend valida assinatura e consulta o pagamento no Mercado Pago.
10. Backend atualiza `Order.payment.status`.
11. Painel admin/cliente reflete o novo status.

## external_reference

Nao usar apenas `orderId`.

Formato aprovado:

```txt
tenant:<businessId>:order:<orderId>
```

Esse valor deve ser enviado no `external_reference` da `preference` e tambem usado como contexto defensivo para localizar tenant + pedido antes de descriptografar credenciais e consultar o pagamento.

## Payment Method Mapping

### Mercado Pago online

- `pix`
- `credit_card`
- `debit_card`

Esses metodos so aparecem no checkout se:

- `paymentSettings.enabled === true`
- `paymentSettings.provider === "mercado_pago"`
- `paymentSettings.mercadoPago.enabled === true`
- o metodo especifico estiver ativo
- o tenant tiver credenciais minimas validas

### Manual methods

- `cash_on_pickup`
- `cash_on_delivery`
- `pix` manual opcional

Continuam funcionando sem Checkout Pro.

## Webhook Design

Endpoint:

```txt
POST /api/webhooks/mercado-pago
```

Regras:

- endpoint publico, mas com validacao de assinatura conforme documentacao oficial
- nao confiar no payload bruto
- consultar `GET /v1/payments/{id}` no Mercado Pago antes de atualizar o pedido
- fluxo idempotente
- localizar pedido por `providerPaymentId`, `providerPreferenceId` e `external_reference`
- publicar evento realtime do tenant depois da atualizacao
- responder rapido apos validacao/processamento

Mapeamento inicial de status:

- `approved` -> `paid`
- `pending` / `in_process` -> `pending`
- `rejected` -> `failed`
- `cancelled` -> `cancelled`

## Back URLs

Cada `preference` deve configurar retorno para o tenant:

- success: `/site/:slug/catalog/payment/success`
- failure: `/site/:slug/catalog/payment/failure`
- pending: `/site/:slug/catalog/payment/pending`

Pode ser implementado com paginas simples ou estado controlado na rota do catalogo, desde que o retorno seja claro para o usuario.

## Permissions

- Nivel 0: configura tudo
- Nivel 1: so se a permissao interna atual permitir editar configuracoes do tenant; nunca recebe secrets de volta
- Nivel 2: pode configurar pagamento basico do proprio tenant se a capability/plano permitir
- Niveis 3 e 4: podem no maximo operar pedidos conforme capability existente; nao configuram credenciais
- Nivel 5: leitura apenas

Marcacao manual como pago continua disponivel apenas quando fizer sentido para `provider = "manual"` ou para operacao administrativa explicitamente permitida.

## Required Environment Variables

- `PAYMENT_CREDENTIALS_ENCRYPTION_KEY`
- `PUBLIC_SITE_BASE_URL`
- `API_PUBLIC_BASE_URL`

Futuro, para OAuth:

- `MERCADO_PAGO_CLIENT_ID`
- `MERCADO_PAGO_CLIENT_SECRET`
- `MERCADO_PAGO_REDIRECT_URI`

## Incremental Implementation Phases

1. Modelos, normalizacao e criptografia de credenciais
2. Servico `mercadoPagoService` e criacao de `preference`
3. Extensao de `POST /api/public/site/:slug/orders` para Checkout Pro
4. Endpoint e processamento de webhook
5. Configuracao Mercado Pago no admin e painel cliente com DTO seguro
6. Redirecionamento do checkout e estados de retorno no catalogo
7. Status de pagamento e atualizacao visual nos paineis
8. Testes e build

## Acceptance Criteria

- Tenant com Mercado Pago ativo consegue iniciar Checkout Pro e redirecionar para `init_point`
- Tenant sem configuracao valida nao ve nem usa metodos online
- `accessToken` e `webhookSecret` nunca aparecem no frontend
- Webhook aprovado marca pedido como pago
- Webhook duplicado nao duplica atualizacao
- Pedido manual continua funcionando
- Cross-tenant continua bloqueado
- Estrutura fica pronta para OAuth no futuro sem reescrever `Order.payment`
