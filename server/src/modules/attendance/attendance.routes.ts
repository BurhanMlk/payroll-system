import { Router } from "express";
import { mark, bulkMark, list, summary, employeeMonthly, importFile, update, remove } from "./attendance.controller";
import { requirePermission } from "../../middlewares/requireRole";
import { requireActiveSubscription, requireWritableSubscription } from "../../middlewares/requireActiveSubscription";
import { validateBody } from "../../middlewares/validate";
import { markAttendanceSchema, bulkMarkSchema, updateAttendanceSchema } from "./attendance.validator";
import { attendanceUpload } from "../../services/uploads";

const router = Router();

router.get("/", requireActiveSubscription, requirePermission("attendance.read", "attendance.manage"), list);
router.get("/summary", requireActiveSubscription, requirePermission("attendance.read", "attendance.manage"), summary);
router.get("/employee/:employeeId", requireActiveSubscription, requirePermission("attendance.read", "attendance.manage"), employeeMonthly);
router.post("/", requireWritableSubscription, requirePermission("attendance.manage"), validateBody(markAttendanceSchema), mark);
router.post("/bulk", requireWritableSubscription, requirePermission("attendance.manage"), validateBody(bulkMarkSchema), bulkMark);
router.patch("/:id", requireWritableSubscription, requirePermission("attendance.manage"), validateBody(updateAttendanceSchema), update);
router.delete("/:id", requireWritableSubscription, requirePermission("attendance.manage"), remove);
router.post("/import", requireWritableSubscription, requirePermission("attendance.manage"), attendanceUpload.single("file"), importFile);

export default router;
