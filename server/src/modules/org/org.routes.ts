import { Router } from "express";
import { orgController } from "./org.controller";
import { requirePermission } from "../../middlewares/requireRole";
import { requireActiveSubscription, requireWritableSubscription } from "../../middlewares/requireActiveSubscription";
import { validateBody } from "../../middlewares/validate";
import { z } from "zod";

const orgItemSchema = z.object({
  name: z.string().min(1, "Name is required"),
  code: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  headName: z.string().optional(),
  headCnic: z.string().optional(),
});

export function orgRouter(model: "department" | "designation" | "branch", permissionKey: string): Router {
  const router = Router();
  const ctrl = orgController(model);

  router.get("/", requireActiveSubscription, requirePermission(permissionKey, "employee.read", "department.manage", "designation.manage", "branch.manage"), ctrl.list);
  router.post("/", requireWritableSubscription, requirePermission(permissionKey), validateBody(orgItemSchema), ctrl.create);
  router.put("/:id", requireWritableSubscription, requirePermission(permissionKey), validateBody(orgItemSchema), ctrl.update);
  router.delete("/:id", requireWritableSubscription, requirePermission(permissionKey), ctrl.remove);

  return router;
}
