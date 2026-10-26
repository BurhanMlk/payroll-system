import { Router } from "express";
import { login, me, attendance, leaveTypes, submitLeave, payslipPdf, select } from "./employeePortal.controller";
import { requireEmployee } from "./employeePortal.auth";
import { authLimiter } from "../../middlewares/rateLimiter";

const router = Router();

router.post("/login", authLimiter, login);
router.post("/select", authLimiter, select);
router.get("/me", requireEmployee, me);
router.get("/attendance", requireEmployee, attendance);
router.get("/leaves/types", requireEmployee, leaveTypes);
router.post("/leaves", requireEmployee, submitLeave);
router.get("/payslips/:id/pdf", requireEmployee, payslipPdf);

export default router;
