import { env, databaseFile } from './config/env.js';
import { openDatabase } from './db/database.js';
import { ProjectsRepository } from './db/projectsRepository.js';
import { StorageService } from './services/storageService.js';
import { ProjectService } from './services/projectService.js';
import { createApp } from './app.js';
import { logger } from './utils/logger.js';

async function main(): Promise<void> {
  const storage = new StorageService(env.dataDir);
  await storage.init();

  const db = openDatabase(databaseFile);
  const repository = new ProjectsRepository(db);
  const service = new ProjectService(repository, storage);

  const app = createApp(service, storage);
  const server = app.listen(env.port, env.host, () => {
    logger.info(`Local API listening on http://${env.host}:${env.port}`);
    logger.info(`Data directory: ${env.dataDir}`);
    if (!env.isProduction) {
      logger.info(`Web app (dev): http://127.0.0.1:${process.env.VITE_PORT ?? 3000}`);
    }
  });

  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      logger.error(`Port ${env.port} is already in use. Stop the other process or change PORT in .env.`);
    } else {
      logger.error('HTTP server error', error);
    }
    process.exitCode = 1;
  });

  const shutdown = (signal: string) => {
    logger.info(`Received ${signal}, shutting down.`);
    server.close(() => {
      db.close();
      process.exit(0);
    });
    // Do not hang forever on lingering keep-alive connections.
    setTimeout(() => process.exit(0), 3000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error) => {
  logger.error('Failed to start the local API', error);
  process.exit(1);
});
