import { Router } from "express";
import { login, refresh, logout, me, changePassword } from "../controllers/auth.controller";
import { validateBody } from "../middlewares/validate";
import { loginSchema, refreshSchema, changePasswordSchema } from "../validators/auth.validators";
import { authLimiter } from "../middlewares/rateLimiter";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

router.post("/login", authLimiter, validateBody(loginSchema), login);
router.post("/refresh", authLimiter, validateBody(refreshSchema), refresh);
router.post("/logout", logout);
router.get("/me", requireAuth, me);
router.post("/change-password", requireAuth, validateBody(changePasswordSchema), changePassword);

export default router;
