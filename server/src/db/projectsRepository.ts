import { createProjectId } from '../utils/ids.js';
import { notFound } from '../errors/AppError.js';
import type { AppDatabase } from './database.js';
import type { Project, ProjectAsset, ProjectListQuery, ProjectListResult, ProjectStatus } from '../types/project.js';

type Row = Record<string, unknown>;

const SELECT_COLUMNS = `
  id, original_filename,
  video_path, video_filename, video_size_bytes, video_mime_type, video_uploaded_at,
  thumbnail_path, thumbnail_filename, thumbnail_size_bytes, thumbnail_mime_type, thumbnail_uploaded_at,
  status, last_error, created_at, updated_at
`;

function toNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function toNullableNumber(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}

function toAsset(row: Row, prefix: 'video' | 'thumbnail'): ProjectAsset {
  return {
    storageKey: toNullableString(row[`${prefix}_path`]),
    originalFilename: toNullableString(row[`${prefix}_filename`]),
    sizeBytes: toNullableNumber(row[`${prefix}_size_bytes`]),
    mimeType: toNullableString(row[`${prefix}_mime_type`]),
    uploadedAt: toNullableString(row[`${prefix}_uploaded_at`]),
  };
}

function toProject(row: Row): Project {
  return {
    id: String(row.id),
    originalFilename: toNullableString(row.original_filename),
    status: String(row.status) as ProjectStatus,
    video: toAsset(row, 'video'),
    thumbnail: toAsset(row, 'thumbnail'),
    lastError: toNullableString(row.last_error),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export interface ProjectAssetUpdate {
  storageKey: string;
  originalFilename: string;
  sizeBytes: number;
  mimeType: string;
  uploadedAt: string;
}

export class ProjectsRepository {
  constructor(private readonly db: AppDatabase) {}

  insert(project: Project): Project {
    this.db
      .prepare(
        `INSERT INTO projects (id, original_filename, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        project.id,
        project.originalFilename,
        project.status,
        project.createdAt,
        project.updatedAt,
      );
    return project;
  }

  findById(id: string): Project | null {
    const row = this.db
      .prepare(`SELECT ${SELECT_COLUMNS} FROM projects WHERE id = ?`)
      .get(id) as Row | undefined;
    return row ? toProject(row) : null;
  }

  findByIdOrThrow(id: string): Project {
    const project = this.findById(id);
    if (!project) throw notFound(`Project ${id} was not found.`);
    return project;
  }

  list({ limit, offset }: ProjectListQuery): ProjectListResult {
    const rows = this.db
      .prepare(`SELECT ${SELECT_COLUMNS} FROM projects ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`)
      .all(limit, offset) as Row[];
    const { total } = this.db.prepare('SELECT COUNT(*) AS total FROM projects').get() as { total: number };
    return { items: rows.map(toProject), total, limit, offset };
  }

  setStatus(id: string, status: ProjectStatus, lastError: string | null = null, now = new Date().toISOString()): void {
    this.db
      .prepare('UPDATE projects SET status = ?, last_error = ?, updated_at = ? WHERE id = ?')
      .run(status, lastError, now, id);
  }

  /** Persists a validated asset and recomputes the project status. */
  setAsset(id: string, kind: 'video' | 'thumbnail', asset: ProjectAssetUpdate, now = new Date().toISOString()): Project {
    const statement = this.db.prepare(
      `UPDATE projects
          SET ${kind}_path = ?, ${kind}_filename = ?, ${kind}_size_bytes = ?, ${kind}_mime_type = ?,
              ${kind}_uploaded_at = ?, original_filename = COALESCE(original_filename, ?),
              last_error = NULL, updated_at = ?
        WHERE id = ?`,
    );
    statement.run(
      asset.storageKey,
      asset.originalFilename,
      asset.sizeBytes,
      asset.mimeType,
      asset.uploadedAt,
      kind === 'video' ? asset.originalFilename : null,
      now,
      id,
    );
    this.recomputeStatus(id, now);
    return this.findByIdOrThrow(id);
  }

  delete(id: string): boolean {
    const { changes } = this.db.prepare('DELETE FROM projects WHERE id = ?').run(id) as { changes: number };
    return changes > 0;
  }

  /** A project is only "ready" once both a video and a thumbnail are stored. */
  private recomputeStatus(id: string, now: string): void {
    const row = this.db
      .prepare('SELECT video_path, thumbnail_path FROM projects WHERE id = ?')
      .get(id) as Row | undefined;
    if (!row) return;
    const hasBoth = toNullableString(row.video_path) !== null && toNullableString(row.thumbnail_path) !== null;
    this.db
      .prepare('UPDATE projects SET status = ?, updated_at = ? WHERE id = ?')
      .run(hasBoth ? 'ready' : 'draft', now, id);
  }
}

export { createProjectId };
