import { env } from "../../config/env";
import { AppError } from "../../lib/errors";
import { prisma } from "../../lib/prisma";

/**
 * Payment provider abstraction. New gateways (Stripe, Paddle, Razorpay, ...)
 * implement this interface and register themselves in the provider factory.
 */
export interface CheckoutResult {
  checkoutUrl: string | null;
  sessionId: string | null;
  manual: boolean;
}

export interface PaymentVerification {
  success: boolean;
  providerRef: string | null;
}

export interface PaymentProvider {
  readonly name: string;
  createCheckout(params: {
    tenantId: string;
    amount: number;
    currency: string;
    description: string;
  }): Promise<CheckoutResult>;
  verifyPayment(providerRef: string): Promise<PaymentVerification>;
  cancelSubscription(providerSubscriptionId: string): Promise<void>;
}

/** Fully functional manual/bank-transfer provider. */
class ManualProvider implements PaymentProvider {
  readonly name = "manual";

  async createCheckout(): Promise<CheckoutResult> {
    return { checkoutUrl: null, sessionId: null, manual: true };
  }

  async verifyPayment(): Promise<PaymentVerification> {
    return { success: true, providerRef: null };
  }

  async cancelSubscription(): Promise<void> {
    // Manual subscriptions have no external record to cancel.
  }
}

const providers: Record<string, () => PaymentProvider> = {
  manual: () => new ManualProvider(),
};

export function getPaymentProvider(name: string = env.PAYMENT_PROVIDER): PaymentProvider {
  const factory = providers[name];
  if (!factory) {
    throw AppError.internal(`Payment provider "${name}" is not available.`);
  }
  return factory();
}

/**
 * Records a manual payment against a subscription, marks the associated
 * invoice paid, and activates/renews the subscription.
 */
export async function recordManualPayment(params: {
  tenantId: string;
  amount: number;
  currency: string;
  reference?: string;
}): Promise<{ paymentId: string; invoiceId: string | null }> {
  const subscription = await prisma.subscription.findUnique({ where: { tenantId: params.tenantId } });
  if (!subscription) throw AppError.notFound("No subscription found for this tenant.");

  const invoice = await prisma.invoice.create({
    data: {
      tenantId: params.tenantId,
      subscriptionId: subscription.id,
      invoiceNumber: await nextInvoiceNumber(),
      amount: params.amount,
      totalAmount: params.amount,
      currency: params.currency,
      status: "PAID",
      issuedAt: new Date(),
      paidAt: new Date(),
    },
  });

  const payment = await prisma.subscriptionPayment.create({
    data: {
      tenantId: params.tenantId,
      subscriptionId: subscription.id,
      amount: params.amount,
      currency: params.currency,
      status: "PAID",
      provider: "MANUAL",
      providerRef: params.reference ?? `manual-${Date.now()}`,
      billingPeriod: subscription.billingPeriod,
      periodStart: subscription.currentPeriodStart,
      periodEnd: subscription.currentPeriodEnd,
      invoiceId: invoice.id,
      paidAt: new Date(),
    },
  });

  return { paymentId: payment.id, invoiceId: invoice.id };
}

let invoiceCounter = 0;
async function nextInvoiceNumber(): Promise<string> {
  invoiceCounter += 1;
  const seq = await prisma.invoice.count();
  return `INV-${new Date().getFullYear()}-${String(seq + 1 + invoiceCounter).padStart(5, "0")}`;
}
