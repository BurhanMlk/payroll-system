import multer from "multer";
import { AppError } from "../lib/errors";

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(AppError.badRequest(`File type "${file.mimetype}" is not allowed.`, "INVALID_FILE_TYPE"));
  },
});

export const attendanceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const name = file.originalname.toLowerCase();
    const ok = name.endsWith(".csv") || name.endsWith(".xlsx") || name.endsWith(".xls");
    if (ok) cb(null, true);
    else cb(AppError.badRequest("Only CSV or Excel files are allowed.", "INVALID_FILE_TYPE"));
  },
});
