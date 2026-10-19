import { Router } from "express";
import { dashboard } from "./dashboard.controller";
import { requireActiveSubscription } from "../../middlewares/requireActiveSubscription";

const router = Router();

router.get("/", requireActiveSubscription, dashboard);

export default router;
