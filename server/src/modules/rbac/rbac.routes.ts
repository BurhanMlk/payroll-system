import { Router } from "express";
import { listRoles, createRoleC, updateRoleC, deleteRoleC, listPerms } from "./rbac.controller";
import { requirePermission } from "../../middlewares/requireRole";
import { requireActiveSubscription, requireWritableSubscription } from "../../middlewares/requireActiveSubscription";

const router = Router();

router.get("/roles", requireActiveSubscription, requirePermission("role.manage", "user.manage"), listRoles);
router.post("/roles", requireWritableSubscription, requirePermission("role.manage"), createRoleC);
router.put("/roles/:id", requireWritableSubscription, requirePermission("role.manage"), updateRoleC);
router.delete("/roles/:id", requireWritableSubscription, requirePermission("role.manage"), deleteRoleC);
router.get("/permissions", requireActiveSubscription, requirePermission("role.manage"), listPerms);

export default router;
