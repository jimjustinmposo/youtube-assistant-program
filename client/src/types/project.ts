export const PROJECT_STATUSES = ['draft', 'uploading', 'ready', 'failed'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export interface ProjectAsset {
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

export interface ProjectListResponse {
  items: Project[];
  total: number;
  limit: number;
  offset: number;
}

export interface UploadLimits {
  maxVideoSizeBytes: number;
  maxThumbnailSizeBytes: number;
  videoExtensions: string[];
  videoMimeTypes: string[];
  thumbnailExtensions: string[];
  thumbnailMimeTypes: string[];
}

export interface HealthInfo {
  status: string;
  app: string;
  version: string;
  phase: string;
  capabilities: {
    videoAnalysis: boolean;
    aiContentGeneration: boolean;
    youtubePublish: boolean;
    composioIntegration: boolean;
  };
  storage: { dataDir: string };
  limits: UploadLimits;
}
