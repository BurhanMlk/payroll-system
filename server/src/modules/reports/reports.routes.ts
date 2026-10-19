import { Router } from "express";
import { payrollReport, attendanceRep, leaveRep, loanRep, taxRep, overtimeRep } from "./reports.controller";
import { requirePermission } from "../../middlewares/requireRole";
import { requireActiveSubscription } from "../../middlewares/requireActiveSubscription";

const router = Router();

router.get("/payroll", requireActiveSubscription, requirePermission("reports.view"), payrollReport);
router.get("/attendance", requireActiveSubscription, requirePermission("reports.view"), attendanceRep);
router.get("/leave", requireActiveSubscription, requirePermission("reports.view"), leaveRep);
router.get("/loans", requireActiveSubscription, requirePermission("reports.view"), loanRep);
router.get("/tax", requireActiveSubscription, requirePermission("reports.view"), taxRep);
router.get("/overtime", requireActiveSubscription, requirePermission("reports.view"), overtimeRep);

export default router;
