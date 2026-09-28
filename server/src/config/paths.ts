import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * Locates the repository root by walking up until a package.json declaring
 * npm workspaces is found. This keeps paths correct both for `tsx src/...`
 * during development and for `dist/...` after a build, and it keeps every
 * runtime artefact (database, uploads) inside the project directory.
 */
function findRepoRoot(startDir: string): string {
  let dir = startDir;
  for (;;) {
    const pkgPath = path.join(dir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { workspaces?: unknown };
        if (pkg.workspaces) return dir;
      } catch {
        // Unreadable package.json - keep walking up.
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) return startDir;
    dir = parent;
  }
}

export const repoRoot = findRepoRoot(moduleDir);
export const clientDistDir = path.join(repoRoot, 'client', 'dist');
