import { Router } from "express";
import { login, me, fees, attendance } from "./studentPortal.controller";
import { requireStudent } from "./studentPortal.auth";
import { authLimiter } from "../../middlewares/rateLimiter";

const router = Router();

router.post("/login", authLimiter, login);
router.get("/me", requireStudent, me);
router.get("/fees", requireStudent, fees);
router.get("/attendance", requireStudent, attendance);

export default router;

