import { Router } from "express";
import { listTypes, createType, updateType, deleteType, createRequest, listRequests, decide, remove, balances } from "./leave.controller";
import { requirePermission } from "../../middlewares/requireRole";
import { requireActiveSubscription, requireWritableSubscription } from "../../middlewares/requireActiveSubscription";
import { validateBody } from "../../middlewares/validate";
import { leaveTypeSchema, leaveRequestSchema, leaveDecisionSchema } from "./leave.validator";

const router = Router();

// Leave types
router.get("/types", requireActiveSubscription, requirePermission("leave.manage", "leave.read"), listTypes);
router.post("/types", requireWritableSubscription, requirePermission("leave.manage"), validateBody(leaveTypeSchema), createType);
router.put("/types/:id", requireWritableSubscription, requirePermission("leave.manage"), validateBody(leaveTypeSchema.partial()), updateType);
router.delete("/types/:id", requireWritableSubscription, requirePermission("leave.manage"), deleteType);

// Leave requests
router.get("/", requireActiveSubscription, requirePermission("leave.read", "leave.approve"), listRequests);
router.post("/", requireWritableSubscription, requirePermission("leave.request"), validateBody(leaveRequestSchema), createRequest);
router.post("/:employeeId", requireWritableSubscription, requirePermission("leave.request"), validateBody(leaveRequestSchema), createRequest);
router.post("/:id/decision", requireWritableSubscription, requirePermission("leave.approve"), validateBody(leaveDecisionSchema), decide);
router.delete("/:id", requireWritableSubscription, requirePermission("leave.manage", "leave.approve"), remove);

// Balances
router.get("/balances/:employeeId", requireActiveSubscription, requirePermission("leave.read", "leave.approve"), balances);

export default router;
