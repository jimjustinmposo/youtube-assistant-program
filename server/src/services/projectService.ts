import path from 'node:path';
import { badRequest, notFound } from '../errors/AppError.js';
import { createProjectId } from '../utils/ids.js';
import { logger } from '../utils/logger.js';
import { ProjectsRepository } from '../db/projectsRepository.js';
import { StorageService, type ProjectMetadata, type ProjectMetadataAsset } from './storageService.js';
import { validateUpload, type TempUploadFile } from './uploadValidator.js';
import { EXTENSION_BY_TYPE } from './fileSignature.js';
import type { Project, ProjectListQuery, ProjectListResult } from '../types/project.js';

const STORED_BASENAME = { video: 'video', thumbnail: 'thumbnail' } as const;
const MAX_LIST_LIMIT = 200;

const DEFAULT_LIST_LIMIT = 50;

/** Business logic for projects. No HTTP concerns live here. */
export class ProjectService {
  /**
   * Serialises uploads per project id. Without it, two rapid submissions (for
   * example a double click, or a retry racing the original request) could
   * interleave file moves and status updates.
   */
  private readonly projectLocks = new Map<string, Promise<unknown>>();

  constructor(
    private readonly repository: ProjectsRepository,
    private readonly storage: StorageService,
  ) {}

  list(query: Partial<ProjectListQuery> = {}): ProjectListResult {
    const limit = Math.min(Math.max(query.limit ?? DEFAULT_LIST_LIMIT, 1), MAX_LIST_LIMIT);
    const offset = Math.max(query.offset ?? 0, 0);
    return this.repository.list({ limit, offset });
  }

  get(projectId: string): Project {
    return this.repository.findByIdOrThrow(projectId);
  }

  async create(): Promise<Project> {
    const now = new Date().toISOString();
    const project: Project = {
      id: createProjectId(),
      originalFilename: null,
      status: 'draft',
      video: emptyAsset(),
      thumbnail: emptyAsset(),
      lastError: null,
      createdAt: now,
      updatedAt: now,
    };
    this.repository.insert(project);
    await this.storage.ensureProjectDir(project.id);
    await this.writeMetadata(project);
    return project;
  }

  async attachVideo(projectId: string, file: TempUploadFile): Promise<Project> {
    return this.attach(projectId, 'video', file);
  }

  async attachThumbnail(projectId: string, file: TempUploadFile): Promise<Project> {
    return this.attach(projectId, 'thumbnail', file);
  }

  /** Streams a stored asset for local preview (video playback, thumbnail). */
  getAssetPath(projectId: string, kind: 'video' | 'thumbnail'): { absolutePath: string; mimeType: string } {
    const project = this.get(projectId);
    const asset = kind === 'video' ? project.video : project.thumbnail;
    if (!asset.storageKey || !asset.mimeType) {
      throw notFound(`This project has no ${kind} yet.`);
    }
    const absolutePath = this.storage.resolveStorageKey(asset.storageKey);
    return { absolutePath, mimeType: asset.mimeType };
  }

  async remove(projectId: string): Promise<void> {
    const project = this.get(projectId);
    this.repository.delete(project.id);
    await this.storage.removeProject(project.id);
  }

  private async attach(projectId: string, kind: 'video' | 'thumbnail', file: TempUploadFile): Promise<Project> {
    // Validate before touching project state so a rejected file leaves the
    // project exactly as it was.
    const validated = await validateUpload(file, kind);
    return this.withProjectLock(projectId, async () => {
      const project = this.get(projectId);
      this.repository.setStatus(project.id, 'uploading');

      const storedFileName = `${STORED_BASENAME[kind]}${EXTENSION_BY_TYPE[validated.detectedType]}`;
      const destination = this.storage.filePath(project.id, storedFileName);

      await this.storage.ensureProjectDir(project.id);
      await moveIntoPlace(file.path, destination);
      await this.storage.removeOtherVariants(
        project.id,
        STORED_BASENAME[kind],
        EXTENSION_BY_TYPE[validated.detectedType],
      );

      const updated = this.repository.setAsset(project.id, kind, {
        storageKey: this.storage.storageKey(project.id, storedFileName),
        originalFilename: validated.originalFilename,
        sizeBytes: validated.sizeBytes,
        mimeType: validated.mimeType,
        uploadedAt: new Date().toISOString(),
      });

      const saved = this.get(project.id);
      await this.writeMetadata(saved);
      logger.info(`Stored ${kind} for project ${project.id} (${validated.mimeType}, ${validated.sizeBytes} bytes)`);
      return updated;
    });
  }

  /** Runs `task` after any in-flight task for the same project id. */
  private withProjectLock<T>(projectId: string, task: () => Promise<T>): Promise<T> {
    const previous = this.projectLocks.get(projectId) ?? Promise.resolve();
    const result = previous.then(task, task);
    const settled = result.then(
      () => undefined,
      () => undefined,
    );
    this.projectLocks.set(projectId, settled);
    void settled.then(() => {
      if (this.projectLocks.get(projectId) === settled) this.projectLocks.delete(projectId);
    });
    return result;
  }

  private async writeMetadata(project: Project): Promise<void> {
    const metadata: ProjectMetadata = {
      id: project.id,
      originalFilename: project.originalFilename,
      status: project.status,
      video: toMetadataAsset(project.video.storageKey, project.video),
      thumbnail: toMetadataAsset(project.thumbnail.storageKey, project.thumbnail),
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };
    await this.storage.writeMetadata(project.id, metadata);
  }
}

function emptyAsset() {
  return { storageKey: null, originalFilename: null, sizeBytes: null, mimeType: null, uploadedAt: null };
}

function toMetadataAsset(storageKey: string | null, asset: Project['video']): ProjectMetadataAsset | null {
  if (!storageKey || !asset.originalFilename || asset.sizeBytes === null || !asset.mimeType || !asset.uploadedAt) {
    return null;
  }
  return {
    file: path.basename(storageKey),
    originalFilename: asset.originalFilename,
    sizeBytes: asset.sizeBytes,
    mimeType: asset.mimeType,
    uploadedAt: asset.uploadedAt,
  };
}

async function moveIntoPlace(source: string, destination: string): Promise<void> {
  try {
    await fsRename(source, destination);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EXDEV') throw error;
    // Different volumes (rare on Windows): fall back to copy + delete.
    const { copyFile, unlink } = await import('node:fs/promises');
    await copyFile(source, destination);
    await unlink(source);
  }
}

async function fsRename(source: string, destination: string): Promise<void> {
  const { rename } = await import('node:fs/promises');
  await rename(source, destination);
}

export { badRequest };
