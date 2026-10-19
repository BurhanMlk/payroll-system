import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { env } from "../config/env";
import { AppError } from "../lib/errors";

export interface StoredFile {
  url: string;
  key: string;
  mimeType: string;
  sizeBytes: number;
}

export interface StorageDriver {
  put(tenantId: string, filename: string, buffer: Buffer, mimeType: string): Promise<StoredFile>;
}

class LocalStorageDriver implements StorageDriver {
  async put(tenantId: string, filename: string, buffer: Buffer, mimeType: string): Promise<StoredFile> {
    const dir = path.resolve(env.STORAGE_LOCAL_PATH, tenantId);
    await mkdir(dir, { recursive: true });
    const ext = path.extname(filename);
    const key = `${randomUUID()}${ext}`;
    await writeFile(path.join(dir, key), buffer);
    return {
      key,
      url: `${env.STORAGE_PUBLIC_BASE_URL}/${tenantId}/${key}`,
      mimeType,
      sizeBytes: buffer.length,
    };
  }
}

const drivers: Record<string, () => StorageDriver> = {
  local: () => new LocalStorageDriver(),
};

export function getStorage(): StorageDriver {
  const factory = drivers[env.STORAGE_DRIVER];
  if (!factory) throw AppError.internal(`Storage driver "${env.STORAGE_DRIVER}" is not available.`);
  return factory();
}

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export function validateFile(mimeType: string, sizeBytes: number): void {
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw AppError.badRequest(`File type "${mimeType}" is not allowed.`, "INVALID_FILE_TYPE");
  }
  if (sizeBytes > MAX_FILE_SIZE) {
    throw AppError.badRequest("File exceeds the 10 MB size limit.", "FILE_TOO_LARGE");
  }
}

export async function storeFile(tenantId: string, file: { originalname: string; buffer: Buffer; mimetype: string }): Promise<StoredFile> {
  validateFile(file.mimetype, file.buffer.length);
  return getStorage().put(tenantId, file.originalname, file.buffer, file.mimetype);
}
