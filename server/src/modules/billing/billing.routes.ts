import { Router } from "express";
import { overview, invoices, payments, checkoutC, recordPaymentC, removeInvoice, removePayment } from "./billing.controller";
import { requirePermission } from "../../middlewares/requireRole";
import { requireActiveSubscription, requireWritableSubscription } from "../../middlewares/requireActiveSubscription";

const router = Router();

// Billing pages must remain accessible even when subscription lapsed.
router.get("/", overview);
router.get("/invoices", invoices);
router.get("/payments", payments);
router.post("/checkout", requireWritableSubscription, requirePermission("billing.manage"), checkoutC);
router.post("/record-payment", requireWritableSubscription, requirePermission("billing.manage"), recordPaymentC);
router.delete("/invoices/:id", requirePermission("billing.manage"), removeInvoice);
router.delete("/payments/:id", requirePermission("billing.manage"), removePayment);

export default router;
