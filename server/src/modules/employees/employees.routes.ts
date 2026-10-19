import { Router } from "express";
import { list, get, getByCnic, create, update, archive, remove, salaryHistory, listDocuments, uploadDocument, deleteDocument } from "./employees.controller";
import { requirePermission } from "../../middlewares/requireRole";
import { requireActiveSubscription, requireWritableSubscription } from "../../middlewares/requireActiveSubscription";
import { validateBody } from "../../middlewares/validate";
import { employeeCreateSchema, employeeUpdateSchema } from "./employees.validator";
import { upload } from "../../services/uploads";

const router = Router();

router.get("/", requireActiveSubscription, requirePermission("employee.read", "employee.create", "employee.update"), list);
router.post("/", requireWritableSubscription, requirePermission("employee.create"), validateBody(employeeCreateSchema), create);
router.get("/by-cnic/:cnic", requireActiveSubscription, requirePermission("employee.read", "employee.create", "employee.update"), getByCnic);
router.get("/:id", requireActiveSubscription, requirePermission("employee.read", "employee.create", "employee.update"), get);
router.put("/:id", requireWritableSubscription, requirePermission("employee.update"), validateBody(employeeUpdateSchema), update);
router.post("/:id/archive", requireWritableSubscription, requirePermission("employee.delete", "employee.update"), archive);
router.delete("/:id", requireWritableSubscription, requirePermission("employee.delete", "employee.update"), remove);
router.get("/:id/salary-history", requireActiveSubscription, requirePermission("employee.read", "salary.manage"), salaryHistory);
router.get("/:id/documents", requireActiveSubscription, requirePermission("document.manage", "employee.read"), listDocuments);
router.post("/:id/documents", requireWritableSubscription, requirePermission("document.manage"), upload.single("file"), uploadDocument);
router.delete("/:id/documents/:docId", requireWritableSubscription, requirePermission("document.manage"), deleteDocument);

export default router;
