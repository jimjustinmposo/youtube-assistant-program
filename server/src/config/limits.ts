import { env } from './env.js';
import type { DetectedFileType } from '../services/fileSignature.js';

export type FileKind = 'video' | 'thumbnail';

export interface FileKindRule {
  label: string;
  maxBytes: number;
  extensions: readonly string[];
  /** MIME types browsers legitimately report for this format. */
  mimeTypes: readonly string[];
  /** Content signatures that must be detected in the file's leading bytes. */
  signatures: readonly DetectedFileType[];
}

/**
 * Some clients (and Windows Explorer drag & drop in certain shells) report a
 * generic MIME type. Such uploads are still accepted, but only if the content
 * signature check passes.
 */
export const GENERIC_MIME_TYPES: readonly string[] = ['application/octet-stream', 'binary/octet-stream'];

export const FILE_RULES: Record<FileKind, FileKindRule> = {
  video: {
    label: 'video',
    maxBytes: env.maxVideoSizeBytes,
    extensions: ['.mp4'],
    mimeTypes: ['video/mp4', 'application/mp4'],
    signatures: ['mp4'],
  },
  thumbnail: {
    label: 'thumbnail',
    maxBytes: env.maxThumbnailSizeBytes,
    extensions: ['.jpg', '.jpeg', '.png', '.webp'],
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    signatures: ['jpeg', 'png', 'webp'],
  },
};

export const megabytesToBytes = (mb: number): number => Math.round(mb * 1024 * 1024);
