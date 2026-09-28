export const DETECTED_FILE_TYPES = ['mp4', 'jpeg', 'png', 'webp'] as const;
export type DetectedFileType = (typeof DETECTED_FILE_TYPES)[number];

/** Bytes inspected at the start of every upload (large enough to read the
 *  ISO base media compatible-brands list used by the MP4 brand fallback). */
export const SIGNATURE_BYTE_LENGTH = 64;

/** Canonical MIME type per detected type - never the client-reported value. */
export const MIME_BY_TYPE: Record<DetectedFileType, string> = {
  mp4: 'video/mp4',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

/** Canonical extension used when writing the file to local storage. */
export const EXTENSION_BY_TYPE: Record<DetectedFileType, string> = {
  mp4: '.mp4',
  jpeg: '.jpg',
  png: '.png',
  webp: '.webp',
};

/**
 * Extensions that legitimately match each detected type. `.jpeg` and `.jpg`
 * are the same format, so both must be accepted for JPEG uploads.
 */
export const ALLOWED_EXTENSIONS_BY_TYPE: Record<DetectedFileType, readonly string[]> = {
  mp4: ['.mp4'],
  jpeg: ['.jpg', '.jpeg'],
  png: ['.png'],
  webp: ['.webp'],
};

export const LABEL_BY_TYPE: Record<DetectedFileType, string> = {
  mp4: 'MP4 video',
  jpeg: 'JPEG image',
  png: 'PNG image',
  webp: 'WebP image',
};

/** Brands that identify a genuine MP4 (ISO base media) container. */
const MP4_BRANDS = new Set([
  'isom', 'iso2', 'iso3', 'iso4', 'iso5', 'iso6', 'iso8', 'iso9',
  'mp41', 'mp42', 'avc1', 'dash', 'mmp4', 'M4V ', 'M4A ', 'M4P ', 'M4B ',
  '3gp4', '3gp5', '3g2a', '3g2b', 'f4v ', 'f4p ', 'f4a ', 'f4b ', 'CAEP',
]);

function isJpeg(head: Buffer): boolean {
  return head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
}

function isPng(head: Buffer): boolean {
  if (head.length < 8) return false;
  return head.toString('hex', 0, 8) === '89504e470d0a1a0a';
}

function isWebp(head: Buffer): boolean {
  return (
    head.length >= 12 &&
    head.toString('latin1', 0, 4) === 'RIFF' &&
    head.toString('latin1', 8, 12) === 'WEBP'
  );
}

function isMp4(head: Buffer): boolean {
  if (head.length < 12 || head.toString('latin1', 4, 8) !== 'ftyp') return false;
  const majorBrand = head.toString('latin1', 8, 12);
  // 'qt  ' is QuickTime, not MP4 - a renamed .mov must not be accepted.
  if (majorBrand === 'qt  ') return false;
  if (MP4_BRANDS.has(majorBrand)) return true;
  // Fall back to the compatible-brands list when the major brand is unfamiliar.
  for (let offset = 16; offset + 4 <= Math.min(head.length, SIGNATURE_BYTE_LENGTH); offset += 4) {
    if (MP4_BRANDS.has(head.toString('latin1', offset, offset + 4))) return true;
  }
  return false;
}

/**
 * Identifies an upload from its leading bytes. Returns null when the content
 * matches none of the allowed formats, which is how renamed or arbitrary files
 * are rejected regardless of the filename and MIME type the client claimed.
 */
export function detectFileType(head: Buffer): DetectedFileType | null {
  if (isJpeg(head)) return 'jpeg';
  if (isPng(head)) return 'png';
  if (isWebp(head)) return 'webp';
  if (isMp4(head)) return 'mp4';
  return null;
}
