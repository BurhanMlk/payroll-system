import { Router } from "express";
import { list, create, update, remove } from "./holidays.controller";
import { requirePermission } from "../../middlewares/requireRole";
import { requireActiveSubscription, requireWritableSubscription } from "../../middlewares/requireActiveSubscription";

const router = Router();

router.get("/", requireActiveSubscription, requirePermission("holiday.manage", "attendance.manage"), list);
router.post("/", requireWritableSubscription, requirePermission("holiday.manage"), create);
router.put("/:id", requireWritableSubscription, requirePermission("holiday.manage"), update);
router.delete("/:id", requireWritableSubscription, requirePermission("holiday.manage"), remove);

export default router;
