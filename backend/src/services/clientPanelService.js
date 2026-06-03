import {
  canEditCatalog,
  canEditProfessionals,
  canEditServices,
  canEditTenantBasics,
  canManageAppointments,
  canManageOrders,
  canUploadMedia,
  canViewAnalytics,
  canViewAppointments,
  canViewCatalog,
  canViewOrders,
  canViewProfessionals,
  canViewServices,
  normalizeRoleLevel,
  resolveAnalyticsScope,
} from '../../../shared/utils/access.js';
import { normalizeBusinessContact } from '../../../shared/utils/businessContact.js';
import { ROLE_LEVELS } from '../../../shared/constants/access.js';
import { getBusinessAnalyticsSummary } from '../repositories/adminRepository.js';
import { uploadAdminImage } from './adminUploadService.js';
import { getAdminBusinessEditor, updateAdminBusiness } from './adminBusinessService.js';
import {
  createTenantAppointmentService,
  createTenantProduct,
  createTenantProfessional,
  deleteTenantAppointmentService,
  deleteTenantProduct,
  deleteTenantProfessional,
  listTenantAppointmentRequests,
  listTenantAppointmentServices,
  listTenantOrders,
  listTenantProducts,
  listTenantProfessionals,
  archiveTenantOrder,
  updateTenantAppointmentRequestStatus,
  updateTenantAppointmentService,
  updateTenantOrderPaymentStatus,
  updateTenantOrderStatus,
  updateTenantProduct,
  updateTenantProfessional,
} from './moduleService.js';
import { buildSessionSnapshot } from './sessionAuthService.js';
import { assertBillingAllowsCriticalMutation, assertBillingAllowsPanelAccess } from '../utils/sessionAccess.js';
import { AppError } from '../utils/appError.js';
import { isAllowedClientPanelUploadAssetType, normalizeUploadAssetType } from '../utils/uploadPolicy.js';
import {
  buildDailyTimeline,
  buildEventTypeBreakdown,
  buildTopTargetBreakdown,
  buildUserAgentBreakdowns,
  calculateActionRate,
  humanizeAnalyticsToken,
} from '../utils/adminAnalytics.js';

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === '[object Object]';
}

function mergeDefinedPatch(baseValue, patchValue) {
  if (patchValue === undefined) {
    return baseValue;
  }

  if (Array.isArray(patchValue)) {
    return patchValue;
  }

  if (!isPlainObject(patchValue)) {
    return patchValue;
  }

  const nextValue = isPlainObject(baseValue) ? { ...baseValue } : {};

  Object.entries(patchValue).forEach(([key, value]) => {
    nextValue[key] = mergeDefinedPatch(nextValue[key], value);
  });

  return nextValue;
}

function buildAccessContextFromSession(session) {
  return {
    businessId: session.business?.id || session.access?.businessId || '',
    billingStatus: session.subscription?.rawStatus || session.subscription?.status || 'active',
    planCode: session.subscription?.plan?.code || 'free',
    modules: session.business?.modules || {},
    business: session.business,
    userBusinessId: session.user?.businessId || '',
  };
}

async function resolveClientPanelContext(sessionUser) {
  const roleLevel = normalizeRoleLevel(sessionUser);

  if (roleLevel <= ROLE_LEVELS.INTERNAL_ADMIN) {
    throw new AppError('Este painel e reservado para clientes vinculados a um tenant.', 403, 'panel_client_only');
  }

  const session = await buildSessionSnapshot(sessionUser);
  const accessContext = buildAccessContextFromSession(session);

  if (!accessContext.businessId) {
    throw new AppError('Este usuario ainda nao esta vinculado a um tenant.', 403, 'panel_business_missing');
  }

  return {
    session,
    accessContext,
    businessId: accessContext.businessId,
  };
}

function assertCapability(allowed, message, code) {
  if (!allowed) {
    throw new AppError(message, 403, code);
  }
}

