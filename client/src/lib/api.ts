import type { HealthInfo, Project, ProjectListResponse } from '../types/project';

const API_BASE = '/api';

/** Error carrying the backend's machine-readable code so the UI can react. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(message: string, status: number, code: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** True when the local backend could not be reached at all. */
  get isBackendUnavailable(): boolean {
    return this.code === 'BACKEND_UNAVAILABLE' || this.code === 'NETWORK_ERROR';
  }
}

function parseErrorPayload(text: string): { message?: string; code?: string; details?: unknown } {
  try {
    const parsed = JSON.parse(text) as { error?: { message?: string; code?: string; details?: unknown } };
    return parsed.error ?? {};
  } catch {
    return {};
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, init);
  } catch {
    throw new ApiError(
      'Cannot reach the local backend. Start it with "npm run dev" and try again.',
      0,
      'BACKEND_UNAVAILABLE',
    );
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  if (!response.ok) {
    const { message, code, details } = parseErrorPayload(text);
    throw new ApiError(
      message ?? `Request failed with status ${response.status}.`,
      response.status,
      code ?? 'UNKNOWN_ERROR',
      details,
    );
  }
  return (text ? JSON.parse(text) : null) as T;
}

export const api = {
  health: () => request<HealthInfo>('/health'),

  listProjects: () => request<ProjectListResponse>('/projects'),

  getProject: (id: string) => request<Project>(`/projects/${id}`),

  createProject: () => request<Project>('/projects', { method: 'POST' }),

  deleteProject: (id: string) => request<void>(`/projects/${id}`, { method: 'DELETE' }),

  videoUrl: (id: string) => `${API_BASE}/projects/${id}/video`,

  thumbnailUrl: (id: string) => `${API_BASE}/projects/${id}/thumbnail`,
};
