import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

/**
 * Models that are ALWAYS owned by a tenant. The tenant-scoped client injects
 * the authenticated tenantId into every query against these models so that a
 * developer can never accidentally read or mutate another tenant's data.
 *
 * User, Role, Notification and NotificationPreference have nullable tenantId
 * (platform-wide users exist) and are therefore scoped manually in services.
 */
const TENANT_MODELS = new Set<string>([
  "TenantSetting",
  "Branch",
  "Department",
  "Designation",
  "Employee",
  "EmployeeDocument",
  "SalaryTemplate",
  "SalaryComponent",
  "EmployeeSalaryStructure",
  "PayrollCycle",
  "PayrollRun",
  "PayrollItem",
  "PayrollEarning",
  "PayrollDeduction",
  "PayrollApproval",
  "Payslip",
  "EmployeeLoan",
  "LoanInstallment",
  "SalaryAdvance",
  "Overtime",
  "Attendance",
  "Shift",
  "EmployeeShift",
  "Holiday",
  "LeaveType",
  "LeaveRequest",
  "LeaveBalance",
  "Subscription",
  "SubscriptionPayment",
  "Invoice",
  "SubscriptionReminder",
  "AuditLog",
]);

/**
 * Returns a Prisma client whose operations on tenant-owned models are
 * automatically scoped to the given tenantId.
 *
 * - read/update/delete/count operations inject `where.tenantId`
 * - create operations inject `data.tenantId`
 * - findUnique on tenant models is intentionally not auto-scoped: callers must
 *   use findFirst with an explicit composite filter, which the extension scopes.
 */
export function tenantClient(tenantId: string) {
  return prisma.$extends({
    name: `tenant-${tenantId}`,
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (model && TENANT_MODELS.has(model)) {
            // Inject tenantId into create payloads.
            if (operation === "create") {
  args = {
    ...args,
    data: {
      ...((args as { data: Record<string, unknown> }).data ?? {}),
      tenantId,
    },
  };
}
            if (operation === "createMany") {
              const data = (args as { data: unknown[] }).data ?? [];
              args = {
                ...args,
                data: data.map((row) => ({ ...(row as Record<string, unknown>), tenantId })),
              };
            }

            // Inject tenantId into where for every operation that has a where.
            const argsAny = args as { where?: unknown };
            if (argsAny && typeof argsAny === "object" && "where" in argsAny) {
              args = {
                ...args,
                where: { ...(argsAny.where as object), tenantId },
              };
            }
          }
          return query(args);
        },
      },
    },
  });
}

export type TenantPrisma = ReturnType<typeof tenantClient>;

/**
 * Validates that an arbitrary where-object never omits the tenantId for a
 * tenant-owned model. Used as a defensive assertion in service code.
 */
export function assertTenantScoped(model: string, where: Record<string, unknown> | undefined) {
  if (where && TENANT_MODELS.has(model) && !("tenantId" in where)) {
    throw new Error(`Tenant scope missing on ${model} query. This is a programming error.`);
  }
}
