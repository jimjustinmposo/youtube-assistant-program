import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

import { detectFileType } from '../src/services/fileSignature.js';
import { sanitizeOriginalFilename, validateUpload } from '../src/services/uploadValidator.js';
import { FILE_RULES } from '../src/config/limits.js';
import { StorageService } from '../src/services/storageService.js';
import { AppError } from '../src/errors/AppError.js';

export const MP4_HEADER = Buffer.concat([
  Buffer.from([0x00, 0x00, 0x00, 0x20]),
  Buffer.from('ftypisom', 'latin1'),
  Buffer.from([0x00, 0x00, 0x02, 0x00]),
  Buffer.from('isomiso2avc1mp41', 'latin1'),
]);

export const JPEG_HEADER = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
  Buffer.from([0x00, 0x10, 0x4a, 0x46]),
]);
export const PNG_HEADER = Buffer.from('89504e470d0a1a0a', 'hex');
export const WEBP_HEADER = Buffer.concat([
  Buffer.from('RIFF', 'latin1'),
  Buffer.from([0x1a, 0x00, 0x00, 0x00]),
  Buffer.from('WEBPVP8 ', 'latin1'),
]);
const QUICKTIME_HEADER = Buffer.concat([
  Buffer.from([0x00, 0x00, 0x00, 0x14]),
  Buffer.from('ftypqt  ', 'latin1'),
  Buffer.from([0x00, 0x00, 0x02, 0x00]),
]);

let tmpDir: string;
let storage: StorageService;

before(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), 'yac-validation-'));
  storage = new StorageService(path.join(tmpDir, 'data'));
  await storage.init();
});

