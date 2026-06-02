# Hardening e UX Operacional do Painel Financeiro Asaas/Split

## Contexto

O TapLink ja possui um painel interno de configuracao financeira para Asaas e payment split em:

- [AdminFinancialSettingsPanel.jsx](/C:/Users/RDP/Downloads/ProjetoNFCv2/ProjetoNFC/frontend/src/components/business/AdminFinancialSettingsPanel.jsx)
- [adminFinanceService.js](/C:/Users/RDP/Downloads/ProjetoNFCv2/ProjetoNFC/backend/src/services/adminFinanceService.js)

Esse painel e exclusivo do admin interno nivel 0. Nao e uma area do cliente final. Isso permite manutencao manual e overrides operacionais, mas a tela atual ainda esta:

- visualmente pesada
- pouco guiada
- com campos sensiveis muito expostos
- com validacoes operacionais criticas insuficientes no backend

O objetivo desta entrega e endurecer as regras operacionais e reorganizar a UX sem quebrar a arquitetura atual, as rotas existentes ou o shape basico do DTO.

## Objetivo

Refinar o painel de integration financeira e payment split do Asaas para operacao real multi-tenant, mantendo compatibilidade com a implementacao atual e melhorando:

- seguranca operacional
- validacao no backend
- clareza visual
- feedback de status
- fluxo de criacao de subconta
- compreensao do split e da taxa efetiva

## Fora de escopo

- mudar rotas existentes
- quebrar o shape atual do DTO
- mover o painel para outra area do sistema
- criar nova arquitetura de estado
- expor esse painel para clientes
- reescrever a integracao com Asaas
- alterar billing/plano/global auth

## Decisoes principais

1. O backend continua sendo a fonte de verdade para validacoes criticas.
2. O frontend pode orientar e prevenir erros, mas nao substitui as travas do service.
3. O DTO atual sera preservado e apenas enriquecido com campos derivados seguros.
4. Campos sensiveis permanecem editaveis por ser painel interno, mas ficam mascarados por padrao e agrupados em modo avancado.
5. O fluxo de criacao de subconta continua retornando o tenant atualizado e a UI deve refletir isso sem F5.

## Estrutura da tela

O painel sera reorganizado em quatro blocos principais.

### 1. Configuracao Global da Plataforma

Campos e indicadores:

- ambiente `sandbox | production`
- status da integracao
- wallet da plataforma
- taxa padrao da plataforma
- webhook Asaas
- status da conta raiz

Responsabilidade:

- mostrar claramente se a plataforma pode operar Asaas com seguranca
- destacar que a chave raiz vem do backend/env
- concentrar a configuracao global de split

### 2. Configuracao Financeira do Tenant

Campos e indicadores:

- tenant selecionado
- provider ativo
- status financeiro da subconta
- walletId da subconta
- nome da conta
- metodos de pagamento
- configuracao de split
- override de taxa

Responsabilidade:

- mostrar a configuracao operacional vigente do tenant
- separar o essencial do tecnico
- orientar se o tenant esta herdando taxa global ou usando taxa customizada

### 3. Criar Subconta Asaas

Campos:

- nome
- e-mail
- CPF/CNPJ
- celular
- CEP
- numero
- bairro/provincia

Feedback operacional:

- carregando
- criando subconta
- sucesso
- erro seguro da API
- walletId criado
- status retornado
- conta vinculada ao tenant

### 4. Resumo Operacional

Card resumido com:

- provider
- status da subconta
- split
- taxa efetiva
- checkout online
- webhook/integracao global

Objetivo:

- permitir leitura rapida do estado financeiro do tenant
- reduzir a necessidade de percorrer o formulario inteiro

## Status visuais

Os textos crus serao substituidos por badges operacionais consistentes.

### Status de integracao global

Valores base:

- `missing_api_key`
- `missing_webhook_auth_token`
- `configured`
- `invalid_credentials`
- `webhook_error`

Observacao:

- `invalid_credentials` e `webhook_error` podem ser introduzidos como estados derivados seguros, sem quebrar compatibilidade. Se o backend ainda nao conseguir provar esses estados nesta fase, a UI continua cobrindo pelo menos os estados atuais com visual melhor.

### Status de subconta

Mapeamento visual:

- `not_connected` -> Nao conectada
- `pending` -> Pendente
- `in_review` -> Em analise
- `active` -> Ativa
- `rejected` -> Rejeitada
- `blocked` -> Bloqueada

### Status operacionais derivados

Badges adicionais:

- split ativo / desativado
- checkout ativo / bloqueado
- taxa global / taxa customizada

## Backend first: hardening operacional

O service principal continua em [adminFinanceService.js](/C:/Users/RDP/Downloads/ProjetoNFCv2/ProjetoNFC/backend/src/services/adminFinanceService.js).

### Regras obrigatorias

#### Integracao global

- `provider = asaas` nao pode ser considerado valido se a integracao global estiver em estado invalido.
- `asaas.enabled = true` nao pode ser salvo se a integracao global estiver sem API key ou em estado invalido.

#### Split

