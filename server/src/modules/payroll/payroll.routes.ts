import { Router } from "express";
import {
  generate,
  list,
  get,
  update,
  remove,
  review,
  approve,
  markPaid,
  lock,
  unlock,
  makePayslips,
  mailPayslips,
  listSlips,
  getSlip,
  getSlipPdf,
  autoPayslips,
  salaries,
  salariesCsv,
  getDeduction,
  setDeduction,
} from "./payroll.controller";
import { requirePermission } from "../../middlewares/requireRole";
import { requireActiveSubscription, requireWritableSubscription } from "../../middlewares/requireActiveSubscription";

const router = Router();

// Payroll runs
router.get("/", requireActiveSubscription, requirePermission("payroll.read", "payroll.generate", "payroll.review", "payroll.approve", "payroll.mark_paid"), list);
router.post("/generate", requireWritableSubscription, requirePermission("payroll.generate"), generate);
router.post("/auto-payslips", requireWritableSubscription, requirePermission("payroll.generate"), autoPayslips);
router.get("/salaries", requireActiveSubscription, requirePermission("payroll.read", "salary.manage", "employee.read"), salaries);
router.get("/salaries/csv", requireActiveSubscription, requirePermission("payroll.read", "salary.manage", "employee.read"), salariesCsv);
router.get("/deduction-setting", requireActiveSubscription, requirePermission("payroll.generate", "salary.manage"), getDeduction);
router.put("/deduction-setting", requireWritableSubscription, requirePermission("payroll.generate", "salary.manage"), setDeduction);
router.get("/:id", requireActiveSubscription, requirePermission("payroll.read", "payroll.generate", "payroll.review", "payroll.approve", "payroll.mark_paid"), get);
router.patch("/:id", requireWritableSubscription, requirePermission("payroll.generate"), update);
router.delete("/:id", requireWritableSubscription, requirePermission("payroll.generate"), remove);
router.post("/:id/review", requireWritableSubscription, requirePermission("payroll.review", "payroll.generate"), review);
router.post("/:id/approve", requireWritableSubscription, requirePermission("payroll.approve"), approve);
router.post("/:id/mark-paid", requireWritableSubscription, requirePermission("payroll.mark_paid"), markPaid);
router.post("/:id/lock", requireWritableSubscription, requirePermission("payroll.approve"), lock);
router.post("/:id/unlock", requireWritableSubscription, requirePermission("payroll.unlock"), unlock);

// Payslips
router.post("/:id/payslips", requireWritableSubscription, requirePermission("payroll.mark_paid", "payroll.generate"), makePayslips);
router.post("/:id/email-payslips", requireWritableSubscription, requirePermission("payroll.mark_paid", "payroll.generate"), mailPayslips);
router.get("/payslips/list", requireActiveSubscription, requirePermission("payroll.read", "payroll.generate", "payroll.review", "payroll.approve", "payroll.mark_paid"), listSlips);
router.get("/payslips/:id", requireActiveSubscription, requirePermission("payroll.read", "payroll.generate", "payroll.review", "payroll.approve", "payroll.mark_paid"), getSlip);
router.get("/payslips/:id/pdf", requireActiveSubscription, requirePermission("payroll.read", "payroll.generate", "payroll.review", "payroll.approve", "payroll.mark_paid"), getSlipPdf);

export default router;