function buildAnalyticsPayload(analyticsSummary, scope) {
  const totalEvents = analyticsSummary.totals?.totalEvents || 0;
  const pageViews = analyticsSummary.totals?.pageViews || 0;
  const interactions =
    (analyticsSummary.totals?.linkClicks || 0) +
    (analyticsSummary.totals?.ctaClicks || 0) +
    (analyticsSummary.totals?.copyActions || 0) +
    (analyticsSummary.totals?.qrViews || 0);
  const basePayload = {
    scope,
    baselineAt: analyticsSummary.baselineAt ? new Date(analyticsSummary.baselineAt).toISOString() : null,
    totals: analyticsSummary.totals || {},
    metrics: {
      totalEvents,
      pageViews,
      interactions,
      actionRate: calculateActionRate(pageViews, interactions),
    },
  };

  if (scope === 'summary') {
    return basePayload;
  }

  const byEventType = buildEventTypeBreakdown(analyticsSummary.byEventType || [], totalEvents).map((item) => ({
    eventType: item.eventType,
    label: item.label,
    count: item.count,
    share: item.share,
  }));
  const totalTargetEvents = (analyticsSummary.topTargets || []).reduce(
    (sum, row) => sum + Number(row?.count || 0),
    0,
  );
  const topTargets = [
    ...buildTopTargetBreakdown(analyticsSummary.topTargets || [], { limit: 6 }),
    ...buildTopTargetBreakdown(analyticsSummary.topTargets || [], {
      limit: 6,
      shortcutsOnly: true,
    }),
  ]
    .sort((first, second) => second.count - first.count || first.label.localeCompare(second.label, 'pt-BR'))
    .slice(0, 6)
    .map((item) => ({
      ...item,
      targetTypeLabel: humanizeAnalyticsToken(item.targetType),
      share: totalTargetEvents ? Number(((Number(item.count || 0) / totalTargetEvents) * 100).toFixed(1)) : 0,
    }));
  const timeline = buildDailyTimeline(analyticsSummary.dailyEvents || [], 7);

  if (scope === 'basic') {
    return {
      ...basePayload,
      byEventType,
      dailyEvents: analyticsSummary.dailyEvents || [],
      timeline,
      topTargets,
    };
  }

  return {
    ...basePayload,
    byEventType,
    dailyEvents: analyticsSummary.dailyEvents || [],
    timeline,
    topTargets,
    uniqueVisitors: analyticsSummary.uniqueVisitors || 0,
    ...buildUserAgentBreakdowns(analyticsSummary.userAgents || [], totalEvents),
    recentEvents: (analyticsSummary.recentEvents || []).map((event) => ({
      id: String(event._id || ''),
      eventType: event.eventType || '',
      eventTypeLabel: humanizeAnalyticsToken(event.eventType),
      sectionType: event.sectionType || '',
      targetType: event.targetType || '',
      targetTypeLabel: humanizeAnalyticsToken(event.targetType),
      targetLabel: event.targetLabel || '',
      displayLabel:
        String(event.targetLabel || '').trim() ||
        humanizeAnalyticsToken(event.targetType) ||
        humanizeAnalyticsToken(event.eventType) ||
        'Evento',
      occurredAt: event.occurredAt || null,
    })),
  };
}

function sanitizeClientContactForPanel(contact = {}) {
  const normalizedContact = normalizeBusinessContact(contact);

  return {
    whatsapp: normalizedContact.whatsapp,
    phone: normalizedContact.phone,
    email: normalizedContact.email,
    wifi: normalizedContact.wifi,
  };
}

function sanitizeClientBusinessForPanel(editorBusiness = {}, sessionUser, accessContext) {
  const canEditBasics = canEditTenantBasics(sessionUser, accessContext);

  return {
    id: editorBusiness.id || '',
    name: editorBusiness.name || '',
    legalName: canEditBasics ? editorBusiness.legalName || '' : '',
    slug: editorBusiness.slug || '',
    description: canEditBasics ? editorBusiness.description || '' : '',
    logoUrl: canEditBasics ? editorBusiness.logoUrl || '' : '',
    logoPublicId: canEditBasics ? editorBusiness.logoPublicId || '' : '',
    bannerUrl: canEditBasics ? editorBusiness.bannerUrl || '' : '',
    bannerPublicId: canEditBasics ? editorBusiness.bannerPublicId || '' : '',
    badge: canEditBasics ? editorBusiness.badge || '' : '',
    status: editorBusiness.status || 'active',
    publicUrl: editorBusiness.publicUrl || '',
    rating: canEditBasics ? editorBusiness.rating || '' : '',
    segment: editorBusiness.segment || 'other',
    modules: editorBusiness.modules || {},
    segmentConfig: editorBusiness.segmentConfig || {},
    domains: {
      subdomain: '',
      customDomain: '',
    },
    address: canEditBasics
      ? {
          display: editorBusiness.address?.display || '',
          mapUrl: editorBusiness.address?.mapUrl || '',
          embedUrl: editorBusiness.address?.embedUrl || '',
        }
      : {},
    hours: canEditBasics ? (editorBusiness.hours || []) : [],
    contact: canEditBasics ? sanitizeClientContactForPanel(editorBusiness.contact) : {},
    paymentSettings: canEditBasics ? editorBusiness.paymentSettings || {} : {},
    seo: canEditBasics
      ? {
          title: editorBusiness.seo?.title || '',
          description: editorBusiness.seo?.description || '',
          imageUrl: editorBusiness.seo?.imageUrl || '',
        }
      : {},
  };
}

