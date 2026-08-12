# Homologacao Asaas Sandbox

Este checklist prepara o TapLink para inserir credenciais reais de Sandbox sem conectar producao.

## Envs

- `ASAAS_ENV=sandbox`
- `ASAAS_API_KEY=<sandbox-root-api-key>`
- `ASAAS_WEBHOOK_TOKEN=<token-configurado-no-webhook-asaas>`
- `PAYMENT_CREDENTIALS_ENCRYPTION_KEY=<chave-estavel-de-producao>`
- `API_PUBLIC_BASE_URL=<url-publica-do-backend>`
- `FRONTEND_ORIGIN=<url-do-frontend>`

Nao salve credenciais reais neste arquivo.

## Ordem de homologacao

1. Configurar envs de Sandbox no backend.
2. Fazer restart/deploy do backend.
3. Entrar no admin interno com usuario nivel 0.
4. Abrir integracao financeira e clicar em `Testar conexao Asaas`.
5. Confirmar ambiente `sandbox` na resposta.
6. Confirmar que a conta raiz possui `platformWalletId` configurado.
7. Configurar no Asaas o webhook para `API_PUBLIC_BASE_URL/api/webhooks/asaas`.
8. Configurar no Asaas o token igual a `ASAAS_WEBHOOK_TOKEN`.
9. Criar ou associar subconta Asaas do tenant.
10. Confirmar `paymentSettings.asaas.walletId` do tenant.
11. Confirmar que wallet da plataforma e wallet do tenant sao diferentes.
12. Habilitar checkout Asaas/Pix apenas para o tenant de teste.
13. Criar um pedido Pix no catalogo publico.
14. Confirmar que `Order.payment.providerPaymentId` foi preenchido.
15. Confirmar que existe um registro `Payment` para o mesmo provider payment.
16. Confirmar que existe ou foi reutilizado um `PaymentCustomer`.
17. Confirmar que o QR Code Pix e copia-e-cola foram retornados.
18. Simular pagamento no Sandbox.
19. Confirmar recebimento do webhook no backend.
20. Confirmar `WebhookEvent.status=processed`.
21. Confirmar atualizacao de `Payment.status`.
22. Confirmar atualizacao de `Order.payment.status`.
23. Confirmar atualizacao em tempo real no admin/painel.
24. Reenviar o mesmo webhook e confirmar idempotencia.
25. Simular webhook invalido e confirmar erro sanitizado.
26. Repetir pedido para outro tenant e confirmar isolamento de wallet/subconta.

## Responsabilidades de dados

- `Payment` e a fonte financeira autoritativa para provider payment, status financeiro, billingType, amount, paidAt, providerCustomerId e externalReference.
- `Order.payment` permanece como snapshot legado/derivado para contratos existentes de pedido e UI publica/admin.
- Webhooks devem reconciliar ambos, mas falhas parciais precisam ser recuperaveis em retry.
- `PaymentCustomer` guarda a identidade local reutilizavel por tenant/provider e o ID remoto do customer Asaas.
- `WebhookEvent` guarda idempotencia por `provider + eventId`.

## Indices obrigatorios

Executar no backend antes de homologar se `autoIndex` estiver desabilitado:

```bash
npm --prefix backend run ensure:payment-indexes
```

O comando garante os indices declarados em:

- `Payment`
- `PaymentCustomer`
- `WebhookEvent`

Se o comando falhar por duplicidade, nao continue a homologacao antes de limpar/reconciliar os registros duplicados.

## Comportamento de retry

- O client Asaas nao faz retry automatico para operacoes de criacao.
- `GET` pode ser repetido pelo fluxo chamador quando for seguro.
- `429` e normalizado como erro de rate limit e inclui metadados seguros dos headers quando disponiveis.
- Webhook duplicado com evento ja processado retorna `204`.
- Webhook `failed` ou `processing` antigo pode ser reprocessado.
