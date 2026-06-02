# Asaas Subcontas, Split e Checkout Hospedado

## Contexto

O TapLink hoje ja possui:

- checkout publico em `/site/:slug/catalog`
- pedido publico criado no backend
- recalculo de total do pedido no servidor
- `paymentSettings` por tenant
- `Order.payment` como base para status e auditoria operacional
- provider manual como fallback

O objetivo desta entrega e substituir a trilha de gateway online por uma integracao com Asaas baseada em:

- subconta por tenant
- split automatico
- conta raiz TapLink recebendo percentual
- webhook para sincronizacao
- checkout hospedado/fluxo seguro do Asaas

## Objetivo

Implementar pagamentos via Asaas no TapLink com arquitetura multi-tenant segura, mantendo o provider `manual` como fallback operacional e permitindo que a plataforma receba uma porcentagem automatica dos pagamentos dos tenants.

## Fontes oficiais e decisao documentada

### Split com subconta emitindo a cobranca

Decisao validada com documentacao oficial do Asaas:

- a cobranca deve ser criada **na conta que fez a venda**, ou seja, na subconta do tenant
- o `split` deve listar apenas as carteiras que receberao parte do valor
- o saldo remanescente fica automaticamente com a conta emissora da cobranca
- nao se deve enviar a propria `walletId` da conta emissora no array de split

Isso encaixa exatamente no caso TapLink:

- a subconta do tenant emite a cobranca
- a `walletId` da conta raiz TapLink entra no `split`
- o tenant recebe o restante automaticamente

Payload oficial base para cobranca com split:

```json
{
  "customer": "cus_xxx",
  "billingType": "PIX",
  "value": 100.0,
  "dueDate": "2026-06-02",
  "externalReference": "tenant:<businessId>:order:<orderId>",
  "split": [
    {
      "walletId": "<platformWalletId>",
      "percentualValue": 5.0
    }
  ]
}
```

Referencias:

- Criacao de subcontas: `POST /v3/accounts`, retorno com `apiKey` e `walletId`, sendo a chave retornada uma unica vez.
- Split em cobrancas avulsas: `split[]` com `walletId`, `fixedValue` ou `percentualValue`.
- Visao geral do split: a cobranca deve ser criada na conta do vendedor e o restante fica com a conta emissora.
- Webhooks: autenticacao por `authToken` enviado no header `asaas-access-token`.

## Escopo do MVP

### Inclui

1. Configuracao Asaas da plataforma no admin nivel 0
2. Configuracao financeira por tenant
3. Criacao de subconta Asaas via API com fallback manual
4. Armazenamento seguro de credenciais da subconta
5. Criacao de cobranca Asaas no checkout publico
6. Split percentual da plataforma
7. Webhook Asaas idempotente
8. UX melhorada de formas de pagamento no carrinho
9. Historico de eventos financeiros (`paymentEvents`)
10. Preparacao de estrutura para analytics financeiros futuros

### Nao inclui

- Checkout transparente
- formulario proprio de cartao
- captura de numero de cartao, CVV ou dados sensiveis
- split multi-recebedor complexo no MVP
- reembolso automatico
- assinatura recorrente
- dashboard financeiro avancado nesta fase

## Arquitetura

### Conta raiz Asaas

A conta raiz pertence ao TapLink e sera usada para:

- criar subcontas
- armazenar `platformWalletId`
- definir taxa percentual global
- receber a comissao no split
- criar webhooks/configuracoes de suporte quando aplicavel

### Subconta Asaas por tenant

Cada tenant tera uma subconta Asaas dedicada.

O tenant pode ser conectado de duas formas:

1. `API first`
   - o admin nivel 0 cria a subconta via API da conta raiz
   - o retorno da criacao entrega `apiKey` e `walletId`
   - a `apiKey` e criptografada imediatamente

2. `Fallback manual`
   - o admin nivel 0 conecta manualmente uma subconta existente
   - informa `apiKey` da subconta e `walletId`
   - o sistema salva de forma segura e marca o tenant como conectado

### Provider de pagamento

O provider default continua `manual`.

Regras:

- `manual` permanece como fallback seguro
- se Asaas falhar, o tenant continua vendendo por:
  - `cash_on_pickup`
  - `cash_on_delivery`
  - `pix` manual, se configurado
- metodos online so aparecem quando:
  - o provider do tenant for `asaas`
  - a subconta estiver conectada
  - o metodo estiver ativo

## Modelagem

### Business.paymentSettings

```json
{
  "provider": "manual | asaas",
  "enabled": true,
  "methods": {
    "pix": true,
    "creditCard": true,
    "debitCard": true,
    "cashOnPickup": true,
    "cashOnDelivery": true
  },
  "pix": {
    "key": "",
    "merchantName": "",
    "merchantCity": ""
  },
  "asaas": {
    "enabled": false,
    "subaccountId": "",
    "walletId": "",
    "apiKeyEncrypted": "",
    "accountEmail": "",
    "accountName": "",
    "status": "not_connected | pending | active | disabled",
    "connectedAt": null,
    "webhookAuthTokenEncrypted": ""
  },
  "split": {
    "enabled": false,
    "platformFeePercent": 5,
    "platformWalletId": "",
    "mode": "percentage",
    "inheritsGlobal": true
  }
}
```

