import { randomUUID } from 'node:crypto';

/** Only canonical UUIDs are accepted as project ids, which makes path
 *  traversal through the :id parameter structurally impossible. */
export const PROJECT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const createProjectId = (): string => randomUUID();

export const isValidProjectId = (value: unknown): value is string =>
  typeof value === 'string' && PROJECT_ID_PATTERN.test(value);
