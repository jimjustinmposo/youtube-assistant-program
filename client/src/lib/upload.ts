import { ApiError } from './api';
import type { Project } from '../types/project';

export interface UploadProgress {
  loaded: number;
  total: number;
  percent: number;
}

/**
 * Uploads a single file with progress reporting. XMLHttpRequest is used
 * because fetch() still cannot report request upload progress.
 */
export function uploadFile(
  path: string,
  file: File,
  onProgress: (progress: UploadProgress) => void,
): Promise<Project> {
  return new Promise<Project>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', `/api${path}`);

    request.upload.addEventListener('progress', (event) => {
      if (!event.lengthComputable) return;
      onProgress({
        loaded: event.loaded,
        total: event.total,
        percent: Math.min(100, Math.round((event.loaded / event.total) * 100)),
      });
    });

    request.addEventListener('load', () => {
      const text = request.responseText;
      if (request.status >= 200 && request.status < 300) {
        onProgress({ loaded: 1, total: 1, percent: 100 });
        resolve(JSON.parse(text) as Project);
        return;
      }
      let message = `Upload failed with status ${request.status}.`;
      let code = 'UPLOAD_FAILED';
      try {
        const parsed = JSON.parse(text) as { error?: { message?: string; code?: string } };
        message = parsed.error?.message ?? message;
        code = parsed.error?.code ?? code;
      } catch {
        // Non-JSON error body - keep the generic message.
      }
      reject(new ApiError(message, request.status, code));
    });

    request.addEventListener('error', () => {
      reject(new ApiError('Network error while uploading the file.', 0, 'NETWORK_ERROR'));
    });

    request.addEventListener('abort', () => {
      reject(new ApiError('Upload was cancelled.', 0, 'UPLOAD_ABORTED'));
    });

    const form = new FormData();
    form.append('file', file, file.name);
    request.send(form);
  });
}
