import express, { type Express } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import cors from 'cors';
import { env } from './config/env.js';
import { createHealthRouter } from './routes/healthRouter.js';
import { createProjectRouter } from './routes/projectRoutes.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import type { ProjectService } from './services/projectService.js';
import type { StorageService } from './services/storageService.js';

/** The Vite dev server proxies /api here, so the browser only ever talks to localhost. */
const CORS_ORIGINS = ['http://127.0.0.1:3000', 'http://localhost:3000'];

export function createApp(service: ProjectService, storage: StorageService): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(cors({ origin: CORS_ORIGINS }));
  app.use(express.json({ limit: '1mb' }));

  app.use('/api', createHealthRouter());
  app.use('/api/projects', createProjectRouter(service, storage));

  // In a built setup the same local process serves the web app, so the whole
  // application runs on a single port with no additional web server.
  const indexHtml = path.join(env.clientDistDir, 'index.html');
  if (fs.existsSync(indexHtml)) {
    app.use(express.static(env.clientDistDir));
    app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(indexHtml));
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
