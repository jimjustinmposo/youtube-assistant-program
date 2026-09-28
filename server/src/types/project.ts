export const PROJECT_STATUSES = ['draft', 'uploading', 'ready', 'failed'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  draft: 'Draft',
  uploading: 'Uploading',
  ready: 'Ready',
  failed: 'Failed',
};

export interface ProjectAsset {
  /** Storage key relative to the data directory, e.g. "projects/<id>/video.mp4". */
  storageKey: string | null;
  originalFilename: string | null;
  sizeBytes: number | null;
  mimeType: string | null;
  uploadedAt: string | null;
}

export interface Project {
  id: string;
  originalFilename: string | null;
  status: ProjectStatus;
  video: ProjectAsset;
  thumbnail: ProjectAsset;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectListQuery {
  limit: number;
  offset: number;
}

export interface ProjectListResult {
  items: Project[];
  total: number;
  limit: number;
  offset: number;
}
