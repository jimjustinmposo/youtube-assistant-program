import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { MIGRATIONS } from './migrations.js';

export type AppDatabase = DatabaseSync;

const MIGRATION_TABLE = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    id         TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  );
`;

function applyMigrations(db: AppDatabase): void {
  db.exec(MIGRATION_TABLE);
  const appliedRows = db.prepare('SELECT id FROM schema_migrations').all() as { id: string }[];
  const applied = new Set(appliedRows.map((row) => row.id));
  const record = db.prepare('INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)');

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.id)) continue;
    db.exec('BEGIN');
    try {
      db.exec(migration.sql);
      record.run(migration.id, new Date().toISOString());
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
}

/**
 * Opens (and creates when missing) the local SQLite database using the Node
 * built-in driver - no native module compilation required on Windows.
 */
export function openDatabase(filePath: string): AppDatabase {
  const db = new DatabaseSync(filePath);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA busy_timeout = 5000');
  db.exec('PRAGMA foreign_keys = ON');
  applyMigrations(db);
  return db;
}

export const databaseFileName = path.basename('youtube-assistant.db');
