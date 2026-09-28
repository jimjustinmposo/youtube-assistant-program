/**
 * End-to-end smoke test against the BUILT server and BUILT client.
 * Start the server first (npm start), then: node scripts/e2e-check.mjs
 */
import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const base = `http://127.0.0.1:${process.env.PORT ?? 4000}`;
const results = [];

const check = (name, condition, detail = '') => {
  results.push({ name, ok: Boolean(condition) });
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}${detail ? ` :: ${detail}` : ''}`);
};

/** Valid ISO base media header so the server's signature check accepts it. */
const mp4 = Buffer.concat([
  Buffer.from([0x00, 0x00, 0x00, 0x20]),
  Buffer.from('ftypisom', 'latin1'),
  Buffer.from([0x00, 0x00, 0x02, 0x00]),
  Buffer.from('isomiso2avc1mp41', 'latin1'),
  Buffer.alloc(2048, 9),
]);

/** Genuine 1x1 PNG. */
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const post = async (url, bytes, filename, type) => {
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(bytes)], { type }), filename);
  const response = await fetch(`${base}${url}`, { method: 'POST', body: form });
  return { status: response.status, body: await response.json() };
};

const health = await (await fetch(`${base}/api/health`)).json();
check('backend health reachable', health.status === 'ok');
check('future capabilities are all false', Object.values(health.capabilities).every((value) => value === false));

const indexResponse = await fetch(base);
const indexHtml = await indexResponse.text();
check('built SPA is served by the local process', indexResponse.status === 200 && indexHtml.includes('<div id="root">'));
const deepLink = await fetch(`${base}/projects`);
check('SPA deep link falls back to index.html', deepLink.status === 200);

const createdResponse = await fetch(`${base}/api/projects`, { method: 'POST' });
const created = await createdResponse.json();
check('project created as draft with a UUID', created.status === 'draft' && /^[0-9a-f-]{36}$/.test(created.id));

const withVideo = await post(`/api/projects/${created.id}/video`, mp4, 'jollibee.mp4', 'video/mp4');
check('MP4 accepted', withVideo.status === 200, JSON.stringify(withVideo.body?.error ?? ''));
check('status stays draft with video only', withVideo.body.status === 'draft');

const withThumbnail = await post(`/api/projects/${created.id}/thumbnail`, png, 'thumb.png', 'image/png');
check('PNG thumbnail accepted', withThumbnail.status === 200);
check('status becomes ready with both files', withThumbnail.body.status === 'ready');

const videoResponse = await fetch(`${base}/api/projects/${created.id}/video`);
check('video streams as video/mp4', videoResponse.headers.get('content-type') === 'video/mp4');
const thumbnailResponse = await fetch(`${base}/api/projects/${created.id}/thumbnail`);
check('thumbnail streams as image/png', thumbnailResponse.headers.get('content-type') === 'image/png');
const rangeResponse = await fetch(`${base}/api/projects/${created.id}/video`, { headers: { Range: 'bytes=0-15' } });
check('range request returns 206 (seeking works)', rangeResponse.status === 206);

const rejected = await post(`/api/projects/${created.id}/video`, Buffer.from('nope'), 'fake.mp4', 'video/mp4');
check('text file renamed to .mp4 is rejected', rejected.status === 415, rejected.body?.error?.message ?? '');

const afterRejection = await (await fetch(`${base}/api/projects/${created.id}`)).json();
check('rejected upload left the project untouched', afterRejection.status === 'ready' && afterRejection.video.storageKey !== null);

const dataDir = health.storage.dataDir;
const folder = path.join(dataDir, 'projects', created.id);
const entries = await readdir(folder);
check(
  'project folder holds video, thumbnail and metadata.json',
  entries.includes('video.mp4') && entries.includes('thumbnail.png') && entries.includes('metadata.json'),
  entries.join(', '),
);
check('stored video is byte-identical to the upload', (await readFile(path.join(folder, 'video.mp4'))).equals(mp4));

const metadata = JSON.parse(await readFile(path.join(folder, 'metadata.json'), 'utf8'));
check(
  'metadata.json records both assets',
  metadata.video?.originalFilename === 'jollibee.mp4' && metadata.thumbnail?.originalFilename === 'thumb.png',
);

const databasePath = path.join(dataDir, 'youtube-assistant.db');
const databaseStat = await stat(databasePath);
check('SQLite database file created', databaseStat.size > 0, `${databaseStat.size} bytes`);
check(
  'database carries the SQLite magic header',
  (await readFile(databasePath)).subarray(0, 15).toString('latin1') === 'SQLite format 3',
);

const tempEntries = await readdir(path.join(dataDir, 'tmp'));
check('temp upload directory is clean', tempEntries.length === 0, tempEntries.join(', '));

const deleted = await fetch(`${base}/api/projects/${created.id}`, { method: 'DELETE' });
check('project deleted', deleted.status === 204);
let folderRemoved = false;
try {
  await stat(folder);
} catch {
  folderRemoved = true;
}
check('project folder removed from disk', folderRemoved);
const gone = await fetch(`${base}/api/projects/${created.id}`);
check('deleted project returns 404', gone.status === 404);

const listAfterDelete = await (await fetch(`${base}/api/projects`)).json();
check('deleted project is gone from the list', !listAfterDelete.items.some((item) => item.id === created.id));

const failed = results.filter((result) => !result.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length > 0) {
  console.log(`FAILED: ${failed.map((result) => result.name).join('; ')}`);
  process.exit(1);
}
