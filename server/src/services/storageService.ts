import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { badRequest } from '../errors/AppError.js';
import { logger } from '../utils/logger.js';

/** Per-project folder contents, mirrored to metadata.json for portability. */
export interface ProjectMetadata {
  id: string;
  originalFilename: string | null;
  status: string;
  video: ProjectMetadataAsset | null;
  thumbnail: ProjectMetadataAsset | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMetadataAsset {
  file: string;
  originalFilename: string;
  sizeBytes: number;
  mimeType: string;
  uploadedAt: string;
}

const METADATA_FILENAME = 'metadata.json';

/**
 * Owns everything on disk. The database only ever stores storage keys, never
 * large media blobs. All paths are derived from server-generated ids and
 * fixed filenames - never from a client-supplied filename.
 */
export class StorageService {
  readonly dataDir: string;
  readonly projectsDir: string;
  readonly tmpDir: string;

  constructor(dataDir: string) {
    this.dataDir = path.resolve(dataDir);
    this.projectsDir = path.join(this.dataDir, 'projects');
    this.tmpDir = path.join(this.dataDir, 'tmp');
  }

  async init(): Promise<void> {
    await fsp.mkdir(this.projectsDir, { recursive: true });
    await fsp.mkdir(this.tmpDir, { recursive: true });
    await this.clearTmp();
  }

  projectDir(projectId: string): string {
    return path.join(this.projectsDir, projectId);
  }

  /** Temporary upload destination; multer writes here with random names. */
  tempUploadPath(): string {
    return path.join(this.tmpDir, `upload-${randomUUID()}`);
  }

  storageKey(projectId: string, fileName: string): string {
    return path.posix.join('projects', projectId, fileName);
  }

  /**
   * Resolves a stored key to an absolute path, refusing anything that would
   * escape the data directory.
   */
  resolveStorageKey(storageKey: string): string {
    const absolute = path.resolve(this.dataDir, storageKey);
    const relative = path.relative(this.dataDir, absolute);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw badRequest('Invalid storage key.');
    }
    return absolute;
  }

  filePath(projectId: string, fileName: string): string {
    return path.join(this.projectDir(projectId), fileName);
  }

  async ensureProjectDir(projectId: string): Promise<string> {
    const dir = this.projectDir(projectId);
    await fsp.mkdir(dir, { recursive: true });
    return dir;
  }

  async removeQuietly(target: string, options?: { recursive?: boolean }): Promise<void> {
    try {
      await fsp.rm(target, { force: true, recursive: options?.recursive ?? false });
    } catch (error) {
      logger.warn(`Could not remove ${target}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /** Deletes stale files, e.g. thumbnail.png after a replacement with .webp. */
  async removeOtherVariants(projectId: string, baseName: string, keepExtension: string): Promise<void> {
    const dir = this.projectDir(projectId);
    if (!fs.existsSync(dir)) return;
    const entries = await fsp.readdir(dir);
    await Promise.all(
      entries
        .filter((entry) => entry.startsWith(`${baseName}.`) && entry !== `${baseName}${keepExtension}`)
        .map((entry) => this.removeQuietly(path.join(dir, entry))),
    );
  }

  async writeMetadata(projectId: string, metadata: ProjectMetadata): Promise<void> {
    const dir = await this.ensureProjectDir(projectId);
    const target = path.join(dir, METADATA_FILENAME);
    const temp = `${target}.${randomUUID()}.tmp`;
    await fsp.writeFile(temp, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
    await fsp.rename(temp, target);
  }

  async readMetadata(projectId: string): Promise<ProjectMetadata | null> {
    try {
      const raw = await fsp.readFile(path.join(this.projectDir(projectId), METADATA_FILENAME), 'utf8');
      return JSON.parse(raw) as ProjectMetadata;
    } catch {
      return null;
    }
  }

  /** Removes the whole project folder from disk. */
  async removeProject(projectId: string): Promise<void> {
    await this.removeQuietly(this.projectDir(projectId), { recursive: true });
  }

  /**
   * Removes temp uploads created at or after `sinceMs`. Used to clean up
   * partially written files when multer aborts an oversized upload, where the
   * request never reaches us with a usable file path.
   */
  async removeTmpFilesSince(sinceMs: number): Promise<void> {
    let entries: string[];
    try {
      entries = await fsp.readdir(this.tmpDir);
    } catch {
      return;
    }
    await Promise.all(
      entries.map(async (entry) => {
        const target = path.join(this.tmpDir, entry);
        try {
          const stats = await fsp.stat(target);
          if (stats.mtimeMs >= sinceMs) await this.removeQuietly(target);
        } catch {
          // Entry disappeared between readdir and stat - nothing to do.
        }
      }),
    );
  }

  /** Best-effort cleanup of orphaned temp uploads from previous sessions. */
  async clearTmp(): Promise<void> {
    await this.removeTmpFilesSince(0);
  }
}
