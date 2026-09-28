import fs from 'node:fs/promises';
import path from 'node:path';
import {
  badRequest,
  payloadTooLarge,
  unsupportedMediaType,
  type AppError,
} from '../errors/AppError.js';
import { FILE_RULES, GENERIC_MIME_TYPES, type FileKind } from '../config/limits.js';
import {
  ALLOWED_EXTENSIONS_BY_TYPE,
  EXTENSION_BY_TYPE,
  LABEL_BY_TYPE,
  MIME_BY_TYPE,
  SIGNATURE_BYTE_LENGTH,
  detectFileType,
  type DetectedFileType,
} from './fileSignature.js';

/** Shape produced by multer's diskStorage; kept structural for testability. */
export interface TempUploadFile {
  originalname: string;
  mimetype: string;
  size: number;
  path: string;
}

export interface ValidatedUpload {
  detectedType: DetectedFileType;
  mimeType: string;
  extension: string;
  sizeBytes: number;
  originalFilename: string;
}

const MAX_FILENAME_LENGTH = 180;

/**
 * Strips any path information and control characters from a client-supplied
 * filename. The result is only ever stored and displayed - it is never used to
 * build a filesystem path.
 */
export function sanitizeOriginalFilename(rawName: string | undefined | null): string {
  const base = path.basename((rawName ?? '').replace(/\\/g, '/'));
  const cleaned = base
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[<>:"|?*]/g, '_')
    .replace(/^\.+/, '')
    .trim();
  if (cleaned.length === 0) return 'unnamed-file';
  return cleaned.length > MAX_FILENAME_LENGTH
    ? `${cleaned.slice(0, MAX_FILENAME_LENGTH - 4)}...`
    : cleaned;
}

function formatMegabytes(bytes: number): string {
  return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`;
}

function listOf(values: readonly string[]): string {
  return values.join(', ');
}

/**
 * Full server-side validation of an uploaded file: extension, reported MIME
 * type, size and real content signature. The client is never trusted, and the
 * browser-reported filename is never used as a storage path.
 */
export async function validateUpload(file: TempUploadFile, kind: FileKind): Promise<ValidatedUpload> {
  const rule = FILE_RULES[kind];
  const originalFilename = sanitizeOriginalFilename(file.originalname);
  const extension = path.extname(originalFilename).toLowerCase();

  if (!rule.extensions.includes(extension)) {
    throw unsupportedMediaType(
      `Unsupported ${rule.label} file type "${extension || 'unknown'}". Allowed: ${listOf(rule.extensions)}.`,
      { kind, allowedExtensions: rule.extensions },
    );
  }

  const reportedMime = (file.mimetype ?? '').toLowerCase();
  const mimeAccepted =
    rule.mimeTypes.includes(reportedMime) || GENERIC_MIME_TYPES.includes(reportedMime);
  if (!mimeAccepted) {
    throw unsupportedMediaType(
      `Unsupported ${rule.label} content type "${reportedMime || 'unknown'}". Allowed: ${listOf(rule.mimeTypes)}.`,
      { kind, reportedMime, allowedMimeTypes: rule.mimeTypes },
    );
  }

  if (file.size <= 0) {
    throw badRequest(`The uploaded ${rule.label} file is empty.`);
  }

  if (file.size > rule.maxBytes) {
    throw payloadTooLarge(
      `The ${rule.label} file is larger than the ${formatMegabytes(rule.maxBytes)} limit.`,
      { kind, sizeBytes: file.size, maxBytes: rule.maxBytes },
    );
  }

  const handle = await fs.open(file.path, 'r');
  let head: Buffer;
  try {
    const buffer = Buffer.alloc(SIGNATURE_BYTE_LENGTH);
    const { bytesRead } = await handle.read(buffer, 0, SIGNATURE_BYTE_LENGTH, 0);
    head = buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }

  const detectedType = detectFileType(head);
  if (!detectedType || !rule.signatures.includes(detectedType)) {
    const accepted = rule.signatures.map((type) => LABEL_BY_TYPE[type]).join(' or ');
    throw unsupportedMediaType(
      `The file contents of "${originalFilename}" are not a supported ${accepted}. ` +
        'The file may be corrupt or renamed.',
      { kind, expected: rule.signatures, detected: detectedType },
    );
  }

  // The extension must also match the detected type, so a .png cannot smuggle
  // in JPEG bytes (the extension drives the stored filename and served type).
  if (!ALLOWED_EXTENSIONS_BY_TYPE[detectedType].includes(extension)) {
    throw unsupportedMediaType(
      `The contents of "${originalFilename}" are ${LABEL_BY_TYPE[detectedType]} data, ` +
        `which does not match the "${extension}" extension.`,
      { kind, extension, detectedType },
    );
  }

  return {
    detectedType,
    mimeType: MIME_BY_TYPE[detectedType],
    extension,
    sizeBytes: file.size,
    originalFilename,
  };
}

export type { AppError };
