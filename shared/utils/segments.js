import {
  BUSINESS_MODULE_KEYS,
  BUSINESS_MODULE_KEY_VALUES,
  BUSINESS_SEGMENTS,
  BUSINESS_SEGMENT_VALUES,
} from '../constants/segments.js';

export const DEFAULT_BUSINESS_SEGMENT = BUSINESS_SEGMENTS.OTHER;

export const SEGMENT_PRESETS = {
  [BUSINESS_SEGMENTS.BARBERSHOP]: {
    label: 'Barbearia',
    description: 'Ideal para agenda, vitrine de servicos e relacionamento recorrente.',
    modules: {
      catalog: true,
      appointments: true,
      cart: false,
      orders: false,
      loyalty: true,
      whatsapp: true,
      analytics: false,
    },
    segmentConfig: {
      catalogTitle: 'Servicos e produtos',
      catalogDescription: 'Mostre cortes, combos e itens de apoio em um catalogo simples.',
      appointmentTitle: 'Solicitar agendamento',
      appointmentDescription: 'Receba pedidos de horario com profissional e servico.',
      loyaltyTitle: 'Programa de fidelidade',
      loyaltyDescription: 'A cada visita, aproxime a tag e acompanhe os beneficios com a equipe.',
    },
  },
  [BUSINESS_SEGMENTS.RESTAURANT]: {
    label: 'Restaurante / Lanchonete',
    description: 'Pensado para cardapio, carrinho, pedidos e contato rapido.',
    modules: {
      catalog: true,
      appointments: false,
      cart: true,
      orders: true,
      loyalty: false,
      whatsapp: true,
      analytics: true,
    },
    segmentConfig: {
      catalogTitle: 'Cardapio digital',
      catalogDescription: 'Apresente pratos, combos e bebidas com pedido direto.',
      appointmentTitle: 'Reservas',
      appointmentDescription: 'Modulo de reserva pode ser ativado no futuro.',
      loyaltyTitle: 'Clube do cliente',
      loyaltyDescription: 'Monte campanhas de retorno e beneficios especiais mais adiante.',
    },
  },
  [BUSINESS_SEGMENTS.CLOTHING_STORE]: {
    label: 'Loja de roupas',
    description: 'Vitrine rapida com carrinho, pedidos e apoio via WhatsApp.',
    modules: {
      catalog: true,
      appointments: false,
      cart: true,
      orders: true,
      loyalty: false,
      whatsapp: true,
      analytics: false,
    },
    segmentConfig: {
      catalogTitle: 'Colecao em destaque',
      catalogDescription: 'Organize pecas, categorias e variacoes para pedido rapido.',
      appointmentTitle: 'Atendimento guiado',
      appointmentDescription: 'Ative agendamento se quiser prova ou consultoria.',
      loyaltyTitle: 'Clube da loja',
      loyaltyDescription: 'Use beneficios e condicoes especiais para clientes recorrentes.',
    },
  },
  [BUSINESS_SEGMENTS.PHARMACY]: {
    label: 'Farmacia',
    description: 'Catalogo e solicitacoes de pedido com contato direto.',
    modules: {
      catalog: true,
      appointments: false,
      cart: false,
      orders: true,
      loyalty: false,
      whatsapp: true,
      analytics: false,
    },
    segmentConfig: {
      catalogTitle: 'Produtos em destaque',
      catalogDescription: 'Mostre categorias, itens essenciais e ofertas.',
      appointmentTitle: 'Atendimento',
      appointmentDescription: 'Agendamento nao e o foco principal deste preset.',
      loyaltyTitle: 'Beneficios da farmacia',
      loyaltyDescription: 'Ative cashback, pontos ou vantagens em etapas futuras.',
    },
  },
  [BUSINESS_SEGMENTS.BUTCHER]: {
    label: 'Acougue',
    description: 'Vitrine de cortes com pedido simples e atendimento agil.',
    modules: {
      catalog: true,
      appointments: false,
      cart: false,
      orders: true,
      loyalty: false,
      whatsapp: true,
      analytics: false,
    },
    segmentConfig: {
      catalogTitle: 'Cortes do dia',
      catalogDescription: 'Liste cortes, kits e ofertas sazonais.',
      appointmentTitle: 'Retirada programada',
      appointmentDescription: 'Agendamento pode ser usado no futuro para retirada.',
      loyaltyTitle: 'Cliente preferencial',
      loyaltyDescription: 'Use fidelidade para campanhas e recompra.',
    },
  },
  [BUSINESS_SEGMENTS.PETSHOP]: {
    label: 'Petshop',
    description: 'Combina agenda, vitrine de servicos e recorrencia com tutores.',
    modules: {
      catalog: true,
      appointments: true,
      cart: false,
      orders: false,
      loyalty: true,
      whatsapp: true,
      analytics: false,
    },
    segmentConfig: {
      catalogTitle: 'Servicos e produtos pet',
      catalogDescription: 'Mostre banho, tosa, consultas e itens para o pet.',
      appointmentTitle: 'Solicitar horario',
      appointmentDescription: 'Receba pedidos de agendamento com profissional e servico.',
      loyaltyTitle: 'Fidelidade pet',
      loyaltyDescription: 'Crie recorrencia com banhos, vacinas e retornos programados.',
    },
  },
  [BUSINESS_SEGMENTS.CLINIC]: {
    label: 'Clinica',
    description: 'Focado em contato, triagem inicial e solicitacao de agendamento.',
    modules: {
      catalog: false,
      appointments: true,
      cart: false,
      orders: false,
      loyalty: false,
      whatsapp: true,
      analytics: false,
    },
    segmentConfig: {
      catalogTitle: 'Procedimentos e servicos',
      catalogDescription: 'Ative o catalogo se quiser detalhar especialidades ou pacotes.',
      appointmentTitle: 'Solicitar atendimento',
      appointmentDescription: 'Receba pedidos de horario sem precisar de agenda complexa.',
      loyaltyTitle: 'Relacionamento',
      loyaltyDescription: 'Fidelidade pode ser usada para retornos e campanhas futuras.',
    },
  },
  [BUSINESS_SEGMENTS.REAL_ESTATE]: {
    label: 'Imobiliaria',
    description: 'Vitrine de imoveis com contato direto e leitura de interesse.',
    modules: {
      catalog: true,
      appointments: false,
      cart: false,
      orders: false,
      loyalty: false,
      whatsapp: true,
      analytics: true,
    },
    segmentConfig: {
      catalogTitle: 'Imoveis e oportunidades',
      catalogDescription: 'Use o catalogo para destacar unidades, bairros e tipos.',
      appointmentTitle: 'Visitas guiadas',
      appointmentDescription: 'Agendamento pode ser ativado para visitas no futuro.',
      loyaltyTitle: 'Relacionamento',
      loyaltyDescription: 'Mantenha interessados em uma jornada de acompanhamento.',
    },
  },
  [BUSINESS_SEGMENTS.MARKET]: {
    label: 'Mercado',
    description: 'Catalogo com carrinho, pedidos e apoio por WhatsApp.',
    modules: {
      catalog: true,
      appointments: false,
      cart: true,
      orders: true,
      loyalty: false,
      whatsapp: true,
      analytics: false,
    },
    segmentConfig: {
      catalogTitle: 'Ofertas e lista rapida',
      catalogDescription: 'Monte um catalogo enxuto para compra e retirada.',
      appointmentTitle: 'Atendimento',
      appointmentDescription: 'Agendamento nao faz parte do preset padrao.',
      loyaltyTitle: 'Cliente fiel',
      loyaltyDescription: 'Ative campanhas e beneficios de recompra no futuro.',
    },
  },
  [BUSINESS_SEGMENTS.OTHER]: {
    label: 'Outro',
    description: 'Preset generico com catalogo simples e contato por WhatsApp.',
    modules: {
      catalog: true,
      appointments: false,
      cart: false,
      orders: false,
      loyalty: false,
      whatsapp: true,
      analytics: false,
    },
    segmentConfig: {
      catalogTitle: 'Catalogo principal',
      catalogDescription: 'Mostre servicos, produtos ou destaques principais do negocio.',
      appointmentTitle: 'Solicitar atendimento',
      appointmentDescription: 'Ative agendamento caso seu fluxo precise disso.',
      loyaltyTitle: 'Fidelidade',
      loyaltyDescription: 'Use este espaco para comunicar beneficios e recorrencia.',
    },
  },
};

