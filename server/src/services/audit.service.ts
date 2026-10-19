import { Request } from "express";
import { prisma } from "../lib/prisma";

export interface AuditInput {
  req: Request;
  action: string;
  module: string;
  recordId?: string;
  recordType?: string;
  previous?: unknown;
  next?: unknown;
  metadata?: unknown;
}

/**
 * Records an audit event. Tenant users' logs are always scoped to their own
 * tenant; platform actions log without a tenantId (or with the target tenant
 * when acting on behalf of one).
 */
export async function recordAudit(input: AuditInput): Promise<void> {
  const { req } = input;
  try {
    await prisma.auditLog.create({
      data: {
        tenantId: req.tenant?.id ?? null,
        userId: req.user?.id ?? null,
        action: input.action,
        module: input.module,
        recordId: input.recordId,
        recordType: input.recordType,
        ipAddress: req.ip ?? null,
        userAgent: req.headers["user-agent"]?.slice(0, 500) ?? null,
        previousValues: input.previous === undefined ? undefined : (input.previous as object),
        newValues: input.next === undefined ? undefined : (input.next as object),
        metadata: input.metadata === undefined ? undefined : (input.metadata as object),
      },
    });
  } catch {
    // Audit must never break the main flow.
  }
}
