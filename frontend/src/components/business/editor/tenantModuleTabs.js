export const TENANT_MODULE_LABELS = Object.freeze({
  catalog: 'Catalogo',
  stock: 'Estoque',
  appointments: 'Agendamentos',
  cart: 'Carrinho',
  orders: 'Pedidos',
  loyalty: 'Fidelidade',
  whatsapp: 'WhatsApp',
  analytics: 'Analytics',
});

export function isTenantModuleTabVisible(tabId, modules = {}) {
  if (tabId === 'segment') {
    return true;
  }

  if (tabId === 'catalog' || tabId === 'stock') {
    return Boolean(modules.catalog);
  }

  if (tabId === 'orders') {
    return Boolean(modules.orders || modules.cart);
  }

  if (tabId === 'appointments' || tabId === 'professionals' || tabId === 'services') {
    return Boolean(modules.appointments);
  }

  if (tabId === 'analytics') {
    return Boolean(modules.analytics);
  }

  return false;
}

export function resolveTenantModuleTabs({
  mode = 'admin',
  modules = {},
  permissions = {},
} = {}) {
  const isClientMode = mode === 'client';

  return [
    { id: 'segment', label: 'Segmento e modulos', visible: mode === 'admin' },
    { id: 'catalog', label: 'Catalogo', visible: permissions.canViewCatalog ?? true },
    { id: 'stock', label: 'Estoque', visible: isClientMode && (permissions.canViewCatalog ?? true) },
    { id: 'orders', label: 'Pedidos', visible: permissions.canViewOrders ?? true },
    { id: 'appointments', label: 'Agendamentos', visible: permissions.canViewAppointments ?? true },
    { id: 'professionals', label: 'Profissionais', visible: permissions.canViewProfessionals ?? true },
    { id: 'services', label: 'Servicos', visible: permissions.canViewServices ?? true },
  ].filter((tab) => tab.visible && isTenantModuleTabVisible(tab.id, modules));
}
