import type { ErrorRequestHandler, RequestHandler } from 'express';
import multer from 'multer';
import { AppError } from '../errors/AppError.js';
import { logger } from '../utils/logger.js';

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new AppError(404, 'NOT_FOUND', `No route matches ${req.method} ${req.originalUrl}.`));
};

interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  const multerError = error instanceof multer.MulterError;
  const isAppError = error instanceof AppError;
  const status = isAppError ? error.status : multerError ? 400 : 500;
  const code = isAppError ? error.code : multerError ? 'UPLOAD_ERROR' : 'INTERNAL_ERROR';
  const message = isAppError
    ? error.message
    : multerError
      ? `Upload failed: ${error.message}`
      : 'An unexpected server error occurred.';

  if (status >= 500) {
    logger.error(`Unhandled error on ${req.method} ${req.originalUrl}: ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
  } else {
    logger.warn(`${req.method} ${req.originalUrl} -> ${status} ${code}: ${message}`);
  }

  const body: ErrorBody = { error: { code, message } };
  if (isAppError && error.details !== undefined) body.error.details = error.details;

  res.status(status).json(body);
};
