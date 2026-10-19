import { Router } from "express";
import { register, listPlansPublic, listPublicStats, listCountries, getLandingContent } from "./onboarding.controller";
import { validateBody } from "../../middlewares/validate";
import { onboardingSchema } from "./onboarding.validator";
import { authLimiter } from "../../middlewares/rateLimiter";

const router = Router();

router.post("/register", authLimiter, validateBody(onboardingSchema), register);
router.get("/plans", listPlansPublic);
router.get("/stats", listPublicStats);
router.get("/countries", listCountries);
router.get("/content", getLandingContent);

export default router;
