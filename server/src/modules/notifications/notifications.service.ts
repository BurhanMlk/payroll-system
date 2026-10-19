import { prisma } from "../../lib/prisma";
import { sendEmail } from "../../services/email.service";
import { logger } from "../../config/logger";

export type NotificationEvent =
  | "employee.created"
  | "leave.submitted"
  | "leave.approved"
  | "leave.rejected"
  | "payroll.generated"
  | "payroll.approved"
  | "salary.paid"
  | "payslip.available"
  | "loan.approved"
  | "subscription.expiring"
  | "subscription.expired"
  | "subscription.renewed"
  | "payment.failed";

export interface NotifyInput {
  tenantId: string | null;
  userId: string;
  event: NotificationEvent;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
}

/** Reusable notification service: in-app always, email/SMS per preferences. */
export async function notify(input: NotifyInput): Promise<void> {
  try {
    const prefs = await prisma.notificationPreference.findUnique({
      where: { userId_eventKey: { userId: input.userId, eventKey: input.event } },
    });

    const inApp = prefs?.inApp ?? true;
    const email = prefs?.email ?? true;

    if (inApp) {
      await prisma.notification.create({
        data: {
          tenantId: input.tenantId,
          userId: input.userId,
          title: input.title,
          body: input.body,
          channel: "IN_APP",
          metadata: input.metadata as object | undefined,
        },
      });
    }

    if (email) {
      const user = await prisma.user.findUnique({ where: { id: input.userId }, select: { email: true } });
      if (user) {
        await sendEmail(user.email, input.title, `<p>${input.body}</p>`).catch((e) =>
          logger.warn({ err: e.message }, "Failed to send notification email"),
        );
      }
    }
  } catch (err) {
    logger.warn({ err }, "Notification delivery failed");
  }
}

export async function listNotifications(tenantId: string | null, userId: string, query: { page?: string; limit?: string }) {
  const page = Math.max(1, parseInt(query.page ?? "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(query.limit ?? "20", 10)));
  const skip = (page - 1) * limit;
  const where = { userId, ...(tenantId ? { tenantId } : {}) };
  const [total, items, unread] = await Promise.all([
    prisma.notification.count({ where }),
    prisma.notification.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: limit }),
    prisma.notification.count({ where: { ...where, readAt: null } }),
  ]);
  return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 }, unread };
}

export async function markRead(userId: string, id?: string) {
  if (id) {
    await prisma.notification.updateMany({ where: { id, userId }, data: { readAt: new Date() } });
  } else {
    await prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
  }
}
