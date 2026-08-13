import {
  PAYMENT_STATUS,
  TENANT_LEDGER_ENTRY_STATUSES,
  TENANT_LEDGER_ENTRY_TYPES,
  TENANT_PAYOUT_STATUSES,
} from '../../../shared/constants/index.js';
import { normalizeOrderPayment } from '../../../shared/utils/businessPayment.js';
import {
  calculatePlatformFeeBreakdown,
  FINANCE_REFUND_FEE_POLICIES,
  getPlatformFinanceSettings,
  getStoredFinanceSettings,
  resolveEffectivePlatformFeePercent,
} from './platformFinanceService.js';
import { fromMoneyCents, toMoneyCents } from '../../../shared/utils/money.js';
import { listOrdersByBusinessId } from '../repositories/orderRepository.js';
import {
  findPaymentByBusinessIdAndOrderId,
  listPaymentsByBusinessId,
} from '../repositories/paymentRepository.js';
import {
  findTenantLedgerEntriesByPaymentId,
  listTenantLedgerEntriesByBusinessId,
  upsertTenantLedgerEntryByIdempotencyKey,
} from '../repositories/tenantLedgerRepository.js';
import { listTenantPayoutsByBusinessId } from '../repositories/tenantPayoutRepository.js';

const LEDGER_TYPE_LABELS = Object.freeze({
  [TENANT_LEDGER_ENTRY_TYPES.SALE_GROSS]: 'Venda recebida',
  [TENANT_LEDGER_ENTRY_TYPES.PLATFORM_FEE]: 'Taxa TapLink',
  [TENANT_LEDGER_ENTRY_TYPES.REFUND]: 'Estorno',
  [TENANT_LEDGER_ENTRY_TYPES.ADJUSTMENT]: 'Ajuste',
  [TENANT_LEDGER_ENTRY_TYPES.PAYOUT]: 'Repasse',
  [TENANT_LEDGER_ENTRY_TYPES.PAYOUT_REVERSAL]: 'Reversao de repasse',
});

function buildLedgerIdempotencyKey(paymentId, suffix) {
  return `payment:${String(paymentId || '').trim()}:${String(suffix || '').trim()}`;
}

function resolvePaymentReceivedAt(payment = {}) {
  return (
    payment.receivedAt ||
    payment.confirmedAt ||
    payment.paidAt ||
    payment.providerUpdatedAt ||
    payment.updatedAt ||
    payment.createdAt ||
    new Date()
  );
}

function buildLedgerDescription(type, payment = {}) {
  if (type === TENANT_LEDGER_ENTRY_TYPES.SALE_GROSS) {
    return `Venda recebida do pedido ${String(payment.orderId || '').trim() || '-'}`;
  }

  if (type === TENANT_LEDGER_ENTRY_TYPES.PLATFORM_FEE) {
    return 'Taxa da plataforma TapLink aplicada sobre a venda recebida.';
  }

  if (type === TENANT_LEDGER_ENTRY_TYPES.REFUND) {
    return 'Estorno financeiro compensatorio gerado pelo provedor.';
  }

  return LEDGER_TYPE_LABELS[type] || 'Movimentacao financeira';
}

