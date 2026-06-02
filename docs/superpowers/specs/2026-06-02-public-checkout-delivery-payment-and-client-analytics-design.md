# Checkout Publico por Etapas e Analytics Legiveis no Painel Cliente

## Contexto

O TapLink ja possui:

- checkout publico em `/site/:slug/catalog`
- criacao de pedido no backend com recálculo de total
- metodos de pagamento por tenant
- fluxo de QR Code / redirecionamento hospedado
- painel cliente com analytics condicionado por plano e nivel

Hoje existem dois problemas de UX:

1. O checkout mostra formas de pagamento antes de o cliente escolher se o pedido e por `entrega` ou `retirada`.
2. O painel cliente de analytics ainda exibe parte dos dados com pouca semantica visual e, em alguns blocos, sem labels legiveis o suficiente para operacao diaria.

## Objetivo

Corrigir o fluxo do checkout para que:

- o cliente escolha primeiro `Entrega` ou `Retirada`
- as formas de pagamento so aparecam depois dessa escolha
- combinacoes incoerentes sejam bloqueadas no frontend e no backend

E melhorar o analytics do painel cliente para que:

- labels e metricas cheguem do backend ja formatadas
- o frontend cliente renderize blocos mais claros e legiveis
- a hierarquia visual fique mais proxima da qualidade ja usada nos analytics do admin

## Escopo

### Inclui

1. Escolha obrigatoria de `deliveryType` antes do pagamento
2. `deliveryType` iniciando vazio, sem default implicito
3. Filtragem de metodos de pagamento por tipo de recebimento
4. Limpeza de `paymentMethod` ao trocar `deliveryType` quando a opcao ficar invalida
5. Compatibilidade com tenants antigos que ainda usam aliases legados de pagamento
6. Validacao defensiva no backend contra combinacoes invalidas
7. Enriquecimento do payload de analytics do painel cliente com labels, shares e blocos derivados
8. Pequenas melhorias de copy e hierarquia visual no painel cliente
9. Testes de regressao do checkout e de analytics

### Nao inclui

- redesign completo do checkout
- novos endpoints para pedido
- mudanca de regras de calculo, QR ou redirect
- refatoracao completa do analytics admin
- novos graficos pesados ou biblioteca adicional

## Regras de negocio

### Etapa 1: tipo de recebimento

O checkout passa a exigir uma escolha explicita entre:

- `delivery`
- `pickup`

Antes dessa escolha:

- nao mostrar formas de pagamento
- nao permitir envio do pedido

### Estado inicial

`deliveryType` deixa de nascer como `pickup` e passa a ser vazio.

Estado esperado:

- `deliveryType = ''` ou `null`
- `paymentMethod = ''` ou `null`
- botao `Finalizar pedido` bloqueado ate `deliveryType` e `paymentMethod` estarem validos

### Etapa 2: formas de pagamento filtradas

Se `deliveryType = delivery`, permitir:

- `pix`
- `credit_card`
- `debit_card`
- `cash_on_delivery`

Se `deliveryType = pickup`, permitir:

- `pix`
- `credit_card`
- `debit_card`
- `cash_on_pickup`

Labels contextuais:

- `delivery`: `Pagamento na entrega`
- `pickup`: `Pagamento na retirada`

Combinacoes invalidas:

- `pickup + cash_on_delivery`
- `delivery + cash_on_pickup`

### Troca de tipo de recebimento

Ao trocar `deliveryType`:

- se `paymentMethod` atual continuar valido, pode manter
- se `paymentMethod` atual ficar invalido, limpar imediatamente

### Compatibilidade com metodos antigos

Normalizar aliases legados antes de renderizar ou validar:

- `cash` ou `money` + `delivery` => `cash_on_delivery`
- `cash` ou `money` + `pickup` => `cash_on_pickup`
- `card` => `credit_card` ou `debit_card` apenas se o tenant tiver essa opcao habilitada
- `online` => `pix` ou cartao apenas se houver metodo online habilitado explicitamente
- aliases ambiguos nunca devem gerar opcao vazia ou invalida no frontend

## Design do checkout

### Estrutura visual

O drawer/modal atual do carrinho sera mantido, mas a area de checkout sera reorganizada em duas secoes bem separadas:

1. `Como voce vai receber?`
2. `Como deseja pagar?`

Etapa 1 deve usar cards grandes:

- `Entrega`
  - `Receber no endereco informado`

- `Retirada`
  - `Buscar no estabelecimento`

Cada card deve ter:

- titulo
- descricao curta
- estado selecionado claro

### Secao de pagamento

So aparece quando `deliveryType` estiver definido.

Titulo contextual:

- `Como deseja pagar na entrega?`
- `Como deseja pagar na retirada?`

O restante do fluxo atual continua:

- Pix continua mostrando QR Code/copia e cola no sucesso
- cartao online continua seguindo redirect/hosted checkout
- pagamento manual continua com instrucoes coerentes de retirada/entrega

## Backend

O backend precisa validar a compatibilidade entre `deliveryType` e `payment.method` na criacao do pedido, sem confiar no frontend.

Criar funcao central:

`validatePaymentMethodForDeliveryType(deliveryType, paymentMethod)`