### DTO seguro para frontend

Nunca retornar:

- `apiKeyEncrypted`
- `webhookAuthTokenEncrypted`
- qualquer secret em texto plano

Retornar apenas:

```json
{
  "enabled": true,
  "connected": true,
  "hasApiKey": true,
  "walletId": "parcial ou completo conforme visao interna",
  "accountEmail": "cliente@empresa.com",
  "accountName": "Empresa LTDA",
  "status": "active",
  "platformFeePercent": 5,
  "methods": {
    "pix": true,
    "creditCard": true,
    "debitCard": true,
    "cashOnPickup": true,
    "cashOnDelivery": true
  }
}
```

### Order.payment

```json
{
  "method": "pix | credit_card | debit_card | cash_on_pickup | cash_on_delivery",
  "provider": "manual | asaas",
  "status": "pending | paid | failed | cancelled | manual",
  "amount": 100,
  "platformFeeAmount": 5,
  "tenantNetAmount": 95,
  "providerPaymentId": "",
  "providerCustomerId": "",
  "invoiceUrl": "",
  "bankSlipUrl": "",
  "pixCopyPaste": "",
  "pixQrCode": "",
  "paidAt": null,
  "updatedAt": null
}
```

### Order.paymentEvents

Novo historico de auditoria financeira:

```json
[
  {
    "type": "charge_created | webhook_received | payment_status_changed | manual_mark_paid | split_applied | charge_lookup",
    "provider": "asaas | manual",
    "status": "pending | paid | failed | cancelled | manual",
    "message": "Pagamento confirmado pelo webhook",
    "providerEvent": "PAYMENT_RECEIVED",
    "providerPaymentId": "",
    "occurredAt": "2026-06-02T12:00:00.000Z",
    "meta": {}
  }
]
```

Regras:

- historico deve ser append-only
- sem armazenar secrets
- sem logar payloads sensiveis completos
- base para analytics financeiros futuros

## Configuracoes Financeiras no admin nivel 0

Criar uma area dedicada no admin:

- `Configuracoes Financeiras`

Responsabilidades:

- exibir status da integracao Asaas da plataforma
- mostrar ambiente `sandbox | production`
- configurar `platformWalletId`
- configurar taxa global `defaultPlatformFeePercent`
- validar limite de taxa
- mostrar URL esperada de webhook
- exibir se a chave raiz esta configurada via env
- disparar teste de conexao simples, se seguro

Regras:

- apenas nivel 0 acessa e altera
- `ASAAS_API_KEY` continua somente em env/backend
- nada sensivel vai ao frontend

## Taxa global e override por tenant

### Regra global

- a plataforma define `defaultPlatformFeePercent`
- valor sugerido inicial: `5`
- faixa permitida no MVP: `0` a `30`

### Override por tenant

Cada tenant pode:

- herdar a taxa global
- ou usar taxa propria

Resolucao final:

1. se `split.inheritsGlobal === true`, usar taxa global
2. se `split.inheritsGlobal === false`, usar `split.platformFeePercent` do tenant
3. se split estiver desativado, cobrar integralmente para o tenant

### Calculo

```text
platformFeeAmount = round(total * percent / 100)
tenantNetAmount = total - platformFeeAmount
```

Arredondamento:

- sempre em centavos
- persistir no pedido os valores ja calculados

Observacao:

- o payload do Asaas sera configurado com `percentualValue` para a conta raiz
- o remanescente nao precisa ser enviado em outro item do split

## Checkout publico

### UX das formas de pagamento

A area `Forma de pagamento` deve evoluir para cards visuais:

- `Pix`
  - descricao: `Voce recebera o QR Code para pagamento.`
- `Cartao`
  - descricao: `Pagamento seguro processado pelo Asaas.`
- `Pagar na retirada`
  - descricao: `Voce pagara ao retirar o pedido.`
- `Pagar na entrega`
  - descricao: `Voce pagara no momento da entrega.`

Regras:

- mostrar so metodos ativos
- destacar claramente a selecao atual
- manter mobile amigavel
- pagamento online so aparece se Asaas estiver ativo

### Mapeamento de metodos

- `pix` -> cobranca `PIX`
- `credit_card` -> cobranca `CREDIT_CARD` com `invoiceUrl`
- `debit_card` -> cobranca hospedada tambem via `invoiceUrl`
  - decisao: no Asaas nao ha `billingType` dedicado para debito; a opcao de debito aparece na fatura quando o fluxo hospedado usa `CREDIT_CARD` ou `UNDEFINED`
- `cash_on_pickup` -> pedido manual
- `cash_on_delivery` -> pedido manual

## Fluxo de cobranca Asaas