export async function syncTenantLedgerForPayment(
  payment,
  { businessPaymentSettings = {}, financeSettings = null, providerEvent = '', occurredAt = new Date() } = {},
) {
  if (!payment?._id || !payment?.businessId) {
    return [];
  }

  const normalizedFinanceSettings = financeSettings
    ? getStoredFinanceSettings(financeSettings)
    : await getPlatformFinanceSettings();
  const effectiveFeePercent = resolveEffectivePlatformFeePercent(
    businessPaymentSettings,
    normalizedFinanceSettings,
  );
  const entries = [];
  const receivedAt = resolvePaymentReceivedAt(payment) || occurredAt;
  const breakdown = calculatePlatformFeeBreakdown(
    payment.grossAmount ?? payment.amount,
    effectiveFeePercent,
  );

  if (payment.status === PAYMENT_STATUS.PAID) {
    entries.push(
      await upsertTenantLedgerEntryByIdempotencyKey(
        buildLedgerIdempotencyKey(payment._id, 'sale'),
        {
          businessId: payment.businessId,
          paymentId: payment._id,
          orderId: payment.orderId || null,
          type: TENANT_LEDGER_ENTRY_TYPES.SALE_GROSS,
          status: TENANT_LEDGER_ENTRY_STATUSES.AVAILABLE,
          amount: breakdown.grossAmount,
          description: buildLedgerDescription(TENANT_LEDGER_ENTRY_TYPES.SALE_GROSS, payment),
          availableAt: receivedAt,
          metadata: {
            provider: payment.provider,
            providerPaymentId: payment.providerPaymentId || '',
            providerEvent: String(providerEvent || '').trim(),
            paymentArchitecture: payment.paymentArchitecture || normalizedFinanceSettings.paymentArchitecture,
          },
        },
      ),
    );

    if (breakdown.platformFeeAmount > 0) {
      entries.push(
        await upsertTenantLedgerEntryByIdempotencyKey(
          buildLedgerIdempotencyKey(payment._id, 'platform_fee'),
          {
            businessId: payment.businessId,
            paymentId: payment._id,
            orderId: payment.orderId || null,
            type: TENANT_LEDGER_ENTRY_TYPES.PLATFORM_FEE,
            status: TENANT_LEDGER_ENTRY_STATUSES.AVAILABLE,
            amount: -breakdown.platformFeeAmount,
            description: buildLedgerDescription(TENANT_LEDGER_ENTRY_TYPES.PLATFORM_FEE, payment),
            availableAt: receivedAt,
            metadata: {
              provider: payment.provider,
              providerPaymentId: payment.providerPaymentId || '',
              providerEvent: String(providerEvent || '').trim(),
              platformFeePercent: breakdown.platformFeePercent,
              paymentArchitecture: payment.paymentArchitecture || normalizedFinanceSettings.paymentArchitecture,
            },
          },
        ),
      );
    }
  }

  const refundedAmountCents = Math.max(0, toMoneyCents(payment.refundedAmount || 0));

  if (refundedAmountCents > 0) {
    const existingRefundEntries = await findTenantLedgerEntriesByPaymentId(payment._id);
    const existingRefundCents = existingRefundEntries
      .filter((entry) => entry.type === TENANT_LEDGER_ENTRY_TYPES.REFUND)
      .reduce((sum, entry) => sum + Math.abs(toMoneyCents(entry.amount)), 0);
    const deltaRefundCents = Math.max(0, refundedAmountCents - existingRefundCents);

    if (deltaRefundCents > 0) {
      const refundAmount = fromMoneyCents(deltaRefundCents);
      entries.push(
        await upsertTenantLedgerEntryByIdempotencyKey(
          buildLedgerIdempotencyKey(payment._id, `refund:${refundedAmountCents}`),
          {
            businessId: payment.businessId,
            paymentId: payment._id,
            orderId: payment.orderId || null,
            type: TENANT_LEDGER_ENTRY_TYPES.REFUND,
            status: TENANT_LEDGER_ENTRY_STATUSES.REVERSED,
            amount: -refundAmount,
            description: buildLedgerDescription(TENANT_LEDGER_ENTRY_TYPES.REFUND, payment),
            availableAt: occurredAt,
            metadata: {
              provider: payment.provider,
              providerPaymentId: payment.providerPaymentId || '',
              providerEvent: String(providerEvent || '').trim(),
              refundedAmount: refundAmount,
              refundFeePolicy: normalizedFinanceSettings.refundFeePolicy,
              paymentArchitecture: payment.paymentArchitecture || normalizedFinanceSettings.paymentArchitecture,
            },
          },
        ),
      );

      if (
        normalizedFinanceSettings.refundFeePolicy ===
        FINANCE_REFUND_FEE_POLICIES.REVERSE_PLATFORM_FEE
      ) {
        const proportionalFeeCents = Math.round(
          (toMoneyCents(breakdown.platformFeeAmount) * deltaRefundCents) /
            Math.max(1, toMoneyCents(breakdown.grossAmount)),
        );

        if (proportionalFeeCents > 0) {
          entries.push(
            await upsertTenantLedgerEntryByIdempotencyKey(
              buildLedgerIdempotencyKey(
                payment._id,
                `platform_fee_refund:${refundedAmountCents}`,
              ),
              {
                businessId: payment.businessId,
                paymentId: payment._id,
                orderId: payment.orderId || null,
                type: TENANT_LEDGER_ENTRY_TYPES.ADJUSTMENT,
                status: TENANT_LEDGER_ENTRY_STATUSES.REVERSED,
                amount: fromMoneyCents(proportionalFeeCents),
                description: 'Reversao proporcional da taxa TapLink devido ao estorno.',
                availableAt: occurredAt,
                metadata: {
                  provider: payment.provider,
                  providerPaymentId: payment.providerPaymentId || '',
                  providerEvent: String(providerEvent || '').trim(),
                  adjustmentKind: 'platform_fee_refund_reversal',
                  paymentArchitecture: payment.paymentArchitecture || normalizedFinanceSettings.paymentArchitecture,
                },
              },
            ),
          );
        }
      }
    }
  }

  return entries.filter(Boolean);
}

