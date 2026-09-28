import type { UploadLimits } from '../types/project';

export interface FileRule {
  label: string;
  extensions: string[];
  maxBytes: number;
  /** Shown in the drop zone, e.g. "MP4". */
  hint: string;
}

/** Mirrors the server defaults so validation still works if the backend is down. */
export const FALLBACK_LIMITS: UploadLimits = {
  maxVideoSizeBytes: 4096 * 1024 * 1024,
  maxThumbnailSizeBytes: 10 * 1024 * 1024,
  videoExtensions: ['.mp4'],
  videoMimeTypes: ['video/mp4'],
  thumbnailExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
  thumbnailMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
};

export const videoRule = (limits: UploadLimits): FileRule => ({
  label: 'video',
  extensions: limits.videoExtensions,
  maxBytes: limits.maxVideoSizeBytes,
  hint: 'MP4',
});

export const thumbnailRule = (limits: UploadLimits): FileRule => ({
  label: 'thumbnail',
  extensions: limits.thumbnailExtensions,
  maxBytes: limits.maxThumbnailSizeBytes,
  hint: 'JPG, JPEG, PNG or WebP',
});

export function formatBytes(bytes: number): string {
  const megabytes = bytes / (1024 * 1024);
  return `${Math.round(megabytes * 10) / 10} MB`;
}

function extensionOf(fileName: string): string {
  const index = fileName.lastIndexOf('.');
  return index === -1 ? '' : fileName.slice(index).toLowerCase();
}

/**
 * Client-side pre-check for fast feedback. The backend re-validates
 * everything (including the real file signature) before storing anything.
 */
export function validateFile(file: File, rule: FileRule): string | null {
  const extension = extensionOf(file.name);
  if (!rule.extensions.includes(extension)) {
    return `"${file.name}" is not a supported ${rule.label}. Allowed: ${rule.extensions.join(', ')}.`;
  }
  if (file.type && file.type.startsWith('text/')) {
    return `"${file.name}" does not look like a ${rule.label} file.`;
  }
  if (file.size === 0) return `"${file.name}" is empty.`;
  if (file.size > rule.maxBytes) {
    return `"${file.name}" is ${formatBytes(file.size)}. The ${rule.label} limit is ${formatBytes(rule.maxBytes)}.`;
  }
  return null;
}
