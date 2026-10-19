import { Router } from "express";
import { listT, getT, createT, updateT, deleteT, assign, structure } from "./salary.controller";
import { requirePermission } from "../../middlewares/requireRole";
import { requireActiveSubscription, requireWritableSubscription } from "../../middlewares/requireActiveSubscription";

const router = Router();

router.get("/templates", requireActiveSubscription, requirePermission("salary.manage", "template.manage"), listT);
router.post("/templates", requireWritableSubscription, requirePermission("template.manage"), createT);
router.get("/templates/:id", requireActiveSubscription, requirePermission("salary.manage", "template.manage"), getT);
router.put("/templates/:id", requireWritableSubscription, requirePermission("template.manage"), updateT);
router.delete("/templates/:id", requireWritableSubscription, requirePermission("template.manage"), deleteT);

router.post("/assign/:employeeId", requireWritableSubscription, requirePermission("salary.manage"), assign);
router.get("/structure/:employeeId", requireActiveSubscription, requirePermission("salary.manage", "employee.read"), structure);

export default router;