function buildLedgerTotals(entries = []) {
  return entries.reduce(
    (accumulator, entry) => {
      const amount = Number(entry.amount || 0);

      if (entry.type === TENANT_LEDGER_ENTRY_TYPES.SALE_GROSS) {
        accumulator.totalReceived += amount;
      }

      if (entry.type === TENANT_LEDGER_ENTRY_TYPES.PLATFORM_FEE) {
        accumulator.platformFees += Math.abs(amount);
      }

      if (entry.type === TENANT_LEDGER_ENTRY_TYPES.REFUND) {
        accumulator.refunds += Math.abs(amount);
      }

      if (entry.type === TENANT_LEDGER_ENTRY_TYPES.PAYOUT) {
        accumulator.totalPaidOut += Math.abs(amount);
      }

      if (entry.status === TENANT_LEDGER_ENTRY_STATUSES.PENDING) {
        accumulator.pendingBalance += amount;
      }

      if (entry.status === TENANT_LEDGER_ENTRY_STATUSES.AVAILABLE) {
        accumulator.availableBalance += amount;
      }

      if (
        [
          TENANT_LEDGER_ENTRY_STATUSES.AVAILABLE,
          TENANT_LEDGER_ENTRY_STATUSES.PAID_OUT,
          TENANT_LEDGER_ENTRY_STATUSES.REVERSED,
        ].includes(entry.status)
      ) {
        accumulator.settledNet += amount;
      }

      return accumulator;
    },
    {
      pendingBalance: 0,
      availableBalance: 0,
      totalReceived: 0,
      platformFees: 0,
      totalPaidOut: 0,
      refunds: 0,
      settledNet: 0,
    },
  );
}

function buildLedgerHistoryRows({ entries = [], paymentsById = new Map() }) {
  return entries.map((entry) => {
    const payment = paymentsById.get(String(entry.paymentId || '')) || null;
    const grossAmount = Number(payment?.grossAmount ?? payment?.amount ?? 0);
    const platformFeeAmount = Number(payment?.platformFeeAmount || 0);
    const resolvedNetAmount =
      payment?.tenantNetAmount != null ? payment.tenantNetAmount : grossAmount - platformFeeAmount;
    const netAmount = Number(resolvedNetAmount || 0);

    return {
      id: String(entry._id || ''),
      paymentId: entry.paymentId ? String(entry.paymentId) : '',
      orderId: entry.orderId ? String(entry.orderId) : '',
      type: entry.type,
      typeLabel: LEDGER_TYPE_LABELS[entry.type] || 'Movimentacao',
      status: entry.status,
      amount: Number(Number(entry.amount || 0).toFixed(2)),
      grossAmount: Number(grossAmount.toFixed(2)),
      platformFeeAmount: Number(platformFeeAmount.toFixed(2)),
      netAmount: Number(netAmount.toFixed(2)),
      description: entry.description || '',
      providerPaymentId: payment?.providerPaymentId || '',
      createdAt: entry.createdAt || null,
      availableAt: entry.availableAt || null,
    };
  });
}

