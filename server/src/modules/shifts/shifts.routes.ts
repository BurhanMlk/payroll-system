import { Router } from "express";
import { list, create, update, remove, assign } from "./shifts.controller";
import { requirePermission } from "../../middlewares/requireRole";
import { requireActiveSubscription, requireWritableSubscription } from "../../middlewares/requireActiveSubscription";

const router = Router();

router.get("/", requireActiveSubscription, requirePermission("shift.manage", "attendance.manage"), list);
router.post("/", requireWritableSubscription, requirePermission("shift.manage"), create);
router.put("/:id", requireWritableSubscription, requirePermission("shift.manage"), update);
router.delete("/:id", requireWritableSubscription, requirePermission("shift.manage"), remove);
router.post("/assign/:employeeId", requireWritableSubscription, requirePermission("shift.manage"), assign);

export default router;
