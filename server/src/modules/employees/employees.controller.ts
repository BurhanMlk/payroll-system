import { NextFunction, Request, Response } from "express";
import {
  listEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  archiveEmployee,
  deleteEmployee,
  getEmployeeSalaryHistory,
  listEmployeeDocuments,
  getEmployeePortal,
} from "./employees.service";
import { storeFile } from "../../services/storage.service";
import { prisma } from "../../lib/prisma";
import { recordAudit } from "../../services/audit.service";
import { ok, created, noContent } from "../../lib/response";

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await listEmployees(req.tenant!.id, req.query);
    ok(res, result.items, result.meta);
  } catch (err) {
    next(err);
  }
}

export async function get(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await getEmployee(req.tenant!.id, req.params.id));
  } catch (err) {
    next(err);
  }
}

export async function getByCnic(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await getEmployeePortal(req.tenant!.id, req.params.cnic));
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    created(res, await createEmployee(req.tenant!.id, req.body, req));
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await updateEmployee(req.tenant!.id, req.params.id, req.body, req));
  } catch (err) {
    next(err);
  }
}

export async function archive(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await archiveEmployee(req.tenant!.id, req.params.id, req));
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await deleteEmployee(req.tenant!.id, req.params.id, req);
    noContent(res);
  } catch (err) {
    next(err);
  }
}

export async function salaryHistory(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await getEmployeeSalaryHistory(req.tenant!.id, req.params.id));
  } catch (err) {
    next(err);
  }
}

export async function listDocuments(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await listEmployeeDocuments(req.tenant!.id, req.params.id));
  } catch (err) {
    next(err);
  }
}

export async function uploadDocument(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: { code: "BAD_REQUEST", message: "No file uploaded." } });
      return;
    }
    const employee = await prisma.employee.findFirst({ where: { id: req.params.id, tenantId: req.tenant!.id } });
    if (!employee) {
      res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Employee not found." } });
      return;
    }
    const stored = await storeFile(req.tenant!.id, req.file);
    const doc = await prisma.employeeDocument.create({
      data: {
        tenantId: req.tenant!.id,
        employeeId: employee.id,
        category: (req.body.category as never) ?? "OTHER",
        title: req.body.title ?? req.file.originalname,
        fileUrl: stored.url,
        mimeType: stored.mimeType,
        sizeBytes: stored.sizeBytes,
        uploadedById: req.user!.id,
      },
    });
    await recordAudit({
      req,
      action: "employee.document_uploaded",
      module: "employee",
      recordId: doc.id,
      recordType: "EmployeeDocument",
      metadata: { employeeId: employee.id },
    });
    created(res, doc);
  } catch (err) {
    next(err);
  }
}

export async function deleteDocument(req: Request, res: Response, next: NextFunction) {
  try {
    const doc = await prisma.employeeDocument.findFirst({ where: { id: req.params.docId, tenantId: req.tenant!.id } });
    if (!doc) {
      res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Document not found." } });
      return;
    }
    await prisma.employeeDocument.delete({ where: { id: doc.id } });
    noContent(res);
  } catch (err) {
    next(err);
  }
}
