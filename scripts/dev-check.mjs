/**
 * Dev-mode integration check: the Vite dev server on :3000 and its /api proxy
 * to the local backend on :4000. Run `npm run dev` first, then:
 *   node scripts/dev-check.mjs
 */
const frontend = `http://127.0.0.1:${process.env.VITE_PORT ?? 3000}`;
const backend = `http://127.0.0.1:${process.env.PORT ?? 4000}`;
const results = [];

const check = (name, condition, detail = '') => {
  results.push({ name, ok: Boolean(condition) });
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}${detail ? ` :: ${detail}` : ''}`);
};

const page = await fetch(frontend);
const html = await page.text();
check('frontend dev server responds on :3000', page.status === 200);
check('frontend serves the React root element', html.includes('<div id="root">'));
check('frontend injects the Vite client entry', /\/src\/main\.tsx/.test(html));

const direct = await (await fetch(`${backend}/api/health`)).json();
check('backend responds directly on :4000', direct.status === 'ok');

const proxied = await (await fetch(`${frontend}/api/health`)).json();
check('frontend can reach the backend through the /api proxy', proxied.status === 'ok');
check('proxied health reports the same phase', proxied.phase === direct.phase);

// A full create + upload round trip through the proxy only.
const created = await (await fetch(`${frontend}/api/projects`, { method: 'POST' })).json();
check('project can be created through the proxy', typeof created.id === 'string' && created.status === 'draft');

const form = new FormData();
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
form.append('file', new Blob([new Uint8Array(png)], { type: 'image/png' }), 'proxy-test.png');
const upload = await fetch(`${frontend}/api/projects/${created.id}/thumbnail`, { method: 'POST', body: form });
check('thumbnail can be uploaded through the proxy', upload.status === 200);

const fetched = await (await fetch(`${frontend}/api/projects/${created.id}`)).json();
check('uploaded thumbnail is recorded', fetched.thumbnail.storageKey !== null);

await fetch(`${frontend}/api/projects/${created.id}`, { method: 'DELETE' });

const failed = results.filter((result) => !result.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length > 0) {
  console.log(`FAILED: ${failed.map((result) => result.name).join('; ')}`);
  process.exit(1);
}
