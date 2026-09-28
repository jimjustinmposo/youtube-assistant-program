import path from 'node:path';
import { loadLocalEnv } from './loadEnv.js';
import { clientDistDir, repoRoot } from './paths.js';

loadLocalEnv();

const MEGABYTE = 1024 * 1024;

function readString(name: string, fallback: string): string {
  const raw = process.env[name];
  return raw !== undefined && raw.trim().length > 0 ? raw.trim() : fallback;
}

/** Reads a strictly positive numeric variable, failing fast on bad input. */
function readPositiveNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim().length === 0) return fallback;
  const value = Number(raw.trim());
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid ${name}: expected a positive number, received "${raw}".`);
  }
  return value;
}

const nodeEnv = readString('NODE_ENV', 'development');
const dataDirValue = readString('DATA_DIR', './data');

/** All runtime configuration in one place - never inline env reads elsewhere. */
export const env = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  port: Math.trunc(readPositiveNumber('PORT', 4000)),
  /** Loopback only: this is a local application, never a public service. */
  host: readString('HOST', '127.0.0.1'),
  repoRoot,
  dataDir: path.isAbsolute(dataDirValue) ? dataDirValue : path.resolve(repoRoot, dataDirValue),
  clientDistDir,
  maxVideoSizeBytes: Math.trunc(readPositiveNumber('MAX_VIDEO_SIZE_MB', 4096) * MEGABYTE),
  maxThumbnailSizeBytes: Math.trunc(readPositiveNumber('MAX_THUMBNAIL_SIZE_MB', 10) * MEGABYTE),
  appName: 'youtube-content-assistant',
  appVersion: '0.1.0',
  currentPhase: 'Phase 1 - Local Foundation + Upload',
} as const;

export const databaseFile = path.join(env.dataDir, 'youtube-assistant.db');
