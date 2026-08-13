import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TENANT_REALTIME_KINDS } from '@shared/constants/tenantRealtime.js';
import { cloneDeep } from '@/components/business/editor/tenantEditorUtils.js';
import {
  createClientPanelAppointmentService,
  createClientPanelProduct,
  createClientPanelProfessional,
  deleteClientPanelAppointmentService,
  deleteClientPanelOrder,
  deleteClientPanelProduct,
  deleteClientPanelProfessional,
  fetchClientPanelAnalytics,
  fetchClientPanelFinance,
  fetchClientPanelAppointmentRequests,
  fetchClientPanelAppointmentServices,
  fetchClientPanelBusiness,
  fetchClientPanelOrders,
  fetchClientPanelProducts,
  fetchClientPanelProfessionals,
  updateClientPanelAppointmentRequestStatus,
  updateClientPanelAppointmentService,
  updateClientPanelBusinessBasics,
  updateClientPanelOrderPaymentStatus,
  updateClientPanelOrderStatus,
  updateClientPanelProduct,
  updateClientPanelProfessional,
  uploadClientPanelImage,
} from '@/services/clientPanelService.js';
import { subscribeToTenantUpdates } from '@/services/tenantRealtimeService.js';

const ACCESS_REFRESH_EVENT_KINDS = new Set([
  TENANT_REALTIME_KINDS.PLAN_UPDATED,
  TENANT_REALTIME_KINDS.BILLING_UPDATED,
  TENANT_REALTIME_KINDS.CLIENT_ACCESS_UPDATED,
]);

const SUMMARY_REFRESH_EVENT_KINDS = new Set([
  TENANT_REALTIME_KINDS.TENANT_UPDATED,
  TENANT_REALTIME_KINDS.TENANT_STATUS_UPDATED,
  TENANT_REALTIME_KINDS.PRODUCT_CREATED,
  TENANT_REALTIME_KINDS.PRODUCT_UPDATED,
  TENANT_REALTIME_KINDS.PRODUCT_DELETED,
  TENANT_REALTIME_KINDS.ORDER_CREATED,
  TENANT_REALTIME_KINDS.ORDER_STATUS_UPDATED,
  TENANT_REALTIME_KINDS.PAYMENT_UPDATED,
  TENANT_REALTIME_KINDS.ORDER_PAYMENT_UPDATED,
  TENANT_REALTIME_KINDS.ORDER_ARCHIVED,
  TENANT_REALTIME_KINDS.APPOINTMENT_CREATED,
  TENANT_REALTIME_KINDS.APPOINTMENT_STATUS_UPDATED,
  TENANT_REALTIME_KINDS.PROFESSIONAL_CREATED,
  TENANT_REALTIME_KINDS.PROFESSIONAL_UPDATED,
  TENANT_REALTIME_KINDS.PROFESSIONAL_DELETED,
  TENANT_REALTIME_KINDS.APPOINTMENT_SERVICE_CREATED,
  TENANT_REALTIME_KINDS.APPOINTMENT_SERVICE_UPDATED,
  TENANT_REALTIME_KINDS.APPOINTMENT_SERVICE_DELETED,
]);

const FINANCE_REFRESH_EVENT_KINDS = new Set([
  TENANT_REALTIME_KINDS.ORDER_CREATED,
  TENANT_REALTIME_KINDS.ORDER_STATUS_UPDATED,
  TENANT_REALTIME_KINDS.PAYMENT_UPDATED,
  TENANT_REALTIME_KINDS.ORDER_PAYMENT_UPDATED,
  TENANT_REALTIME_KINDS.ORDER_ARCHIVED,
]);

const DOMAIN_FETCHERS = Object.freeze({
  products: fetchClientPanelProducts,
  orders: fetchClientPanelOrders,
  appointmentRequests: fetchClientPanelAppointmentRequests,
  appointmentServices: fetchClientPanelAppointmentServices,
  professionals: fetchClientPanelProfessionals,
});