after(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

async function upload(
  kind: 'video' | 'thumbnail',
  bytes: Buffer,
  originalname: string,
  mimetype: string,
  /**
   * Overrides the reported size. The size limit is checked against this value,
   * so oversize cases can be tested without allocating a multi-gigabyte buffer.
   */
  sizeOverride?: number,
) {
  const filePath = storage.tempUploadPath();
  await writeFile(filePath, bytes);
  return { originalname, mimetype, size: sizeOverride ?? bytes.length, path: filePath };
}

async function expectAppError(promise: Promise<unknown>): Promise<AppError> {
  try {
    await promise;
  } catch (error) {
    assert.ok(error instanceof AppError, `expected AppError, received ${String(error)}`);
    return error;
  }
  throw new Error('expected the operation to be rejected');
}

describe('detectFileType', () => {
  it('identifies MP4, JPEG, PNG and WebP from their signatures', () => {
    assert.equal(detectFileType(MP4_HEADER), 'mp4');
    assert.equal(detectFileType(JPEG_HEADER), 'jpeg');
    assert.equal(detectFileType(PNG_HEADER), 'png');
    assert.equal(detectFileType(WEBP_HEADER), 'webp');
  });

  it('returns null for text, empty and truncated buffers', () => {
    assert.equal(detectFileType(Buffer.from('this is definitely not a video file')), null);
    assert.equal(detectFileType(Buffer.alloc(0)), null);
    assert.equal(detectFileType(Buffer.from([0x89, 0x50])), null);
  });

  it('rejects a QuickTime container renamed to .mp4', () => {
    assert.equal(detectFileType(QUICKTIME_HEADER), null);
  });
});

describe('sanitizeOriginalFilename', () => {
  it('strips directory traversal and control characters', () => {
    assert.equal(sanitizeOriginalFilename('../../etc/passwd'), 'passwd');
    assert.equal(sanitizeOriginalFilename('C:\\Users\\me\\clip.mp4'), 'clip.mp4');
    assert.equal(sanitizeOriginalFilename('bad\u0000name\u001f.mp4'), 'badname.mp4');
  });

  it('falls back to a placeholder and caps very long names', () => {
    assert.equal(sanitizeOriginalFilename('   '), 'unnamed-file');
    assert.equal(sanitizeOriginalFilename(undefined), 'unnamed-file');
    const capped = sanitizeOriginalFilename(`${'a'.repeat(400)}.mp4`);
    assert.ok(capped.length <= 180, `expected at most 180 characters, received ${capped.length}`);
    assert.ok(capped.endsWith('...'));
  });
});


describe('validateUpload - video', () => {
  it('accepts a real MP4', async () => {
    const result = await validateUpload(await upload('video', MP4_HEADER, 'CapCut export.mp4', 'video/mp4'), 'video');
    assert.equal(result.detectedType, 'mp4');
    assert.equal(result.mimeType, 'video/mp4');
    assert.equal(result.extension, '.mp4');
    assert.equal(result.originalFilename, 'CapCut export.mp4');
  });

  it('rejects a non-MP4 extension', async () => {
    const error = await expectAppError(
      validateUpload(await upload('video', MP4_HEADER, 'clip.mov', 'video/quicktime'), 'video'),
    );
    assert.equal(error.status, 415);
  });

  it('rejects a text file renamed to .mp4', async () => {
    const bytes = Buffer.from('MZ this is an exe, not a video');
    const error = await expectAppError(validateUpload(await upload('video', bytes, 'fake.mp4', 'video/mp4'), 'video'));
    assert.equal(error.status, 415);
    assert.match(error.message, /not a supported MP4 video/);
  });

  it('rejects an empty file', async () => {
    const error = await expectAppError(validateUpload(await upload('video', Buffer.alloc(0), 'empty.mp4', 'video/mp4'), 'video'));
    assert.equal(error.status, 400);
  });

  it('rejects a file above the configured maximum size', async () => {
    const file = await upload('video', MP4_HEADER, 'huge.mp4', 'video/mp4', FILE_RULES.video.maxBytes + 1);
    const error = await expectAppError(validateUpload(file, 'video'));
    assert.equal(error.status, 413);
  });

  it('accepts a generic octet-stream MIME when the signature is valid', async () => {
    const result = await validateUpload(await upload('video', MP4_HEADER, 'dragged.mp4', 'application/octet-stream'), 'video');
    assert.equal(result.detectedType, 'mp4');
  });

  it('rejects an unsupported MIME type', async () => {
    const error = await expectAppError(validateUpload(await upload('video', MP4_HEADER, 'clip.mp4', 'text/html'), 'video'));
    assert.equal(error.status, 415);
  });

  it('rejects a QuickTime file with an .mp4 extension', async () => {
    const error = await expectAppError(validateUpload(await upload('video', QUICKTIME_HEADER, 'clip.mp4', 'video/mp4'), 'video'));
    assert.equal(error.status, 415);
  });
});

describe('validateUpload - thumbnail', () => {
  const accepted: [string, Buffer, string, string, string][] = [
    ['JPG', JPEG_HEADER, 'thumb.jpg', 'image/jpeg', 'jpeg'],
    ['JPEG', JPEG_HEADER, 'thumb.jpeg', 'image/jpeg', 'jpeg'],
    ['PNG', PNG_HEADER, 'thumb.png', 'image/png', 'png'],
    ['WebP', WEBP_HEADER, 'thumb.webp', 'image/webp', 'webp'],
  ];

  for (const [label, bytes, filename, mimetype, expected] of accepted) {
    it(`accepts ${label}`, async () => {
      const result = await validateUpload(await upload('thumbnail', bytes, filename, mimetype), 'thumbnail');
      assert.equal(result.detectedType, expected);
    });
  }

  it('rejects an image with an unsupported extension', async () => {
    const error = await expectAppError(validateUpload(await upload('thumbnail', PNG_HEADER, 'thumb.gif', 'image/gif'), 'thumbnail'));
    assert.equal(error.status, 415);
  });

  it('rejects a video disguised as a thumbnail', async () => {
    const error = await expectAppError(validateUpload(await upload('thumbnail', MP4_HEADER, 'thumb.png', 'image/png'), 'thumbnail'));
    assert.equal(error.status, 415);
  });

  it('rejects PNG bytes sent with a .jpg extension', async () => {
    const error = await expectAppError(validateUpload(await upload('thumbnail', PNG_HEADER, 'thumb.jpg', 'image/jpeg'), 'thumbnail'));
    assert.equal(error.status, 415);
    assert.match(error.message, /does not match/);
  });

  it('rejects an oversized thumbnail', async () => {
    const file = await upload('thumbnail', PNG_HEADER, 'thumb.png', 'image/png', FILE_RULES.thumbnail.maxBytes + 1);
    const error = await expectAppError(validateUpload(file, 'thumbnail'));
    assert.equal(error.status, 413);
  });
});

describe('StorageService', () => {
  it('creates the data directory structure', async () => {
    assert.ok(storage.projectsDir.endsWith(path.join('data', 'projects')));
    const { stat } = await import('node:fs/promises');
    assert.ok((await stat(storage.tmpDir)).isDirectory());
  });

  it('refuses storage keys that escape the data directory', () => {
    assert.throws(() => storage.resolveStorageKey('../../windows/system32/config'), AppError);
    assert.throws(() => storage.resolveStorageKey(path.join('..', '..', 'escape.txt')), AppError);
    const safe = storage.resolveStorageKey(path.posix.join('projects', 'abc', 'video.mp4'));
    assert.equal(path.basename(safe), 'video.mp4');
  });

  it('removes stale variants when an asset is replaced', async () => {
    const projectId = 'variant-test';
    const dir = await storage.ensureProjectDir(projectId);
    await writeFile(path.join(dir, 'thumbnail.png'), 'x');
    await writeFile(path.join(dir, 'thumbnail.webp'), 'x');
    await storage.removeOtherVariants(projectId, 'thumbnail', '.webp');
    const remaining = await readdir(dir);
    assert.deepEqual(remaining.sort(), ['thumbnail.webp']);
  });

  it('writes and reads project metadata', async () => {
    const projectId = 'metadata-test';
    await storage.writeMetadata(projectId, {
      id: projectId,
      originalFilename: 'a.mp4',
      status: 'ready',
      video: { file: 'video.mp4', originalFilename: 'a.mp4', sizeBytes: 10, mimeType: 'video/mp4', uploadedAt: 'now' },
      thumbnail: null,
      createdAt: 'now',
      updatedAt: 'now',
    });
    const metadata = await storage.readMetadata(projectId);
    assert.equal(metadata?.video?.file, 'video.mp4');
    assert.equal(metadata?.thumbnail, null);
  });

  it('clears orphaned temp uploads on init', async () => {
    const orphan = storage.tempUploadPath();
    await writeFile(orphan, 'leftover');
    const fresh = new StorageService(path.join(tmpDir, 'data'));
    await fresh.init();
    await assert.rejects(readdir(path.join(fresh.tmpDir, path.basename(orphan))));
  });
});
