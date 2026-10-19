import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/errors";
import { recordManualPayment } from "../../services/payments/payment.provider";
import { renewSubscription, activateSubscription } from "../subscriptions/subscriptions.service";
import { recordAudit } from "../../services/audit.service";
import { Request } from "express";

export async function getBillingOverview(tenantId: string) {
  const subscription = await prisma.subscription.findUnique({
    where: { tenantId },
    include: {
      plan: { include: { features: true } },
      payments: { orderBy: { createdAt: "desc" }, take: 10 },
      invoices: { orderBy: { issuedAt: "desc" }, take: 10 },
    },
  });
  if (!subscription) throw AppError.notFound("No subscription found.");
  return subscription;
}

export async function listInvoices(tenantId: string, query: { page?: string; limit?: string }) {
  const page = Math.max(1, parseInt(query.page ?? "1", 10));
  const limit = Math.min(100, parseInt(query.limit ?? "10", 10));
  const [total, items] = await Promise.all([
    prisma.invoice.count({ where: { tenantId } }),
    prisma.invoice.findMany({ where: { tenantId }, orderBy: { issuedAt: "desc" }, skip: (page - 1) * limit, take: limit }),
  ]);
  return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } };
}

export async function listPaymentHistory(tenantId: string, query: { page?: string; limit?: string }) {
  const page = Math.max(1, parseInt(query.page ?? "1", 10));
  const limit = Math.min(100, parseInt(query.limit ?? "10", 10));
  const [total, items] = await Promise.all([
    prisma.subscriptionPayment.count({ where: { tenantId } }),
    prisma.subscriptionPayment.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }),
  ]);
  return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } };
}

export async function deleteInvoice(tenantId: string, id: string, req: Request) {
  const invoice = await prisma.invoice.findFirst({ where: { id, tenantId } });
  if (!invoice) throw AppError.notFound("Invoice not found.");
  await prisma.invoice.delete({ where: { id } });
  await recordAudit({
    req,
    action: "billing.invoice_deleted",
    module: "billing",
    recordId: id,
    recordType: "Invoice",
    previous: { invoiceNumber: invoice.invoiceNumber },
  });
}

export async function deletePayment(tenantId: string, id: string, req: Request) {
  const payment = await prisma.subscriptionPayment.findFirst({ where: { id, tenantId } });
  if (!payment) throw AppError.notFound("Payment not found.");
  await prisma.subscriptionPayment.delete({ where: { id } });
  await recordAudit({
    req,
    action: "billing.payment_deleted",
    module: "billing",
    recordId: id,
    recordType: "SubscriptionPayment",
    previous: { amount: payment.amount },
  });
}

/** Tenant self-service renewal via manual payment (bank transfer). */
export async function payManually(tenantId: string, req: Request) {
  const sub = await prisma.subscription.findUnique({ where: { tenantId } });
  if (!sub) throw AppError.notFound("No subscription found.");
  const amount = sub.amount.toNumber();
  await recordManualPayment({ tenantId, amount, currency: sub.currency });
  await renewSubscription(sub.id, req);
  return getBillingOverview(tenantId);
}

/** Tenant requests a checkout session from the configured provider. */
export async function checkout(tenantId: string, req: Request) {
  const sub = await prisma.subscription.findUnique({ where: { tenantId } });
  if (!sub) throw AppError.notFound("No subscription found.");
  // Manual provider: tenant pays via bank transfer and admin/accounts records it.
  return {
    checkoutUrl: null,
    manual: true,
    message: "Complete the bank transfer and use the 'Record Payment' action.",
  };
}

export async function recordPayment(tenantId: string, amount: number, reference: string | undefined, req: Request) {
  const sub = await prisma.subscription.findUnique({ where: { tenantId } });
  if (!sub) throw AppError.notFound("No subscription found.");
  await recordManualPayment({ tenantId, amount, currency: sub.currency, reference });
  await renewSubscription(sub.id, req);
  await recordAudit({
    req,
    action: "billing.payment_recorded",
    module: "billing",
    recordId: sub.id,
    recordType: "Subscription",
    metadata: { amount, reference },
  });
  return getBillingOverview(tenantId);
}