function sanitizeClientModulesData(editor = {}, sessionUser, accessContext) {
  const modulesData = editor.modulesData || {};

  return {
    professionals: canViewProfessionals(sessionUser, accessContext) ? modulesData.professionals || [] : [],
    appointmentServices: canViewServices(sessionUser, accessContext) ? modulesData.appointmentServices || [] : [],
    appointmentRequests: canViewAppointments(sessionUser, accessContext) ? modulesData.appointmentRequests || [] : [],
    products: canViewCatalog(sessionUser, accessContext) ? modulesData.products || [] : [],
    orders: canViewOrders(sessionUser, accessContext) ? modulesData.orders || [] : [],
  };
}

function buildClientPanelEditor(editor, sessionUser, accessContext) {
  return {
    business: sanitizeClientBusinessForPanel(editor.business || {}, sessionUser, accessContext),
    theme: {},
    links: [],
    sections: [],
    modulesData: sanitizeClientModulesData(editor, sessionUser, accessContext),
  };
}

function resolveClientPanelUploadOptions(context, options = {}) {
  const editorBusiness = context.session?.business || {};
  const assetType = normalizeUploadAssetType(options.assetType);

  if (!isAllowedClientPanelUploadAssetType(assetType)) {
    throw new AppError('Tipo de upload nao permitido neste painel.', 400, 'panel_upload_asset_type_invalid');
  }

  return {
    tenantSlug: editorBusiness.slug || context.businessId,
    assetType,
  };
}

export async function getClientPanelBusiness(sessionUser) {
  const context = await resolveClientPanelContext(sessionUser);
  assertBillingAllowsPanelAccess(sessionUser, context.accessContext);
  const editor = await getAdminBusinessEditor(context.businessId);
  return buildClientPanelEditor(editor, sessionUser, context.accessContext);
}

export async function updateClientPanelBusinessBasics(sessionUser, payload) {
  const context = await resolveClientPanelContext(sessionUser);
  assertBillingAllowsCriticalMutation(sessionUser, context.accessContext);
  assertCapability(
    canEditTenantBasics(sessionUser, context.accessContext),
    'Voce nao pode editar os dados basicos deste tenant.',
    'panel_business_basics_forbidden',
  );

  const currentEditor = await getAdminBusinessEditor(context.businessId);
  const nextEditor = {
    ...currentEditor,
    business: mergeDefinedPatch(currentEditor.business || {}, payload.business || {}),
  };

  return updateAdminBusiness(context.businessId, nextEditor);
}

export async function uploadClientPanelImage(sessionUser, file, options = {}) {
  const context = await resolveClientPanelContext(sessionUser);
  assertBillingAllowsCriticalMutation(sessionUser, context.accessContext);
  assertCapability(
    canUploadMedia(sessionUser, context.accessContext),
    'Seu acesso atual nao permite novos uploads.',
    'panel_upload_forbidden',
  );

  return uploadAdminImage(file, resolveClientPanelUploadOptions(context, options));
}

export async function listClientPanelProducts(sessionUser) {
  const context = await resolveClientPanelContext(sessionUser);
  assertBillingAllowsPanelAccess(sessionUser, context.accessContext);
  assertCapability(
    canViewCatalog(sessionUser, context.accessContext),
    'Voce nao pode visualizar o catalogo deste tenant.',
    'panel_products_forbidden',
  );

  return listTenantProducts(context.businessId);
}

