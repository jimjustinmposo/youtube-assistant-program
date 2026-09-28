import { Router, type Request, type RequestHandler, type Response, type NextFunction } from 'express';
import { badRequest } from '../errors/AppError.js';
import { isValidProjectId } from '../utils/ids.js';
import { createFileUploadMiddleware, toUploadError, UPLOAD_FIELD_NAME } from '../middleware/upload.js';
import type { ProjectService } from '../services/projectService.js';
import type { StorageService } from '../services/storageService.js';
import type { FileKind } from '../config/limits.js';

function requireProjectId(req: Request, _res: Response, next: NextFunction): void {
  if (!isValidProjectId(req.params.id)) {
    next(badRequest('Invalid project id.'));
    return;
  }
  next();
}

/** Narrowed, validated project id (Express 5 types params as string | string[]). */
function idOf(req: Request): string {
  return String(req.params.id);
}

export function createProjectRouter(service: ProjectService, storage: StorageService): Router {
  const router = Router();
  const videoUpload = createFileUploadMiddleware('video', storage);
  const thumbnailUpload = createFileUploadMiddleware('thumbnail', storage);

  router.get('/', (req, res) => {
    res.json(service.list({ limit: parseIntParam(req, 'limit'), offset: parseIntParam(req, 'offset') }));
  });

  router.post('/', async (_req, res) => {
    res.status(201).json(await service.create());
  });

  router.get('/:id', requireProjectId, (req, res) => {
    res.json(service.get(idOf(req)));
  });

  router.delete('/:id', requireProjectId, async (req, res) => {
    await service.remove(idOf(req));
    res.status(204).end();
  });

  router.get('/:id/video', requireProjectId, (req, res, next) => {
    sendAsset(req, res, next, service, 'video');
  });

  router.get('/:id/thumbnail', requireProjectId, (req, res, next) => {
    sendAsset(req, res, next, service, 'thumbnail');
  });

  router.post('/:id/video', requireProjectId, (req, res, next) => {
    handleUpload(req, res, next, service, storage, 'video', videoUpload);
  });

  router.post('/:id/thumbnail', requireProjectId, (req, res, next) => {
    handleUpload(req, res, next, service, storage, 'thumbnail', thumbnailUpload);
  });

  return router;
}

function sendAsset(
  req: Request,
  res: Response,
  next: NextFunction,
  service: ProjectService,
  kind: 'video' | 'thumbnail',
): void {
  try {
    const { absolutePath, mimeType } = service.getAssetPath(idOf(req), kind);
    res.type(mimeType);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    // sendFile supports HTTP range requests, which is what enables seeking in
    // the local <video> preview element.
    res.sendFile(absolutePath, (error) => {
      if (error && !res.headersSent) next(error);
    });
  } catch (error) {
    next(error);
  }
}

function handleUpload(
  req: Request,
  res: Response,
  next: NextFunction,
  service: ProjectService,
  storage: StorageService,
  kind: FileKind,
  upload: RequestHandler,
): void {
  const startedAt = Date.now();
  upload(req, res, (uploadError?: unknown) => {
    if (uploadError) {
      // On abort (e.g. size limit) multer gives us no file path, so sweep any
      // partially written temp file it left behind.
      void storage.removeTmpFilesSince(startedAt - 1000);
      next(toUploadError(uploadError, kind) ?? uploadError);
      return;
    }
    if (!req.file) {
      next(badRequest(`No file received. Attach a single file in the "${UPLOAD_FIELD_NAME}" field.`));
      return;
    }

    const tempPath = req.file.path;
    const run = async () => {
      try {
        const project =
          kind === 'video'
            ? await service.attachVideo(idOf(req), req.file!)
            : await service.attachThumbnail(idOf(req), req.file!);
        res.json(project);
      } catch (error) {
        await storage.removeQuietly(tempPath);
        next(error);
      }
    };

    void run().catch(next);
  });
}

function parseIntParam(req: Request, name: string): number | undefined {
  const raw = req.query[name];
  if (raw === undefined) return undefined;
  const value = Number(Array.isArray(raw) ? raw[0] : raw);
  if (!Number.isFinite(value)) throw badRequest(`Query parameter "${name}" must be a number.`);
  return value;
}