Usar em:

- `backend/src/services/moduleService.js`
- `backend/src/validators/moduleValidators.js`
- qualquer outro ponto que crie pedido publico

Regras:

- se `deliveryType` estiver vazio, rejeitar
- se `paymentMethod` estiver vazio, rejeitar
- se `paymentMethod` nao estiver habilitado para o tenant, rejeitar
- se `deliveryType = delivery`, rejeitar `cash_on_pickup`
- se `deliveryType = pickup`, rejeitar `cash_on_delivery`
- se `paymentMethod` nao for compativel com `deliveryType`, retornar `400` com codigo explicito

Mensagens obrigatorias:

- sem `deliveryType`: `Escolha se deseja entrega ou retirada.`
- sem `paymentMethod`: `Escolha uma forma de pagamento.`
- combinacao invalida: `Essa forma de pagamento nao esta disponivel para o tipo de recebimento escolhido.`

O backend continua:

- recalculando total
- validando metodo habilitado no tenant
- preservando pedidos manuais e online existentes

## Analytics do painel cliente

### Problema atual

O painel cliente depende demais de payloads crus do agregado de analytics, o que produz:

- nomes pouco claros
- blocos sem contexto suficiente
- semantica inferior ao analytics do admin

### Direcao

O backend passa a devolver o payload do cliente ja enriquecido, reaproveitando os mesmos formatadores conceituais usados no admin quando possivel.

Campos esperados no payload do cliente:

- `totals` com metricas nomeadas
- `byEventType` com `eventType`, `label`, `count`, `share`
- `topTargets` com `label`, `targetType`, `count`
- `dailyEvents` ou timeline simplificada
- `recentEvents` com labels legiveis
- `baselineAt`
- `scope`

### Reuso de logica

A logica de formatacao deve preferir reuso dos helpers ja existentes no backend admin, em vez de duplicar humanizacao no frontend.

Meta:

- o frontend do cliente so organiza e apresenta
- o backend decide labels e agregados semanticamente prontos

### Melhoria visual no frontend

Sem redesenhar o painel inteiro, ajustar:

- titulos mais descritivos
- descricoes mais claras
- cards com valor + contexto
- lista de barras com labels legiveis
- legenda simples no grafico de ritmo recente, se couber sem inflar o escopo

Mesmo com payload enriquecido, o frontend deve manter fallback seguro para labels desconhecidas.

Exemplo:

- se vier `eventType` desconhecido, humanizar de forma segura
- nunca deixar o bloco sem nome ou com texto vazio

## Arquivos esperados

### Checkout

- `frontend/src/components/business/BusinessCatalogSection.jsx`
- `frontend/src/components/business/BusinessCatalogSection.test.jsx`
- `backend/src/services/moduleService.js`
- `backend/src/validators/moduleValidators.js`
- `shared/utils/businessPayment.js` para normalizacao/compatibilidade de metodos

### Analytics cliente

- `backend/src/services/clientPanelService.js`
- `backend/src/utils/adminAnalytics.js`
- `frontend/src/pages/panel/ClientPanelPage.jsx`
- `frontend/src/pages/panel/ClientPanelPage.test.jsx`
- `frontend/src/styles/global.css` se a legenda/ajustes visuais exigirem suporte

## Testes obrigatorios

### Checkout

1. checkout nao mostra pagamento antes da escolha entre entrega e retirada
2. `pickup` nao aceita `cash_on_delivery`
3. `delivery` nao aceita `cash_on_pickup`
4. trocar `deliveryType` limpa `paymentMethod` invalido
5. tenant com metodo legado `cash` renderiza corretamente conforme `deliveryType`
6. `deliveryType` vazio bloqueia envio
7. `paymentMethod` vazio bloqueia envio depois do `deliveryType`
8. backend rejeita payload manual incompativel

### Analytics cliente

9. payload de analytics do cliente inclui labels legiveis para `byEventType`
10. payload de analytics do cliente inclui labels legiveis para `topTargets`
11. painel cliente renderiza metricas e nomes legiveis sem depender de tokens crus
12. fallback de label desconhecida no analytics evita nome vazio

## Criterios de aceite

### Checkout

- o cliente primeiro escolhe `Entrega` ou `Retirada`
- antes disso, nenhuma forma de pagamento aparece
- so aparecem metodos compativeis com a escolha
- combinacoes incoerentes sao bloqueadas no frontend e no backend
- QR Code, redirect e sucesso continuam funcionando

### Analytics cliente

- os blocos exibem nomes claros do que esta sendo medido
- rankings e tipos de evento aparecem com labels legiveis
- a leitura do painel fica mais proxima de um dashboard comercial, sem depender de nomes crus do Mongo

## Riscos e limites

- Como o checkout atual ja tem bastante estado local, a mudanca deve ser pequena e isolada para evitar regressao no carrinho.
- O enriquecimento do analytics do cliente nao deve recriar tudo que o admin faz; o foco e legibilidade operacional, nao paridade total.
- A compatibilidade de pedidos existentes deve ser preservada, especialmente para payloads antigos que nao passavam por essa combinacao contextual de recebimento + pagamento.