1. cliente escolhe metodo no carrinho
2. frontend envia pedido
3. backend recalcula o total
4. backend valida metodo ativo
5. backend cria `Order` com `payment.status = pending` para online ou `manual` para offline
6. backend cria/resolve o customer Asaas da subconta
7. backend cria a cobranca Asaas com `externalReference = tenant:<businessId>:order:<orderId>`
8. backend aplica split se habilitado
9. backend salva ids e links retornados
10. para Pix, backend busca `pixQrCode` e `pixCopyPaste` se aplicavel
11. frontend mostra QR Pix ou redireciona/abre `invoiceUrl`
12. webhook atualiza status automaticamente

## Webhook Asaas

Endpoint:

- `POST /api/webhooks/asaas`

Validacao:

- conferir header `asaas-access-token`
- comparar com token esperado
- nao confiar apenas no payload recebido
- consultar a cobranca na API da subconta antes de atualizar status
- ser idempotente

Eventos relevantes iniciais:

- `PAYMENT_CREATED`
- `PAYMENT_CONFIRMED`
- `PAYMENT_RECEIVED`
- `PAYMENT_OVERDUE`
- `PAYMENT_REFUNDED`
- `PAYMENT_REFUND_IN_PROGRESS`
- `PAYMENT_DELETED`
- `PAYMENT_RESTORED`
- `PAYMENT_CREDIT_CARD_CAPTURE_REFUSED`
- `PAYMENT_CHARGEBACK_REQUESTED`

Mapeamento interno inicial:

- `PAYMENT_RECEIVED` -> `paid`
- `PAYMENT_CONFIRMED` -> `paid` operacionalmente para UI, com observacao de que o saldo ainda pode nao estar disponivel
- `PAYMENT_OVERDUE` -> `failed` ou `pending_overdue` nao sera criado agora; no MVP usar `failed`
- `PAYMENT_REFUNDED` -> `cancelled`
- `PAYMENT_DELETED` -> `cancelled`
- recusas/chargeback -> `failed`

Persistencia:

- atualizar `Order.payment.status`
- atualizar `paidAt` quando pago
- registrar `paymentEvents`
- publicar `tenant_updated` com `order_payment_updated`

## Criacao da subconta

### Modo principal: API first

Admin nivel 0 executa:

- criar subconta via `POST /v3/accounts`
- salvar:
  - `subaccountId`
  - `walletId`
  - `apiKeyEncrypted`
  - `status`
  - `connectedAt`

### Fallback manual

Admin nivel 0 pode:

- informar `walletId`
- informar `apiKey`
- marcar tenant como conectado

Isso cobre:

- subcontas ja existentes
- bloqueio/regulatory review
- cenarios operacionais onde a criacao automatica nao estiver disponivel

## Permissoes

- nivel 0:
  - configura provider Asaas
  - cria subconta
  - conecta manualmente
  - altera taxa global
  - altera override por tenant
- nivel 1:
  - nao altera credenciais
  - nao altera split/taxa
- nivel 2:
  - pode visualizar status/metodos
  - pode no maximo ver configuracao operacional simplificada, sem credenciais e sem taxa
- nivel 3/4:
  - operam pedidos conforme escopo atual
- nivel 5:
  - leitura

## Seguranca

- total sempre recalculado no backend
- metodo de pagamento validado contra metodos ativos do tenant
- `apiKey` criptografada com AES-256-GCM
- nunca expor `apiKeyEncrypted`
- nunca salvar dados de cartao
- webhook sempre faz lookup da cobranca antes de atualizar pedido
- validar `businessId` em tudo
- bloquear cross-tenant
- logs sem secrets ou payload sensivel completo
- HTTPS obrigatorio em producao

## Analytics financeiros futuros

Esta entrega nao cria o dashboard financeiro completo, mas prepara a estrutura:

- `Order.payment.platformFeeAmount`
- `Order.payment.tenantNetAmount`
- `Order.paymentEvents`
- `Business.paymentSettings.split`
- configuracao global de fee

Isso permite no futuro:

- receita bruta por tenant
- receita liquida do tenant
- receita da plataforma
- taxa media aplicada
- pagamentos pagos x falhos x cancelados

## Fases de implementacao

1. modelagem de `Business.paymentSettings.asaas`, `split`, `Order.payment` e `paymentEvents`
2. provider abstraction para retirar acoplamento direto do Mercado Pago no fluxo atual
3. `asaasService` com customer, subconta, cobranca, QR Pix e consulta
4. configuracao global `Configuracoes Financeiras`
5. configuracao por tenant e criacao/conexao de subconta
6. cobranca Asaas no checkout sem split
7. split percentual da plataforma
8. webhook idempotente
9. UX de formas de pagamento
10. painel de pedidos e auditoria financeira
11. testes e build

## Riscos conhecidos

- periodo de avaliacao regulatoria do Asaas pode limitar subcontas e cobrancas
- split percentual depende do valor liquido disponivel; divergencia pode bloquear o split
- cartao de debito no Asaas depende da fatura hospedada, nao de `billingType` proprio
- se a subconta nao tiver dados comerciais completos/aprovados, alguns meios podem falhar
- o projeto hoje ainda tem trilha parcial de Mercado Pago; a primeira fase deve abstrair provider para evitar regressao