export async function getTenantFinanceOverview(businessId, options = {}) {
  const [ledgerEntries, payouts, payments, orders] = await Promise.all([
    listTenantLedgerEntriesByBusinessId(businessId, { limit: options.ledgerLimit || 100 }),
    listTenantPayoutsByBusinessId(businessId, { limit: 10 }),
    listPaymentsByBusinessId(businessId, { limit: options.paymentLimit || 100 }),
    listOrdersByBusinessId(businessId, { includeArchived: false, limit: 100 }),
  ]);

  const normalizedPayments = payments.map((payment) =>
    normalizeOrderPayment(
      {
        ...payment.toObject?.(),
        grossAmount: payment.grossAmount ?? payment.amount,
        refundedAmount: payment.refundedAmount || 0,
        paymentArchitecture: payment.paymentArchitecture,
        providerUpdatedAt: payment.providerUpdatedAt,
      },
      payment.amount || 0,
    ),
  );
  const paymentsById = new Map(
    payments.map((payment, index) => [
      String(payment._id || ''),
      {
        ...normalizedPayments[index],
        id: String(payment._id || ''),
      },
    ]),
  );
  const ordersById = new Map(
    orders.map((order) => [
      String(order._id || ''),
      {
        id: String(order._id || ''),
        customerName: order.customerName || '',
      },
    ]),
  );
  const ledgerTotals = buildLedgerTotals(ledgerEntries);
  const pendingFromPayments = payments
    .filter((payment) => payment.status === PAYMENT_STATUS.PENDING)
    .reduce((sum, payment) => sum + Number(payment.grossAmount ?? payment.amount ?? 0), 0);
  const lastPayout = payouts.find(
    (payout) => payout.status === TENANT_PAYOUT_STATUSES.PAID || payout.status === TENANT_PAYOUT_STATUSES.PROCESSING,
  );
  const nextPayout = payouts.find(
    (payout) => payout.status === TENANT_PAYOUT_STATUSES.PENDING || payout.status === TENANT_PAYOUT_STATUSES.APPROVED,
  );

  return {
    summary: {
      pendingBalance: Number(pendingFromPayments.toFixed(2)),
      availableBalance: Number(ledgerTotals.availableBalance.toFixed(2)),
      totalReceived: Number(ledgerTotals.totalReceived.toFixed(2)),
      platformFees: Number(ledgerTotals.platformFees.toFixed(2)),
      totalPaidOut: Number(ledgerTotals.totalPaidOut.toFixed(2)),
      refunds: Number(ledgerTotals.refunds.toFixed(2)),
      balanceDue: Number((ledgerTotals.availableBalance - ledgerTotals.totalPaidOut).toFixed(2)),
      settledNet: Number(ledgerTotals.settledNet.toFixed(2)),
    },
    payout: {
      next:
        nextPayout && nextPayout.status !== TENANT_PAYOUT_STATUSES.PAID
          ? {
              id: String(nextPayout._id || ''),
              amount: Number(Number(nextPayout.amount || 0).toFixed(2)),
              status: nextPayout.status,
              requestedAt: nextPayout.requestedAt || nextPayout.createdAt || null,
              reference: nextPayout.reference || '',
            }
          : null,
      last: lastPayout
        ? {
            id: String(lastPayout._id || ''),
            amount: Number(Number(lastPayout.amount || 0).toFixed(2)),
            status: lastPayout.status,
            processedAt: lastPayout.processedAt || lastPayout.updatedAt || null,
            reference: lastPayout.reference || '',
          }
        : null,
    },
    history: buildLedgerHistoryRows({ entries: ledgerEntries, paymentsById }).map((row) => ({
      ...row,
      orderCustomerName: ordersById.get(row.orderId)?.customerName || '',
    })),
    ledgerEntries: ledgerEntries.map((entry) => ({
      id: String(entry._id || ''),
      businessId: String(entry.businessId || ''),
      paymentId: entry.paymentId ? String(entry.paymentId) : '',
      orderId: entry.orderId ? String(entry.orderId) : '',
      type: entry.type,
      status: entry.status,
      amount: Number(Number(entry.amount || 0).toFixed(2)),
      description: entry.description || '',
      createdAt: entry.createdAt || null,
      availableAt: entry.availableAt || null,
      metadata: entry.metadata || {},
    })),
  };
}

export async function reconcileTenantFinancialState({
  businessId = '',
  order = null,
  payment = null,
} = {}) {
  const financeSettings = await getPlatformFinanceSettings();
  const resolvedPayment =
    payment || (order?._id && businessId ? await findPaymentByBusinessIdAndOrderId(businessId, order._id) : null);
  const issues = [];

  if (order && resolvedPayment) {
    const orderPayment = normalizeOrderPayment(order.payment || {}, order.total || 0);

    if (String(orderPayment.providerPaymentId || '') !== String(resolvedPayment.providerPaymentId || '')) {
      issues.push('payment_provider_payment_id_mismatch');
    }

    if (String(orderPayment.status || '') !== String(resolvedPayment.status || '')) {
      issues.push('payment_status_mismatch');
    }

    if (Number(orderPayment.amount || 0) !== Number(resolvedPayment.amount || 0)) {
      issues.push('payment_amount_mismatch');
    }
  }

  if (resolvedPayment) {
    const ledgerEntries = await findTenantLedgerEntriesByPaymentId(resolvedPayment._id);
    const shouldHaveSettlementLedger =
      resolvedPayment.status === PAYMENT_STATUS.PAID || Number(resolvedPayment.refundedAmount || 0) > 0;

    if (shouldHaveSettlementLedger && !ledgerEntries.length) {
      issues.push('payment_without_ledger');
    }
  }

  return {
    businessId: String(businessId || resolvedPayment?.businessId || ''),
    paymentId: resolvedPayment?._id ? String(resolvedPayment._id) : '',
    paymentArchitecture: resolvedPayment?.paymentArchitecture || financeSettings.paymentArchitecture,
    issues,
    ok: issues.length === 0,
  };
}