export async function createClientPanelProduct(sessionUser, payload) {
  const context = await resolveClientPanelContext(sessionUser);
  assertBillingAllowsCriticalMutation(sessionUser, context.accessContext);
  assertCapability(
    canEditCatalog(sessionUser, context.accessContext),
    'Voce nao pode editar o catalogo deste tenant.',
    'panel_products_forbidden',
  );

  return createTenantProduct(context.businessId, payload);
}

export async function updateClientPanelProduct(sessionUser, productId, payload) {
  const context = await resolveClientPanelContext(sessionUser);
  assertBillingAllowsCriticalMutation(sessionUser, context.accessContext);
  assertCapability(
    canEditCatalog(sessionUser, context.accessContext),
    'Voce nao pode editar o catalogo deste tenant.',
    'panel_products_forbidden',
  );

  return updateTenantProduct(context.businessId, productId, payload);
}

export async function deleteClientPanelProduct(sessionUser, productId) {
  const context = await resolveClientPanelContext(sessionUser);
  assertBillingAllowsCriticalMutation(sessionUser, context.accessContext);
  assertCapability(
    canEditCatalog(sessionUser, context.accessContext),
    'Voce nao pode editar o catalogo deste tenant.',
    'panel_products_forbidden',
  );

  return deleteTenantProduct(context.businessId, productId);
}

export async function listClientPanelProfessionals(sessionUser) {
  const context = await resolveClientPanelContext(sessionUser);
  assertBillingAllowsPanelAccess(sessionUser, context.accessContext);
  assertCapability(
    canViewProfessionals(sessionUser, context.accessContext),
    'Voce nao pode visualizar os profissionais deste tenant.',
    'panel_professionals_forbidden',
  );

  return listTenantProfessionals(context.businessId);
}

export async function createClientPanelProfessional(sessionUser, payload) {
  const context = await resolveClientPanelContext(sessionUser);
  assertBillingAllowsCriticalMutation(sessionUser, context.accessContext);
  assertCapability(
    canEditProfessionals(sessionUser, context.accessContext),
    'Voce nao pode editar os profissionais deste tenant.',
    'panel_professionals_forbidden',
  );

  return createTenantProfessional(context.businessId, payload);
}

export async function updateClientPanelProfessional(sessionUser, professionalId, payload) {
  const context = await resolveClientPanelContext(sessionUser);
  assertBillingAllowsCriticalMutation(sessionUser, context.accessContext);
  assertCapability(
    canEditProfessionals(sessionUser, context.accessContext),
    'Voce nao pode editar os profissionais deste tenant.',
    'panel_professionals_forbidden',
  );

  return updateTenantProfessional(context.businessId, professionalId, payload);
}

export async function deleteClientPanelProfessional(sessionUser, professionalId) {
  const context = await resolveClientPanelContext(sessionUser);
  assertBillingAllowsCriticalMutation(sessionUser, context.accessContext);
  assertCapability(
    canEditProfessionals(sessionUser, context.accessContext),
    'Voce nao pode editar os profissionais deste tenant.',
    'panel_professionals_forbidden',
  );

  return deleteTenantProfessional(context.businessId, professionalId);
}

export async function listClientPanelAppointmentServices(sessionUser) {
  const context = await resolveClientPanelContext(sessionUser);
  assertBillingAllowsPanelAccess(sessionUser, context.accessContext);
  assertCapability(
    canViewServices(sessionUser, context.accessContext),
    'Voce nao pode visualizar os servicos deste tenant.',
    'panel_services_forbidden',
  );

  return listTenantAppointmentServices(context.businessId);
}

export async function createClientPanelAppointmentService(sessionUser, payload) {
  const context = await resolveClientPanelContext(sessionUser);
  assertBillingAllowsCriticalMutation(sessionUser, context.accessContext);
  assertCapability(
    canEditServices(sessionUser, context.accessContext),
    'Voce nao pode editar os servicos deste tenant.',
    'panel_services_forbidden',
  );

  return createTenantAppointmentService(context.businessId, payload);
}