- `split.enabled = true` exige `platformWalletId` global valido.
- `split.enabled = true` exige `asaas.walletId` valido no tenant.
- `split.enabled = true` so pode operar quando o provider efetivo for `asaas`.
- o backend define um limite explicito `MAX_PLATFORM_FEE_PERCENT`, com valor inicial `30`.
- `effectivePlatformFeePercent` nao pode ser menor que `0` nem maior que `MAX_PLATFORM_FEE_PERCENT`.

#### Checkout online

- `enabled = true` com `provider = asaas` exige integracao global valida.
- `enabled = true` com `provider = asaas` exige `tenantFinancialStatus` valido/ativo.
- `enabled = true` com `provider = asaas` exige `asaas.walletId` valido.
- `enabled = true` com `split.enabled = true` exige `canEnableSplit = true`.
- se qualquer regra falhar, o backend deve retornar erro claro e incluir `warnings` no DTO.
- metodos online devem ser bloqueados quando a subconta nao estiver valida.

### WalletId e campos sensiveis

- `walletId` deve ser validado antes de salvar.
- alteracoes sensiveis continuam permitidas, mas o backend deve rejeitar combinacoes invalidas.
- `walletId` e `apiKey` devem ficar mascarados por padrao na UI.
- deve existir botao `mostrar/ocultar`.
- deve existir botao `copiar`.
- deve existir aviso visual de impacto antes de alteracoes sensiveis.
- salvar alteracao sensivel deve exigir confirmacao explicita.
- campos sensiveis devem ficar agrupados dentro de `Configuracoes avancadas`.
- erros de API nunca devem exibir stack trace ou payload sensivel cru.

### Shape do DTO

Manter os campos atuais e enriquecer com campos derivados, sem quebrar compatibilidade:

```json
{
  "businessId": "...",
  "businessName": "...",
  "businessSlug": "...",
  "enabled": true,
  "provider": "asaas",
  "integrationStatus": "configured",
  "tenantFinancialStatus": "active",
  "methods": {},
  "manualPixConfigured": false,
  "asaas": {},
  "split": {},
  "usesGlobalFee": true,
  "effectivePlatformFeePercent": 3,
  "canEnableSplit": true,
  "canEnableCheckout": true,
  "warnings": [],
  "splitPreview": {
    "globalPercent": 3,
    "tenantOverridePercent": null,
    "effectivePlatformFeePercent": 3,
    "platformPercent": 3,
    "tenantNetPercent": 97,
    "inheritsGlobal": true,
    "splitActive": true,
    "mode": "global"
  },
  "summary": {
    "providerLabel": "Asaas",
    "integrationLabel": "Configurado",
    "tenantFinancialLabel": "Ativo",
    "splitLabel": "Ativo",
    "checkoutLabel": "Ativo"
  }
}
```

### Regra de taxa efetiva

- quando `usesGlobalFee = true`:
  - `effectivePlatformFeePercent = globalPercent`
  - `tenantOverridePercent = null`
  - `splitPreview.mode = "global"`
- quando `usesGlobalFee = false`:
  - `effectivePlatformFeePercent = tenantOverridePercent`
  - `splitPreview.mode = "custom"`
- `effectivePlatformFeePercent` precisa ficar entre `0` e `MAX_PLATFORM_FEE_PERCENT`.

## Modo avancado

Campos tecnicos e sensiveis vao para um bloco colapsavel:

- API key manual
- edicao manual de walletId
- override manual de provider
- credenciais sensiveis
- acoes de limpeza/troca de chave

Regras:

- mascarados por padrao
- botao mostrar/ocultar
- botao copiar
- aviso visual de impacto
- confirmacao antes de salvar alteracao sensivel
- agrupados dentro de `Configuracoes avancadas`

Copy sugerida:

`Alterar credenciais financeiras pode impactar pagamentos deste tenant.`

## Split e override de taxa

O checkbox `Aplicar split da plataforma` sera mantido.

### Comportamento desejado

- quando `provider = asaas`, a UI sugere split habilitado
- isso nao deve gravar automaticamente
- o admin continua no controle do save

### Preview em tempo real

O preview deve reagir aos campos do draft e exibir:

- taxa global
- override do tenant
- taxa efetiva
- percentual TapLink
- percentual tenant
- se esta herdando ou usando taxa customizada

Exemplos:

#### Herdando taxa global

```text
Taxa global: 3%
Override tenant: nao aplicado
Taxa efetiva: 3%
TapLink recebe: 3%
Tenant recebe: 97%
Modo: herdando taxa global
```

#### Taxa customizada

```text
Taxa global: 3%
Override tenant: 2%
Taxa efetiva: 2%
TapLink recebe: 2%
Tenant recebe: 98%
Modo: taxa customizada do tenant
```

### Copy operacional

- `Este tenant esta usando a taxa global da plataforma`
- `Este tenant possui taxa customizada`

### Regra operacional do override

- `override = 0` nao significa automaticamente taxa customizada `0%`.
- se `usesGlobalFee = true`, o override deve ser ignorado e a UI deve usar a taxa global.
- apenas quando `usesGlobalFee = false` o valor de `tenantOverridePercent` passa a definir a taxa efetiva.