const VIEW_DOMAIN_KEYS = Object.freeze({
  catalog: ['products'],
  stock: ['products'],
  orders: ['orders'],
  appointments: ['appointmentRequests'],
  professionals: ['professionals'],
  services: ['appointmentServices'],
});

const EVENT_KIND_TO_DOMAINS = Object.freeze({
  [TENANT_REALTIME_KINDS.PRODUCT_CREATED]: ['products'],
  [TENANT_REALTIME_KINDS.PRODUCT_UPDATED]: ['products'],
  [TENANT_REALTIME_KINDS.PRODUCT_DELETED]: ['products'],
  [TENANT_REALTIME_KINDS.ORDER_CREATED]: ['orders'],
  [TENANT_REALTIME_KINDS.ORDER_STATUS_UPDATED]: ['orders'],
  [TENANT_REALTIME_KINDS.PAYMENT_UPDATED]: ['orders'],
  [TENANT_REALTIME_KINDS.ORDER_PAYMENT_UPDATED]: ['orders'],
  [TENANT_REALTIME_KINDS.ORDER_ARCHIVED]: ['orders'],
  [TENANT_REALTIME_KINDS.APPOINTMENT_CREATED]: ['appointmentRequests'],
  [TENANT_REALTIME_KINDS.APPOINTMENT_STATUS_UPDATED]: ['appointmentRequests'],
  [TENANT_REALTIME_KINDS.PROFESSIONAL_CREATED]: ['professionals'],
  [TENANT_REALTIME_KINDS.PROFESSIONAL_UPDATED]: ['professionals'],
  [TENANT_REALTIME_KINDS.PROFESSIONAL_DELETED]: ['professionals'],
  [TENANT_REALTIME_KINDS.APPOINTMENT_SERVICE_CREATED]: ['appointmentServices'],
  [TENANT_REALTIME_KINDS.APPOINTMENT_SERVICE_UPDATED]: ['appointmentServices'],
  [TENANT_REALTIME_KINDS.APPOINTMENT_SERVICE_DELETED]: ['appointmentServices'],
});

function createEmptyModulesData() {
  return {
    professionals: [],
    appointmentServices: [],
    appointmentRequests: [],
    products: [],
    orders: [],
  };
}

function createInitialDomainState() {
  return {
    products: { data: [], status: 'idle', error: '' },
    orders: { data: [], status: 'idle', error: '' },
    appointmentRequests: { data: [], status: 'idle', error: '' },
    appointmentServices: { data: [], status: 'idle', error: '' },
    professionals: { data: [], status: 'idle', error: '' },
  };
}

function buildPanelModulesData(domains = {}) {
  const empty = createEmptyModulesData();

  return {
    ...empty,
    products: domains.products?.data || empty.products,
    orders: domains.orders?.data || empty.orders,
    appointmentRequests: domains.appointmentRequests?.data || empty.appointmentRequests,
    appointmentServices: domains.appointmentServices?.data || empty.appointmentServices,
    professionals: domains.professionals?.data || empty.professionals,
  };
}

function buildBasicBusinessPayload(editor) {
  return {
    business: {
      name: editor?.business?.name || '',
      legalName: editor?.business?.legalName || '',
      description: editor?.business?.description || '',
      logoUrl: editor?.business?.logoUrl || '',
      logoPublicId: editor?.business?.logoPublicId || '',
      bannerUrl: editor?.business?.bannerUrl || '',
      bannerPublicId: editor?.business?.bannerPublicId || '',
      badge: editor?.business?.badge || '',
      rating: editor?.business?.rating || '',
      address: editor?.business?.address || {},
      hours: editor?.business?.hours || [],
      contact: editor?.business?.contact || {},
      paymentSettings: editor?.business?.paymentSettings || {},
      seo: editor?.business?.seo || {},
    },
  };
}