export async function updateClientPanelAppointmentService(sessionUser, serviceId, payload) {
  const context = await resolveClientPanelContext(sessionUser);
  assertBillingAllowsCriticalMutation(sessionUser, context.accessContext);
  assertCapability(
    canEditServices(sessionUser, context.accessContext),
    'Voce nao pode editar os servicos deste tenant.',
    'panel_services_forbidden',
  );

  return updateTenantAppointmentService(context.businessId, serviceId, payload);
}

export async function deleteClientPanelAppointmentService(sessionUser, serviceId) {
  const context = await resolveClientPanelContext(sessionUser);
  assertBillingAllowsCriticalMutation(sessionUser, context.accessContext);
  assertCapability(
    canEditServices(sessionUser, context.accessContext),
    'Voce nao pode editar os servicos deste tenant.',
    'panel_services_forbidden',
  );

  return deleteTenantAppointmentService(context.businessId, serviceId);
}

export async function listClientPanelOrders(sessionUser) {
  const context = await resolveClientPanelContext(sessionUser);
  assertBillingAllowsPanelAccess(sessionUser, context.accessContext);
  assertCapability(
    canViewOrders(sessionUser, context.accessContext),
    'Voce nao pode visualizar os pedidos deste tenant.',
    'panel_orders_forbidden',
  );

  return listTenantOrders(context.businessId);
}

export async function updateClientPanelOrderStatus(sessionUser, orderId, status) {
  const context = await resolveClientPanelContext(sessionUser);
  assertBillingAllowsPanelAccess(sessionUser, context.accessContext);
  assertCapability(
    canManageOrders(sessionUser, context.accessContext),
    'Voce nao pode atualizar o status dos pedidos deste tenant.',
    'panel_orders_forbidden',
  );

  return updateTenantOrderStatus(context.businessId, orderId, status);
}

export async function updateClientPanelOrderPaymentStatus(sessionUser, orderId, status) {
  const context = await resolveClientPanelContext(sessionUser);
  assertBillingAllowsPanelAccess(sessionUser, context.accessContext);
  assertCapability(
    canManageOrders(sessionUser, context.accessContext),
    'Voce nao pode atualizar o pagamento dos pedidos deste tenant.',
    'panel_orders_forbidden',
  );

  return updateTenantOrderPaymentStatus(context.businessId, orderId, status);
}

export async function deleteClientPanelOrder(sessionUser, orderId) {
  const context = await resolveClientPanelContext(sessionUser);
  assertBillingAllowsPanelAccess(sessionUser, context.accessContext);
  assertCapability(
    canManageOrders(sessionUser, context.accessContext),
    'Voce nao pode arquivar pedidos deste tenant.',
    'panel_orders_forbidden',
  );

  return archiveTenantOrder(context.businessId, orderId);
}

export async function listClientPanelAppointmentRequests(sessionUser) {
  const context = await resolveClientPanelContext(sessionUser);
  assertBillingAllowsPanelAccess(sessionUser, context.accessContext);
  assertCapability(
    canViewAppointments(sessionUser, context.accessContext),
    'Voce nao pode visualizar os agendamentos deste tenant.',
    'panel_appointments_forbidden',
  );

  return listTenantAppointmentRequests(context.businessId);
}

export async function updateClientPanelAppointmentRequestStatus(sessionUser, requestId, status) {
  const context = await resolveClientPanelContext(sessionUser);
  assertBillingAllowsPanelAccess(sessionUser, context.accessContext);
  assertCapability(
    canManageAppointments(sessionUser, context.accessContext),
    'Voce nao pode atualizar o status dos agendamentos deste tenant.',
    'panel_appointments_forbidden',
  );

  return updateTenantAppointmentRequestStatus(context.businessId, requestId, status);
}

export async function getClientPanelAnalytics(sessionUser) {
  const context = await resolveClientPanelContext(sessionUser);
  assertBillingAllowsPanelAccess(sessionUser, context.accessContext);
  assertCapability(
    canViewAnalytics(sessionUser, context.accessContext),
    'Seu acesso atual nao permite visualizar analytics.',
    'panel_analytics_forbidden',
  );

  const scope = resolveAnalyticsScope(sessionUser, context.accessContext);
  const analyticsSummary = await getBusinessAnalyticsSummary(context.businessId);
  return buildAnalyticsPayload(analyticsSummary, scope);
}
