import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { after, before, describe, it } from 'node:test';

/**
 * The environment must be configured before the config module is evaluated, so
 * every server module is imported dynamically once the temp dir is known.
 */
const testRoot = await mkdtemp(path.join(os.tmpdir(), 'yac-api-'));
process.env.DATA_DIR = path.join(testRoot, 'data');
process.env.MAX_VIDEO_SIZE_MB = '2';
process.env.MAX_THUMBNAIL_SIZE_MB = '1';
process.env.LOG_LEVEL = 'error';

const { openDatabase } = await import('../src/db/database.js');
const { ProjectsRepository } = await import('../src/db/projectsRepository.js');
const { StorageService } = await import('../src/services/storageService.js');
const { ProjectService } = await import('../src/services/projectService.js');
const { createApp } = await import('../src/app.js');
const { env, databaseFile } = await import('../src/config/env.js');
const { FILE_RULES } = await import('../src/config/limits.js');

const MP4_BYTES = Buffer.concat([
  Buffer.from([0x00, 0x00, 0x00, 0x20]),
  Buffer.from('ftypisom', 'latin1'),
  Buffer.from([0x00, 0x00, 0x02, 0x00]),
  Buffer.from('isomiso2avc1mp41', 'latin1'),
  Buffer.alloc(64 * 1024, 7),
]);
const JPEG_BYTES = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(2048, 3)]);
const PNG_BYTES = Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), Buffer.alloc(1024, 5)]);
const WEBP_BYTES = Buffer.concat([
  Buffer.from('RIFF', 'latin1'),
  Buffer.from([0x1a, 0x00, 0x00, 0x00]),
  Buffer.from('WEBPVP8 ', 'latin1'),
  Buffer.alloc(512, 9),
]);

let server: Server;
let baseUrl: string;
let storage: StorageService;
let db: ReturnType<typeof openDatabase>;

before(async () => {
  storage = new StorageService(env.dataDir);
  await storage.init();
  db = openDatabase(databaseFile);
  const service = new ProjectService(new ProjectsRepository(db), storage);
  server = createApp(service, storage).listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  db.close();
  await rm(testRoot, { recursive: true, force: true });
});

interface ApiResult<T = any> {
  status: number;
  body: T;
  headers: Headers;
}

async function api<T = any>(pathname: string, init?: RequestInit): Promise<ApiResult<T>> {
  const response = await fetch(`${baseUrl}${pathname}`, init);
  const text = await response.text();
  return { status: response.status, body: (text ? JSON.parse(text) : null) as T, headers: response.headers };
}

async function postFile(pathname: string, bytes: Buffer, filename: string, mimeType: string) {
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(bytes)], { type: mimeType }), filename);
  return api(pathname, { method: 'POST', body: form });
}

async function createProject(): Promise<any> {
  const created = await api('/api/projects', { method: 'POST' });
  assert.equal(created.status, 201);
  return created.body;
}

function projectDir(id: string): string {
  return path.join(env.dataDir, 'projects', id);
}

describe('GET /api/health', () => {
  it('reports ok with real limits and explicitly disabled future capabilities', async () => {
    const { status, body } = await api('/api/health');
    assert.equal(status, 200);
    assert.equal(body.status, 'ok');
    assert.equal(body.limits.maxVideoSizeBytes, FILE_RULES.video.maxBytes);
    assert.deepEqual(body.limits.videoExtensions, ['.mp4']);
    assert.deepEqual(body.limits.thumbnailExtensions, ['.jpg', '.jpeg', '.png', '.webp']);
    assert.deepEqual(body.capabilities, {
      videoAnalysis: false,
      aiContentGeneration: false,
      youtubePublish: false,
      composioIntegration: false,
    });
  });
});

describe('POST /api/projects', () => {
  it('creates a draft project with a UUID, a local folder and metadata', async () => {
    const project = await createProject();
    assert.match(project.id, /^[0-9a-f-]{36}$/);
    assert.equal(project.status, 'draft');
    assert.equal(project.video.storageKey, null);
    assert.equal(project.thumbnail.storageKey, null);
    assert.ok(Date.parse(project.createdAt));
    assert.ok(Date.parse(project.updatedAt));
    assert.ok((await stat(projectDir(project.id))).isDirectory());
    const metadata = JSON.parse(await readFile(path.join(projectDir(project.id), 'metadata.json'), 'utf8'));
    assert.equal(metadata.id, project.id);
  });
});


