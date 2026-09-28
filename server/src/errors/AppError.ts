/**
 * Application error carrying an HTTP status and a stable machine-readable code.
 * The error handler turns these into JSON responses; anything else is treated
 * as an unexpected internal error and never leaks its message to the client.
 */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message: string, details?: unknown): AppError =>
  new AppError(400, 'VALIDATION_ERROR', message, details);

export const notFound = (message = 'Resource not found.'): AppError =>
  new AppError(404, 'NOT_FOUND', message);

export const conflict = (message: string): AppError => new AppError(409, 'CONFLICT', message);

export const payloadTooLarge = (message: string, details?: unknown): AppError =>
  new AppError(413, 'PAYLOAD_TOO_LARGE', message, details);

export const unsupportedMediaType = (message: string, details?: unknown): AppError =>
  new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', message, details);