function hasUnsavedBasicsDraft(currentDraft, currentEditor) {
  return JSON.stringify(buildBasicBusinessPayload(currentDraft || {})) !== JSON.stringify(buildBasicBusinessPayload(currentEditor || {}));
}

function mergeBasicDraftIntoEditor(nextEditor, currentDraft) {
  if (!currentDraft) {
    return cloneDeep(nextEditor);
  }

  const basicDraft = buildBasicBusinessPayload(currentDraft).business;

  return {
    ...cloneDeep(nextEditor),
    business: {
      ...(nextEditor?.business || {}),
      ...basicDraft,
      address: basicDraft.address || nextEditor?.business?.address || {},
      hours: basicDraft.hours || nextEditor?.business?.hours || [],
      contact: basicDraft.contact || nextEditor?.business?.contact || {},
      seo: basicDraft.seo || nextEditor?.business?.seo || {},
      paymentSettings: basicDraft.paymentSettings || nextEditor?.business?.paymentSettings || {},
    },
  };
}

function composeEditor(bootstrap, domains) {
  if (!bootstrap) {
    return null;
  }

  return {
    ...bootstrap,
    modulesData: buildPanelModulesData(domains),
  };
}

function getErrorMessage(error) {
  if (Array.isArray(error?.details) && error.details.length) {
    return error.details
      .filter((detail) => detail?.message)
      .map((detail) => (detail.path ? `${detail.path}: ${detail.message}` : detail.message))
      .join(' | ');
  }

  return error?.message || 'Nao foi possivel concluir esta operacao.';
}

