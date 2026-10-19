import { Router } from "express";
import { login, me, payslipPdf } from "./employeePortal.controller";
import { requireEmployee } from "./employeePortal.auth";
import { authLimiter } from "../../middlewares/rateLimiter";

const router = Router();

router.post("/login", authLimiter, login);
router.get("/me", requireEmployee, me);
router.get("/payslips/:id/pdf", requireEmployee, payslipPdf);

export default router;
