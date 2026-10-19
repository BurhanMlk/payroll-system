import { Router } from "express";
import {
  dashboard,
  listTenants,
  getTenant,
  createTenant,
  updateTenant,
  suspendTenant,
  reactivateTenant,
  deleteTenant,
  tenantUsage,
  impersonate,
  listTenantUsers,
  updateUser,
  deleteUser,
  resetUserPassword,
  listSubscriptions,
  createSubscription,
  activateSubscription,
  renewSubscription,
  cancelSubscription,
  extendSubscription,
  extendTrial,
  giveFree,
  changePlan,
  listPlans,
  createPlan,
  updatePlan,
  deletePlan,
  auditLogs,
  backgroundJobs,
  systemHealth,
  listCurrencies,
  createCurrency,
  getSettings,
  updateSettings,
  listLockedAccounts,
  unlockUser,
  lockUserUntil,
} from "./platform.controller";
import { requireRole, requirePermission } from "../../middlewares/requireRole";
import { requireAuth } from "../../middlewares/requireAuth";
import { validateBody } from "../../middlewares/validate";
import { z } from "zod";

const lockUserSchema = z.object({
  until: z
    .string()
    .min(1, "A lock time is required")
    .refine((v) => !Number.isNaN(new Date(v).getTime()), { message: "A valid datetime is required" }),
});

const router = Router();

// All platform routes require platform scope.
router.use(requireAuth, requireRole("super_admin", "platform_support"));

router.get("/dashboard", requirePermission("platform.tenant.read", "platform.revenue.view"), dashboard);
router.get("/revenue", requirePermission("platform.revenue.view"), dashboard);
router.get("/health", systemHealth);

// Tenants
router.get("/tenants", requirePermission("platform.tenant.read"), listTenants);
router.post("/tenants", requirePermission("platform.tenant.manage"), createTenant);
router.get("/tenants/:id", requirePermission("platform.tenant.read"), getTenant);
router.put("/tenants/:id", requirePermission("platform.tenant.manage"), updateTenant);
router.post("/tenants/:id/suspend", requirePermission("platform.tenant.manage"), suspendTenant);
router.post("/tenants/:id/reactivate", requirePermission("platform.tenant.manage"), reactivateTenant);
router.delete("/tenants/:id", requirePermission("platform.tenant.manage"), deleteTenant);
router.get("/tenants/:id/usage", requirePermission("platform.tenant.read"), tenantUsage);
router.post("/tenants/:id/impersonate", requirePermission("platform.impersonate"), impersonate);
router.get("/tenants/:id/users", requirePermission("platform.tenant.read"), listTenantUsers);

// Tenant users (super admin management)
router.put("/users/:id", requirePermission("platform.tenant.manage"), updateUser);
router.delete("/users/:id", requirePermission("platform.tenant.manage"), deleteUser);
router.post("/users/:id/reset-password", requirePermission("platform.tenant.manage"), resetUserPassword);

// Locked accounts management
router.get("/locked-accounts", requirePermission("platform.tenant.read"), listLockedAccounts);
router.post("/users/:id/unlock", requirePermission("platform.tenant.manage"), unlockUser);
router.post("/users/:id/lock", requirePermission("platform.tenant.manage"), validateBody(lockUserSchema), lockUserUntil);

// Subscriptions
router.get("/subscriptions", requirePermission("platform.subscription.manage"), listSubscriptions);
router.post("/subscriptions", requirePermission("platform.subscription.manage"), createSubscription);
router.post("/subscriptions/:id/activate", requirePermission("platform.subscription.manage"), activateSubscription);
router.post("/subscriptions/:id/renew", requirePermission("platform.subscription.manage"), renewSubscription);
router.post("/subscriptions/:id/cancel", requirePermission("platform.subscription.manage"), cancelSubscription);
router.post("/subscriptions/:id/extend", requirePermission("platform.subscription.manage"), extendSubscription);
router.post("/subscriptions/:id/trial", requirePermission("platform.subscription.manage"), extendTrial);
router.post("/subscriptions/:id/free", requirePermission("platform.subscription.manage"), giveFree);
router.post("/subscriptions/:id/change-plan", requirePermission("platform.subscription.manage"), changePlan);

// Plans
router.get("/plans", listPlans);
router.post("/plans", requirePermission("platform.plan.manage"), createPlan);
router.put("/plans/:id", requirePermission("platform.plan.manage"), updatePlan);
router.delete("/plans/:id", requirePermission("platform.plan.manage"), deletePlan);

// Audit & jobs
router.get("/audit-logs", requirePermission("platform.audit.view"), auditLogs);
router.get("/jobs", requirePermission("platform.job.view"), backgroundJobs);

// Currencies & settings
router.get("/currencies", listCurrencies);
router.post("/currencies", requirePermission("platform.setting.manage"), createCurrency);
router.get("/settings", getSettings);
router.put("/settings", requirePermission("platform.setting.manage"), updateSettings);

export default router;
