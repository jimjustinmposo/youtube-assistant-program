import multer from 'multer';
import { unsupportedMediaType, payloadTooLarge, badRequest, type AppError } from '../errors/AppError.js';
import { FILE_RULES, GENERIC_MIME_TYPES, type FileKind } from '../config/limits.js';
import type { StorageService } from '../services/storageService.js';
import path from 'node:path';

const FIELD_NAME = 'file';

/**
 * Multipart handler for a single file. Content is streamed to a temp file
 * inside the data directory, never into memory and never into SQLite.
 */
export function createFileUploadMiddleware(kind: FileKind, storage: StorageService) {
  const rule = FILE_RULES[kind];

  return multer({
    dest: storage.tmpDir,
    limits: {
      fileSize: rule.maxBytes,
      files: 1,
      fields: 8,
    },
    fileFilter: (_req, file, callback) => {
      const extension = path.extname(file.originalname ?? '').toLowerCase();
      if (!rule.extensions.includes(extension)) {
        callback(
          unsupportedMediaType(`Unsupported ${rule.label} file type "${extension || 'unknown'}". Allowed: ${rule.extensions.join(', ')}.`, {
            kind,
            allowedExtensions: rule.extensions,
          }),
        );
        return;
      }
      const mime = (file.mimetype ?? '').toLowerCase();
      if (!rule.mimeTypes.includes(mime) && !GENERIC_MIME_TYPES.includes(mime)) {
        callback(
          unsupportedMediaType(`Unsupported ${rule.label} content type "${mime || 'unknown'}".`, {
            kind,
            allowedMimeTypes: rule.mimeTypes,
          }),
        );
        return;
      }
      callback(null, true);
    },
  }).single(FIELD_NAME);
}

export const UPLOAD_FIELD_NAME = FIELD_NAME;

/** Maps multer's own errors onto our AppError contract. */
export function toUploadError(error: unknown, kind: FileKind): AppError | null {
  if (!(error instanceof multer.MulterError)) return null;
  const rule = FILE_RULES[kind];
  if (error.code === 'LIMIT_FILE_SIZE') {
    return payloadTooLarge(
      `The ${rule.label} file is larger than the configured ${Math.round(rule.maxBytes / (1024 * 1024))} MB limit.`,
      { kind, maxBytes: rule.maxBytes },
    );
  }
  if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    return badRequest(`Unexpected field "${error.field}". Upload a single file in the "${FIELD_NAME}" field.`);
  }
  return badRequest(`Upload failed: ${error.message}`);
}
