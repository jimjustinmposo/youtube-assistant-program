import fs from 'node:fs';
import path from 'node:path';
import { repoRoot } from './paths.js';

/**
 * Loads the repository-level .env file using the Node built-in loader, so no
 * dotenv dependency is required. Imported for its side effect before any other
 * configuration module reads process.env.
 */
export function loadLocalEnv(): void {
  const envFile = path.join(repoRoot, '.env');
  if (!fs.existsSync(envFile)) return;
  try {
    process.loadEnvFile(envFile);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // A malformed .env should be loud, but it must not crash module loading.
    console.warn(`[config] Could not parse ${envFile}: ${message}`);
  }
}