describe('project file uploads', () => {
  it('stores the MP4 on disk, records the path and keeps the database lean', async () => {
    const project = await createProject();
    const { status, body } = await postFile(
      `/api/projects/${project.id}/video`,
      MP4_BYTES,
      'CapCut export.mp4',
      'video/mp4',
    );
    assert.equal(status, 200);
    assert.equal(body.status, 'draft', 'still a draft until the thumbnail arrives');
    assert.equal(body.video.storageKey, `projects/${project.id}/video.mp4`);
    assert.equal(body.video.originalFilename, 'CapCut export.mp4');
    assert.equal(body.video.sizeBytes, MP4_BYTES.length);
    assert.equal(body.video.mimeType, 'video/mp4');
    assert.equal(body.originalFilename, 'CapCut export.mp4');
    assert.deepEqual(await readFile(path.join(projectDir(project.id), 'video.mp4')), MP4_BYTES);

    const row = db
      .prepare('SELECT video_path, video_size_bytes, video_mime_type, video_uploaded_at, created_at, updated_at FROM projects WHERE id = ?')
      .get(project.id) as Record<string, unknown>;
    assert.equal(row.video_path, `projects/${project.id}/video.mp4`);
    assert.equal(row.video_size_bytes, MP4_BYTES.length);
    assert.equal(row.video_mime_type, 'video/mp4');
    assert.ok(row.video_uploaded_at && row.created_at && row.updated_at);
  });

  it('marks the project ready once both files are present', async () => {
    const project = await createProject();
    await postFile(`/api/projects/${project.id}/video`, MP4_BYTES, 'a.mp4', 'video/mp4');
    const { body } = await postFile(`/api/projects/${project.id}/thumbnail`, JPEG_BYTES, 'thumb.jpg', 'image/jpeg');
    assert.equal(body.status, 'ready');
    assert.equal(body.thumbnail.storageKey, `projects/${project.id}/thumbnail.jpg`);
    const { status, body: fetched } = await api(`/api/projects/${project.id}`);
    assert.equal(status, 200);
    assert.equal(fetched.status, 'ready');
  });

  for (const [label, bytes, filename, mime] of [
    ['jpg', JPEG_BYTES, 't.jpg', 'image/jpeg'],
    ['jpeg', JPEG_BYTES, 't.jpeg', 'image/jpeg'],
    ['png', PNG_BYTES, 't.png', 'image/png'],
    ['webp', WEBP_BYTES, 't.webp', 'image/webp'],
  ] as const) {
    it(`accepts a ${label.toUpperCase()} thumbnail`, async () => {
      const project = await createProject();
      const { status, body } = await postFile(`/api/projects/${project.id}/thumbnail`, bytes, filename, mime);
      assert.equal(status, 200);
      const stored = path.join(projectDir(project.id), `thumbnail.${label === 'jpeg' ? 'jpg' : label}`);
      assert.ok((await stat(stored)).isFile());
      assert.equal(body.status, 'draft');
    });
  }

  it('replaces an existing asset and removes the stale file', async () => {
    const project = await createProject();
    await postFile(`/api/projects/${project.id}/thumbnail`, PNG_BYTES, 't.png', 'image/png');
    const { body } = await postFile(`/api/projects/${project.id}/thumbnail`, JPEG_BYTES, 't.jpg', 'image/jpeg');
    assert.equal(body.thumbnail.storageKey, `projects/${project.id}/thumbnail.jpg`);
    const files = await readdir(projectDir(project.id));
    assert.ok(files.includes('thumbnail.jpg'));
    assert.ok(!files.includes('thumbnail.png'), 'the stale .png must be deleted');
  });

  it('never trusts the client filename when writing to disk', async () => {
    const project = await createProject();
    await postFile(`/api/projects/${project.id}/video`, MP4_BYTES, '../../../evil.mp4', 'video/mp4');
    const files = await readdir(projectDir(project.id));
    assert.deepEqual(files.filter((file) => file.startsWith('video')), ['video.mp4']);
  });
});

describe('local file serving', () => {
  it('serves the video with the right MIME type and supports range requests', async () => {
    const project = await createProject();
    await postFile(`/api/projects/${project.id}/video`, MP4_BYTES, 'a.mp4', 'video/mp4');

    const full = await fetch(`${baseUrl}/api/projects/${project.id}/video`);
    assert.equal(full.status, 200);
    assert.equal(full.headers.get('content-type'), 'video/mp4');
    assert.deepEqual(Buffer.from(await full.arrayBuffer()), MP4_BYTES);

    const partial = await fetch(`${baseUrl}/api/projects/${project.id}/video`, { headers: { Range: 'bytes=0-99' } });
    assert.equal(partial.status, 206);
    assert.equal(partial.headers.get('content-range'), `bytes 0-99/${MP4_BYTES.length}`);
  });

  it('returns 404 for an asset that was never uploaded', async () => {
    const project = await createProject();
    const { status, body } = await api(`/api/projects/${project.id}/video`);
    assert.equal(status, 404);
    assert.equal(body.error.code, 'NOT_FOUND');
  });
});


