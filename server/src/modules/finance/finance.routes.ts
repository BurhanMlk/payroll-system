import { Router } from "express";
import {
  listLoan,
  getLoanById,
  createLoanC,
  approveLoanC,
  cancelLoanC,
  loanHistory,
  listAdv,
  createAdv,
  approveAdv,
} from "./finance.controller";
import { requirePermission } from "../../middlewares/requireRole";
import { requireActiveSubscription, requireWritableSubscription } from "../../middlewares/requireActiveSubscription";

const router = Router();

router.get("/loans", requireActiveSubscription, requirePermission("loan.read", "loan.create", "loan.approve"), listLoan);
router.post("/loans", requireWritableSubscription, requirePermission("loan.create"), createLoanC);
router.get("/loans/:id", requireActiveSubscription, requirePermission("loan.read", "loan.create", "loan.approve"), getLoanById);
router.post("/loans/:id/approve", requireWritableSubscription, requirePermission("loan.approve"), approveLoanC);
router.post("/loans/:id/cancel", requireWritableSubscription, requirePermission("loan.approve", "loan.create"), cancelLoanC);
router.get("/loans/:id/history", requireActiveSubscription, requirePermission("loan.read", "loan.create", "loan.approve"), loanHistory);

router.get("/advances", requireActiveSubscription, requirePermission("loan.read", "advance.create", "advance.approve"), listAdv);
router.post("/advances", requireWritableSubscription, requirePermission("advance.create"), createAdv);
router.post("/advances/:id/approve", requireWritableSubscription, requirePermission("advance.approve"), approveAdv);

export default router;
