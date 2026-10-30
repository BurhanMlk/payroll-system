import { Router } from "express";
import {
  list,
  get,
  create,
  update,
  remove,
  downloadTemplate,
  bulkImport,
  getAttendance,
  markAttendance,
  downloadAttendanceTemplate,
  importAttendance,
  getFees,
  generateFees,
  payFee,
  exportFees,
} from "./students.controller";
import { requirePermission } from "../../middlewares/requireRole";
import { requireActiveSubscription, requireWritableSubscription } from "../../middlewares/requireActiveSubscription";
import { validateBody } from "../../middlewares/validate";
import {
  studentCreateSchema,
  studentUpdateSchema,
  studentAttendanceRecordSchema,
  studentFeePaySchema,
  studentFeeGenerateSchema,
} from "./students.validator";
import { upload } from "../../services/uploads";

const router = Router();

// Student Directory
router.get("/", requireActiveSubscription, requirePermission("student.read", "student.create", "student.update"), list);
router.post("/", requireWritableSubscription, requirePermission("student.create"), validateBody(studentCreateSchema), create);
router.get("/template", requireActiveSubscription, requirePermission("student.create", "student.read"), downloadTemplate);
router.post("/bulk-import", requireWritableSubscription, requirePermission("student.create"), upload.single("file"), bulkImport);

// Student Attendance
router.get("/attendance", requireActiveSubscription, requirePermission("student.attendance", "student.read"), getAttendance);
router.post("/attendance", requireWritableSubscription, requirePermission("student.attendance"), validateBody(studentAttendanceRecordSchema), markAttendance);
router.get("/attendance/template", requireActiveSubscription, requirePermission("student.attendance"), downloadAttendanceTemplate);
router.post("/attendance/import", requireWritableSubscription, requirePermission("student.attendance"), upload.single("file"), importAttendance);

// Student Fees
router.get("/fees", requireActiveSubscription, requirePermission("student.fee", "student.read"), getFees);
router.post("/fees/generate", requireWritableSubscription, requirePermission("student.fee"), validateBody(studentFeeGenerateSchema), generateFees);
router.post("/fees/pay", requireWritableSubscription, requirePermission("student.fee"), validateBody(studentFeePaySchema), payFee);
router.get("/fees/export", requireActiveSubscription, requirePermission("student.fee", "student.read"), exportFees);

// Individual Student
router.get("/:id", requireActiveSubscription, requirePermission("student.read", "student.create", "student.update"), get);
router.put("/:id", requireWritableSubscription, requirePermission("student.update"), validateBody(studentUpdateSchema), update);
router.delete("/:id", requireWritableSubscription, requirePermission("student.delete"), remove);

export default router;