describe('validation and error handling', () => {
  it('rejects a text file renamed to .mp4 and leaves the project unchanged', async () => {
    const project = await createProject();
    const { status, body } = await postFile(
      `/api/projects/${project.id}/video`,
      Buffer.from('not a video'),
      'fake.mp4',
      'video/mp4',
    );
    assert.equal(status, 415);
    assert.equal(body.error.code, 'UNSUPPORTED_MEDIA_TYPE');

    const { body: current } = await api(`/api/projects/${project.id}`);
    assert.equal(current.status, 'draft');
    assert.equal(current.video.storageKey, null);
    const files = await readdir(projectDir(project.id));
    assert.ok(!files.some((file) => file.startsWith('video')));
  });

  it('rejects a disallowed extension', async () => {
    const project = await createProject();
    const { status } = await postFile(`/api/projects/${project.id}/video`, MP4_BYTES, 'clip.mov', 'video/quicktime');
    assert.equal(status, 415);
  });

  it('rejects a video above the configured size limit and sweeps the temp file', async () => {
    const project = await createProject();
    const oversized = Buffer.concat([MP4_BYTES, Buffer.alloc(3 * 1024 * 1024)]);
    const { status, body } = await postFile(`/api/projects/${project.id}/video`, oversized, 'big.mp4', 'video/mp4');
    assert.equal(status, 413);
    assert.equal(body.error.code, 'PAYLOAD_TOO_LARGE');

    await new Promise((resolve) => setTimeout(resolve, 200));
    assert.deepEqual(await readdir(storage.tmpDir), [], 'no partial upload may be left in the temp dir');
  });

  it('rejects a request whose file field is missing or misnamed', async () => {
    const project = await createProject();
    const form = new FormData();
    form.append('notfile', 'x');
    const { status, body } = await api(`/api/projects/${project.id}/video`, { method: 'POST', body: form });
    assert.equal(status, 400);
    // multer reports an unexpected field; either way the request is refused
    // with a 4xx and a machine-readable code rather than a 500.
    assert.ok(['UPLOAD_ERROR', 'VALIDATION_ERROR'].includes(body.error.code), body.error.code);
  });

  it('rejects a non-UUID project id', async () => {
    const { status, body } = await api('/api/projects/..%2F..%2Fetc');
    assert.equal(status, 400);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
  });

  it('returns 404 for an unknown but well-formed id', async () => {
    const { status, body } = await api('/api/projects/11111111-2222-4333-8444-555555555555');
    assert.equal(status, 404);
    assert.equal(body.error.code, 'NOT_FOUND');
  });

  it('returns a structured 404 for unknown routes', async () => {
    const { status, body } = await api('/api/does-not-exist');
    assert.equal(status, 404);
    assert.equal(body.error.code, 'NOT_FOUND');
  });

  it('rejects a non-numeric limit query parameter', async () => {
    const { status } = await api('/api/projects?limit=abc');
    assert.equal(status, 400);
  });
});

describe('list and delete', () => {
  it('lists projects newest first with a total count', async () => {
    const first = await createProject();
    const second = await createProject();
    const { body } = await api('/api/projects');
    assert.ok(body.total >= 2);
    const ids = body.items.map((item: any) => item.id);
    assert.ok(ids.indexOf(second.id) < ids.indexOf(first.id), 'newest project first');
  });

  it('paginates', async () => {
    const { body } = await api('/api/projects?limit=1&offset=0');
    assert.equal(body.items.length, 1);
    assert.equal(body.limit, 1);
    assert.equal(body.offset, 0);
  });

  it('deletes the record and the local folder', async () => {
    const project = await createProject();
    await postFile(`/api/projects/${project.id}/video`, MP4_BYTES, 'a.mp4', 'video/mp4');
    const { status } = await api(`/api/projects/${project.id}`, { method: 'DELETE' });
    assert.equal(status, 204);
    await assert.rejects(stat(projectDir(project.id)));
    const { body } = await api(`/api/projects/${project.id}`);
    assert.equal(body.error.code, 'NOT_FOUND');
  });
});

describe('duplicate and rapid submissions', () => {
  it('serialises concurrent uploads of the same asset and stays consistent', async () => {
    const project = await createProject();
    const results = await Promise.all([
      postFile(`/api/projects/${project.id}/video`, MP4_BYTES, 'first.mp4', 'video/mp4'),
      postFile(`/api/projects/${project.id}/video`, MP4_BYTES, 'second.mp4', 'video/mp4'),
      postFile(`/api/projects/${project.id}/video`, MP4_BYTES, 'third.mp4', 'video/mp4'),
    ]);
    for (const result of results) assert.equal(result.status, 200);

    const { body } = await api(`/api/projects/${project.id}`);
    assert.equal(body.status, 'draft');
    assert.equal(body.video.storageKey, `projects/${project.id}/video.mp4`);
    assert.deepEqual(
      await readFile(path.join(projectDir(project.id), 'video.mp4')),
      MP4_BYTES,
      'the stored file must match the recorded asset',
    );
    const files = await readdir(projectDir(project.id));
    assert.equal(files.filter((file) => file.startsWith('video')).length, 1);
  });

  it('keeps the temp directory clean across repeated uploads', async () => {
    const project = await createProject();
    for (let i = 0; i < 3; i += 1) {
      await postFile(`/api/projects/${project.id}/thumbnail`, PNG_BYTES, `t${i}.png`, 'image/png');
    }
    assert.deepEqual(await readdir(storage.tmpDir), []);
  });
});
