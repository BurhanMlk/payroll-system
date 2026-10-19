import { Router } from "express";
import { list, create, update, remove, roles, settings, updateSetting } from "./users.controller";
import { requirePermission } from "../../middlewares/requireRole";
import { requireActiveSubscription, requireWritableSubscription } from "../../middlewares/requireActiveSubscription";

const router = Router();

router.get("/", requireActiveSubscription, requirePermission("user.manage"), list);
router.post("/", requireWritableSubscription, requirePermission("user.manage"), create);
router.put("/:id", requireWritableSubscription, requirePermission("user.manage"), update);
router.delete("/:id", requireWritableSubscription, requirePermission("user.manage"), remove);

router.get("/roles/list", requireActiveSubscription, requirePermission("role.manage", "user.manage"), roles);
router.get("/settings", requireActiveSubscription, requirePermission("settings.manage"), settings);
router.put("/settings", requireWritableSubscription, requirePermission("settings.manage"), updateSetting);

export default router;
