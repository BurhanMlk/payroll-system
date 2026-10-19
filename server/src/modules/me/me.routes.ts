import { Router } from "express";
import { profile, attendance, payslips, leaveRequests, leaveBalances, loans, requestLeaveC, updateProfile } from "./me.controller";
import { requireActiveSubscription } from "../../middlewares/requireActiveSubscription";

const router = Router();

// Self-service endpoints remain accessible as long as the tenant can log in.
router.get("/profile", profile);
router.patch("/profile", requireActiveSubscription, updateProfile);
router.get("/attendance", attendance);
router.get("/payslips", payslips);
router.get("/leave", leaveRequests);
router.post("/leave", requireActiveSubscription, requestLeaveC);
router.get("/leave-balances", leaveBalances);
router.get("/loans", loans);

export default router;