export function useClientPanelWorkspace({
  token,
  access,
  refreshSession,
  isSuspendedClientAccess,
}) {
  const [editor, setEditor] = useState(null);
  const [draft, setDraft] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [finance, setFinance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [financeLoading, setFinanceLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState('');
  const [financeError, setFinanceError] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [moduleBusyKey, setModuleBusyKey] = useState('');
  const [domainState, setDomainState] = useState(createInitialDomainState);

  const bootstrapRef = useRef(null);
  const editorRef = useRef(null);
  const draftRef = useRef(null);
  const domainStateRef = useRef(createInitialDomainState());
  const domainInFlightRef = useRef(new Map());
  const analyticsInFlightRef = useRef(null);
  const financeInFlightRef = useRef(null);

  const updateComposedEditor = useCallback((nextBootstrap, nextDomains, options = {}) => {
    const previousEditor = editorRef.current;
    const nextEditor = composeEditor(nextBootstrap, nextDomains);
    bootstrapRef.current = nextBootstrap;
    editorRef.current = nextEditor;
    setEditor(nextEditor);
    setDraft((currentDraft) => {
      const shouldPreserveDraft = options.preserveDraft !== false && hasUnsavedBasicsDraft(currentDraft, previousEditor);
      const nextDraft = shouldPreserveDraft ? mergeBasicDraftIntoEditor(nextEditor, currentDraft) : cloneDeep(nextEditor);
      draftRef.current = nextDraft;
      return nextDraft;
    });
    return nextEditor;
  }, []);

  const loadBootstrap = useCallback(async (options = {}) => {
    if (!token) {
      return null;
    }

    const nextBootstrap = await fetchClientPanelBusiness(token, {
      includeModules: false,
      includeAnalytics: false,
      includeHistory: false,
    });

    return updateComposedEditor(nextBootstrap, domainStateRef.current, options);
  }, [token, updateComposedEditor]);

  const loadDomain = useCallback(async (domainKey, options = {}) => {
    if (!token || !DOMAIN_FETCHERS[domainKey]) {
      return [];
    }

    const currentDomain = domainStateRef.current[domainKey];

    if (!options.force && currentDomain?.status === 'ready') {
      return currentDomain.data;
    }

    if (!options.force && domainInFlightRef.current.has(domainKey)) {
      return domainInFlightRef.current.get(domainKey);
    }

    const requestPromise = DOMAIN_FETCHERS[domainKey](token)
      .then((data) => {
        const nextDomainState = {
          ...domainStateRef.current,
          [domainKey]: {
            data,
            status: 'ready',
            error: '',
          },
        };

        domainStateRef.current = nextDomainState;
        setDomainState(nextDomainState);
        updateComposedEditor(bootstrapRef.current, nextDomainState);
        return data;
      })
      .catch((domainError) => {
        const nextDomainState = {
          ...domainStateRef.current,
          [domainKey]: {
            ...domainStateRef.current[domainKey],
            status: 'error',
            error: getErrorMessage(domainError),
          },
        };

        domainStateRef.current = nextDomainState;
        setDomainState(nextDomainState);
        throw domainError;
      })
      .finally(() => {
        domainInFlightRef.current.delete(domainKey);
      });

    domainInFlightRef.current.set(domainKey, requestPromise);
    const loadingState = {
      ...domainStateRef.current,
      [domainKey]: {
        ...domainStateRef.current[domainKey],
        status: 'loading',
        error: '',
      },
    };
    domainStateRef.current = loadingState;
    setDomainState(loadingState);
    return requestPromise;
  }, [token, updateComposedEditor]);

  const ensureViewData = useCallback(async (viewId, options = {}) => {
    if (viewId === 'analytics') {
      if (!token || !access?.capabilities?.canViewAnalytics) {
        setAnalytics(null);
        return null;
      }

      if (!options.force && analytics) {
        return analytics;
      }

      if (!options.force && analyticsInFlightRef.current) {
        return analyticsInFlightRef.current;
      }

      setAnalyticsLoading(true);
      setAnalyticsError('');

      const requestPromise = fetchClientPanelAnalytics(token)
        .then((nextAnalytics) => {
          setAnalytics(nextAnalytics);
          return nextAnalytics;
        })
        .catch((analyticsLoadError) => {
          setAnalyticsError(getErrorMessage(analyticsLoadError));
          throw analyticsLoadError;
        })
        .finally(() => {
          analyticsInFlightRef.current = null;
          setAnalyticsLoading(false);
        });

      analyticsInFlightRef.current = requestPromise;
      return requestPromise;
    }

    if (viewId === 'finance') {
      if (!token || !access?.capabilities?.canViewOrders) {
        setFinance(null);
        return null;
      }

      if (!options.force && finance) {
        return finance;
      }

      if (!options.force && financeInFlightRef.current) {
        return financeInFlightRef.current;
      }

      setFinanceLoading(true);
      setFinanceError('');

      const requestPromise = fetchClientPanelFinance(token)
        .then((nextFinance) => {
          setFinance(nextFinance);
          return nextFinance;
        })
        .catch((financeLoadError) => {
          setFinanceError(getErrorMessage(financeLoadError));
          throw financeLoadError;
        })
        .finally(() => {
          financeInFlightRef.current = null;
          setFinanceLoading(false);
        });

      financeInFlightRef.current = requestPromise;
      return requestPromise;
    }

    const domainKeys = VIEW_DOMAIN_KEYS[viewId] || [];

    if (!domainKeys.length) {
      return null;
    }

    return Promise.all(domainKeys.map((domainKey) => loadDomain(domainKey, options)));
  }, [access?.capabilities?.canViewAnalytics, access?.capabilities?.canViewOrders, analytics, finance, loadDomain, token]);

  const refreshSummaryAndDomains = useCallback(async (domainKeys = []) => {
    const requests = [loadBootstrap()];

    domainKeys.forEach((domainKey) => {
      requests.push(loadDomain(domainKey, { force: true }));
    });

    await Promise.all(requests);
  }, [loadBootstrap, loadDomain]);

  const refreshAfterModuleAction = useCallback(async ({ busyKey, action, successMessage, domains = [] }) => {
    setModuleBusyKey(busyKey);
    setMessage('');
    setError('');

    try {
      await action();
      await refreshSummaryAndDomains(domains);
      if (successMessage) {
        setMessage(successMessage);
      }
    } catch (actionError) {
      setError(getErrorMessage(actionError));
      throw actionError;
    } finally {
      setModuleBusyKey('');
    }
  }, [refreshSummaryAndDomains]);

  const saveBasics = useCallback(async (nextDraft) => {
    if (!token) {
      return null;
    }

    setMessage('');
    setError('');
    const updatedEditor = await updateClientPanelBusinessBasics(token, buildBasicBusinessPayload(nextDraft));
    const nextBootstrap = {
      ...updatedEditor,
      summary: bootstrapRef.current?.summary || editorRef.current?.summary || null,
    };
    updateComposedEditor(nextBootstrap, domainStateRef.current, { preserveDraft: false });
    setMessage('Dados basicos atualizados com sucesso.');
    return nextBootstrap;
  }, [token, updateComposedEditor]);

  const handleUpload = useCallback(async (file, options = {}) => {
    setMessage('');
    setError('');

    try {
      return await uploadClientPanelImage(token, file, options);
    } catch (uploadError) {
      setError(getErrorMessage(uploadError));
      throw uploadError;
    }
  }, [token]);

  const moduleActions = useMemo(() => ({
    createProduct: (payload) =>
      refreshAfterModuleAction({
        busyKey: 'create-product',
        action: () => createClientPanelProduct(token, payload),
        successMessage: 'Produto salvo com sucesso.',
        domains: ['products'],
      }),
    updateProduct: (productId, payload) =>
      refreshAfterModuleAction({
        busyKey: 'update-product',
        action: () => updateClientPanelProduct(token, productId, payload),
        successMessage: 'Produto atualizado com sucesso.',
        domains: ['products'],
      }),
    deleteProduct: (productId) =>
      refreshAfterModuleAction({
        busyKey: 'delete-product',
        action: () => deleteClientPanelProduct(token, productId),
        successMessage: 'Produto removido com sucesso.',
        domains: ['products'],
      }),
    createProfessional: (payload) =>
      refreshAfterModuleAction({
        busyKey: 'create-professional',
        action: () => createClientPanelProfessional(token, payload),
        successMessage: 'Profissional salvo com sucesso.',
        domains: ['professionals'],
      }),
    updateProfessional: (professionalId, payload) =>
      refreshAfterModuleAction({
        busyKey: 'update-professional',
        action: () => updateClientPanelProfessional(token, professionalId, payload),
        successMessage: 'Profissional atualizado com sucesso.',
        domains: ['professionals'],
      }),
    deleteProfessional: (professionalId) =>
      refreshAfterModuleAction({
        busyKey: 'delete-professional',
        action: () => deleteClientPanelProfessional(token, professionalId),
        successMessage: 'Profissional removido com sucesso.',
        domains: ['professionals'],
      }),
    createAppointmentService: (payload) =>
      refreshAfterModuleAction({
        busyKey: 'create-appointment-service',
        action: () => createClientPanelAppointmentService(token, payload),
        successMessage: 'Servico salvo com sucesso.',
        domains: ['appointmentServices'],
      }),
    updateAppointmentService: (serviceId, payload) =>
      refreshAfterModuleAction({
        busyKey: 'update-appointment-service',
        action: () => updateClientPanelAppointmentService(token, serviceId, payload),
        successMessage: 'Servico atualizado com sucesso.',
        domains: ['appointmentServices'],
      }),
    deleteAppointmentService: (serviceId) =>
      refreshAfterModuleAction({
        busyKey: 'delete-appointment-service',
        action: () => deleteClientPanelAppointmentService(token, serviceId),
        successMessage: 'Servico removido com sucesso.',
        domains: ['appointmentServices'],
      }),
    updateOrderStatus: (orderId, status) =>
      refreshAfterModuleAction({
        busyKey: 'update-order-status',
        action: () => updateClientPanelOrderStatus(token, orderId, status),
        successMessage: 'Status do pedido atualizado com sucesso.',
        domains: ['orders'],
      }),
    updateOrderPaymentStatus: (orderId, status) =>
      refreshAfterModuleAction({
        busyKey: 'update-order-payment-status',
        action: () => updateClientPanelOrderPaymentStatus(token, orderId, status),
        successMessage: 'Status do pagamento atualizado com sucesso.',
        domains: ['orders'],
      }),
    deleteOrder: (orderId) =>
      refreshAfterModuleAction({
        busyKey: 'delete-order',
        action: () => deleteClientPanelOrder(token, orderId),
        successMessage: 'Pedido arquivado com sucesso.',
        domains: ['orders'],
      }),
    updateAppointmentRequestStatus: (requestId, status) =>
      refreshAfterModuleAction({
        busyKey: 'update-appointment-request-status',
        action: () => updateClientPanelAppointmentRequestStatus(token, requestId, status),
        successMessage: 'Status do agendamento atualizado com sucesso.',
        domains: ['appointmentRequests'],
      }),
  }), [refreshAfterModuleAction, token]);

  useEffect(() => {
    let active = true;

    async function bootstrapWorkspace() {
      if (!token || isSuspendedClientAccess) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      try {
        await loadBootstrap({ preserveDraft: false });
      } catch (loadError) {
        if (active) {
          setError(getErrorMessage(loadError));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    bootstrapWorkspace();

    return () => {
      active = false;
    };
  }, [isSuspendedClientAccess, loadBootstrap, token]);

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    if (!token || isSuspendedClientAccess || !editor?.business?.id) {
      return undefined;
    }

    let active = true;

    const unsubscribe = subscribeToTenantUpdates(
      {
        businessId: editor.business.id,
        slug: editor.business.slug,
      },
      {
        async onTenantUpdated(event = {}) {
          if (!active) {
            return;
          }

          try {
            if (ACCESS_REFRESH_EVENT_KINDS.has(event.kind) && typeof refreshSession === 'function') {
              const nextSession = await refreshSession();

              if (!active) {
                return;
              }

              if (['suspended', 'cancelled'].includes(nextSession?.access?.billingStatus || '')) {
                setAnalytics(null);
                await loadBootstrap();
                return;
              }

              await loadBootstrap();
              if (nextSession?.access?.capabilities?.canViewAnalytics && analytics) {
                await ensureViewData('analytics', { force: true });
              } else {
                setAnalytics(null);
              }
              if (nextSession?.access?.capabilities?.canViewOrders && finance) {
                await ensureViewData('finance', { force: true });
              } else {
                setFinance(null);
              }
              return;
            }

            const domains = EVENT_KIND_TO_DOMAINS[event.kind] || [];

            if (SUMMARY_REFRESH_EVENT_KINDS.has(event.kind)) {
              await loadBootstrap();
            }

            await Promise.all(
              domains
                .filter((domainKey) => domainStateRef.current[domainKey]?.status === 'ready')
                .map((domainKey) => loadDomain(domainKey, { force: true })),
            );

            if (finance && FINANCE_REFRESH_EVENT_KINDS.has(event.kind)) {
              await ensureViewData('finance', { force: true });
            }

            if (event.kind === TENANT_REALTIME_KINDS.TENANT_UPDATED) {
              setMessage('Dados do tenant sincronizados automaticamente.');
            }
          } catch (refreshError) {
            if (active) {
              setError(getErrorMessage(refreshError));
            }
          }
        },
      },
    );

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [analytics, editor?.business?.id, editor?.business?.slug, ensureViewData, finance, isSuspendedClientAccess, loadBootstrap, loadDomain, refreshSession, token]);

  return {
    editor,
    draft,
    setDraft,
    analytics,
    finance,
    loading,
    analyticsLoading,
    financeLoading,
    analyticsError,
    financeError,
    message,
    error,
    moduleBusyKey,
    domainState,
    saveBasics,
    handleUpload,
    moduleActions,
    ensureViewData,
    refreshSummaryAndDomains,
    setMessage,
    setError,
  };
}
