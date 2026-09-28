type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_WEIGHT: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

let cachedMinLevel: number | null = null;

function minLevel(): number {
  if (cachedMinLevel === null) {
    const configured = (process.env.LOG_LEVEL ?? '').toLowerCase() as Level;
    const level = configured in LEVEL_WEIGHT ? configured : 'info';
    cachedMinLevel = LEVEL_WEIGHT[level];
  }
  return cachedMinLevel;
}

function write(level: Level, message: string, meta?: unknown): void {
  if (LEVEL_WEIGHT[level] < minLevel()) return;
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${level.toUpperCase().padEnd(5)} ${message}`;
  const stream = level === 'error' || level === 'warn' ? console.error : console.log;
  if (meta === undefined) stream(line);
  else stream(line, typeof meta === 'string' ? meta : JSON.stringify(meta));
}

/**
 * Minimal structured logger. Deliberately does not log request bodies,
 * credentials or any environment secret values.
 */
export const logger = {
  debug: (message: string, meta?: unknown) => write('debug', message, meta),
  info: (message: string, meta?: unknown) => write('info', message, meta),
  warn: (message: string, meta?: unknown) => write('warn', message, meta),
  error: (message: string, meta?: unknown) => write('error', message, meta),
};