## Criacao de subconta Asaas

O formulario sera mantido na tela atual, mas com UX mais guiada.

### Melhorias

- validacao clara de:
  - CPF/CNPJ obrigatorio
  - e-mail valido
  - celular valido
  - CEP obrigatorio
  - numero obrigatorio
  - bairro/provincia obrigatorio
- validacao mais clara
- loading dedicado
- card de sucesso/erro
- exibicao do `walletId` criado
- exibicao do status da conta
- exibicao de que a conta foi vinculada ao tenant
- erro da API tratado sem stack trace cru

### Regras de validacao da subconta

- `cpfCnpj` obrigatorio e normalizado antes de enviar para a API.
- `email` obrigatorio e validado em formato correto.
- `mobilePhone` obrigatorio e validado com formato aceitavel para operacao.
- `postalCode` obrigatorio.
- `addressNumber` obrigatorio.
- `province` obrigatorio.
- erro vindo do Asaas deve ser convertido para mensagem limpa e operacional, sem stack ou payload sensivel cru.

### Pos-sucesso

Ao criar a subconta com sucesso:

- atualizar o tenant no estado local da tela
- atualizar `tenantSettings` com o retorno do backend
- atualizar `tenantDraft` com o retorno do backend
- atualizar `subaccountDraft` apenas com os dados que fizerem sentido manter ou limpar apos sucesso
- preencher `asaas.walletId` automaticamente
- atualizar `tenantFinancialStatus`
- atualizar `summary` e `warnings`
- refletir `provider`/split/metodos conforme retorno do backend
- exibir mensagem de sucesso com `walletId` e `status`
- nao apagar os demais dados financeiros ja configurados
- nao exigir F5

## Arquitetura de frontend

O componente principal continua sendo [AdminFinancialSettingsPanel.jsx](/C:/Users/RDP/Downloads/ProjetoNFCv2/ProjetoNFC/frontend/src/components/business/AdminFinancialSettingsPanel.jsx), mas pode extrair subcomponentes pequenos para reduzir peso e melhorar leitura.

Extracoes permitidas e desejadas:

- `FinanceStatusBadge`
- `FinanceSummaryCard`
- `FinanceSplitPreview`
- `FinanceAdvancedSection`

Nao e objetivo criar um novo modulo complexo de estado.

## Feedback e confirmacoes

### Confirmacao de alteracao sensivel

Antes de salvar mudancas como API key, walletId manual ou provider tecnico:

- mostrar confirmacao explicita

### Mensagens de sucesso

- so mostrar sucesso apos resposta real do backend
- nunca assumir sucesso por update otimista

### Erros

- mensagens operacionais claras
- sem stack trace cru
- destacar quando o bloqueio veio de regra de seguranca operacional

## Testes

### Backend

Adicionar ou ajustar testes para:

- DTO enriquecido com:
  - `integrationStatus`
  - `tenantFinancialStatus`
  - `splitPreview`
  - `usesGlobalFee`
  - `effectivePlatformFeePercent`
  - `canEnableSplit`
  - `canEnableCheckout`
  - `warnings`
- bloquear split sem `platformWalletId`
- bloquear split sem `asaas.walletId`
- bloquear `asaas.enabled` sem integracao global valida
- bloquear checkout online inconsistente
- bloquear taxa abaixo de `0` ou acima do limite
- validar retorno seguro do DTO enriquecido
- criar subconta e refletir estado atualizado do tenant

### Frontend

Adicionar ou ajustar testes para:

- render das quatro secoes
- badges de status
- modo avancado colapsavel
- preview de split em tempo real
- confirmacao antes de salvar mudanca sensivel
- botoes de mostrar/ocultar e copiar para campos sensiveis
- atualizacao visual apos criar subconta
- criacao de subconta atualizando a tela com `walletId` e status
- sugestao de split quando provider = Asaas, sem save automatico

## Rollout seguro

### Fase 1

Hardening no backend:

- regras operacionais
- validacoes
- campos derivados do DTO
- testes backend

### Fase 2

Refinamento do painel:

- cards e hierarquia visual
- badges/status
- modo avancado
- preview de split
- resumo operacional
- testes frontend

### Fase 3

Validacao final:

- testes backend/frontend
- build
- smoke manual no painel admin nivel 0

## Riscos e mitigacoes

### Risco

Validacao nova no backend pode bloquear fluxos operacionais hoje tolerados.

### Mitigacao

- manter edicao manual possivel
- bloquear apenas estados comprovadamente inseguros
- usar mensagens operacionais claras para orientar o admin

### Risco

O painel pode ficar pesado se toda a UX nova continuar em um unico arquivo.

### Mitigacao

- extrair apenas subcomponentes pequenos e focados

### Risco

Estados de integracao mais sofisticados como `invalid_credentials` podem depender de verificacao real nao disponivel no MVP.

### Mitigacao

- tratar esses estados como derivados opcionais
- manter compatibilidade com `missing_api_key`, `missing_webhook_auth_token` e `configured`
