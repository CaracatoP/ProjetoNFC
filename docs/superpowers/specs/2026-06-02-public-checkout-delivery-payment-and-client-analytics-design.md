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
5. Validacao defensiva no backend contra combinacoes invalidas
6. Enriquecimento do payload de analytics do painel cliente com labels, shares e blocos derivados
7. Pequenas melhorias de copy e hierarquia visual no painel cliente
8. Testes de regressao do checkout e de analytics

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

`deliveryType` deixa de nascer como `pickup` no estado inicial e passa a ser vazio.

### Etapa 2: formas de pagamento filtradas

Se o cliente escolher `delivery`, so podem aparecer:

- `pix`
- `credit_card`
- `debit_card`
- `cash_on_delivery`

Se o cliente escolher `pickup`, so podem aparecer:

- `pix`
- `credit_card`
- `debit_card`
- `cash_on_pickup`

As labels devem refletir o contexto:

- em `delivery`, mostrar `Pagamento na entrega`
- em `pickup`, mostrar `Pagamento na retirada`

### Troca de tipo de recebimento

Ao trocar de `delivery` para `pickup`, ou de `pickup` para `delivery`:

- se o `paymentMethod` atual continuar valido, ele pode ser mantido
- se o `paymentMethod` atual se tornar invalido, ele deve ser limpo imediatamente

Exemplos invalidos:

- `pickup + cash_on_delivery`
- `delivery + cash_on_pickup`

## Design do checkout

### Estrutura visual

O drawer/modal atual do carrinho sera mantido, mas a area de checkout sera reorganizada em duas secoes bem separadas:

1. `Como voce vai receber?`
2. `Como deseja pagar?`

### Secao de recebimento

Usar cards ou botoes grandes, visiveis e clicaveis, com destaque visual maior do que os campos de formulario.

Cada opcao deve trazer:

- titulo: `Entrega` ou `Retirada`
- descricao curta
- estado selecionado claro

### Secao de pagamento

So aparece quando `deliveryType` estiver definido.

Mantem o padrao recente de cards de pagamento, mas agora filtrado pelo tipo de recebimento.

O restante do fluxo atual continua:

- Pix continua mostrando QR Code/copia e cola no sucesso
- cartao online continua seguindo redirect/hosted checkout
- pagamento manual continua com instrucoes de retirada/entrega

## Validacao defensiva no backend

O backend precisa validar a compatibilidade entre `deliveryType` e `payment.method` na criacao do pedido, sem confiar no frontend.

Regra:

- se `deliveryType = delivery`, rejeitar `cash_on_pickup`
- se `deliveryType = pickup`, rejeitar `cash_on_delivery`

Resposta esperada:

- `400` com codigo explicito de combinacao invalida

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

## Arquivos esperados

### Checkout

- `frontend/src/components/business/BusinessCatalogSection.jsx`
- `frontend/src/components/business/BusinessCatalogSection.test.jsx`
- `backend/src/services/moduleService.js`
- `backend/src/validators/moduleValidators.js`
- possivelmente `shared/utils/businessPayment.js` se a compatibilidade de metodos precisar de helper dedicado

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
5. backend rejeita payload manual incompativel

### Analytics cliente

6. payload de analytics do cliente inclui labels legiveis para `byEventType`
7. payload de analytics do cliente inclui labels legiveis para `topTargets`
8. painel cliente renderiza metricas e nomes legiveis sem depender de tokens crus

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
