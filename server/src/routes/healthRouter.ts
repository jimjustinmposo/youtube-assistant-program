import { Router } from 'express';
import { env } from '../config/env.js';
import { FILE_RULES } from '../config/limits.js';
import { megabytesToBytes } from '../config/limits.js';

/**
 * Reports backend health plus the real configured upload limits, so the UI can
 * show accurate validation messages instead of hard-coded values.
 */
export function createHealthRouter(): Router {
  const router = Router();

  router.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      app: env.appName,
      version: env.appVersion,
      phase: env.currentPhase,
      /** Phase 1 only: no analysis, no AI, no YouTube. Stated explicitly so the
       *  UI never implies capabilities that do not exist yet. */
      capabilities: {
        videoAnalysis: false,
        aiContentGeneration: false,
        youtubePublish: false,
        composioIntegration: false,
      },
      storage: { dataDir: env.dataDir },
      limits: {
        maxVideoSizeBytes: FILE_RULES.video.maxBytes,
        maxThumbnailSizeBytes: FILE_RULES.thumbnail.maxBytes,
        videoExtensions: FILE_RULES.video.extensions,
        videoMimeTypes: FILE_RULES.video.mimeTypes,
        thumbnailExtensions: FILE_RULES.thumbnail.extensions,
        thumbnailMimeTypes: FILE_RULES.thumbnail.mimeTypes,
      },
    });
  });

  return router;
}

export { megabytesToBytes };