export function normalizeBusinessSegment(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();

  return BUSINESS_SEGMENT_VALUES.includes(normalized) ? normalized : DEFAULT_BUSINESS_SEGMENT;
}

export function getSegmentPreset(segment) {
  return SEGMENT_PRESETS[normalizeBusinessSegment(segment)] || SEGMENT_PRESETS[DEFAULT_BUSINESS_SEGMENT];
}

export function buildBusinessModules(modules, segment) {
  const presetModules = getSegmentPreset(segment).modules;
  const providedModules = modules && typeof modules === 'object' ? modules : {};

  return BUSINESS_MODULE_KEY_VALUES.reduce((accumulator, key) => {
    if (providedModules[key] === undefined) {
      accumulator[key] = Boolean(presetModules[key]);
      return accumulator;
    }

    accumulator[key] = Boolean(providedModules[key]);
    return accumulator;
  }, {});
}

export function buildBusinessSegmentConfig(segmentConfig, segment) {
  const providedConfig = segmentConfig && typeof segmentConfig === 'object' ? segmentConfig : {};
  const preset = getSegmentPreset(segment);

  return {
    ...providedConfig,
    ...(preset.segmentConfig || {}),
    label: preset.label,
    description: preset.description,
  };
}

export function buildBusinessSegmentState(input = {}) {
  const segment = normalizeBusinessSegment(input.segment);

  return {
    segment,
    modules: buildBusinessModules(input.modules, segment),
    segmentConfig: buildBusinessSegmentConfig(input.segmentConfig, segment),
  };
}
