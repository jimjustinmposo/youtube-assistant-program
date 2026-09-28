/**
 * Forward-only, append-only schema migrations. Each entry runs exactly once
 * and is recorded in schema_migrations. Never edit an applied migration;
 * add a new one.
 */
export interface Migration {
  id: string;
  sql: string;
}

export const MIGRATIONS: Migration[] = [
  {
    id: '001_create_projects',
    sql: `
      CREATE TABLE IF NOT EXISTS projects (
        id                     TEXT PRIMARY KEY,
        original_filename      TEXT,
        video_path             TEXT,
        video_filename         TEXT,
        video_size_bytes       INTEGER,
        video_mime_type        TEXT,
        video_uploaded_at      TEXT,
        thumbnail_path         TEXT,
        thumbnail_filename     TEXT,
        thumbnail_size_bytes   INTEGER,
        thumbnail_mime_type    TEXT,
        thumbnail_uploaded_at  TEXT,
        status                 TEXT NOT NULL DEFAULT 'draft'
                               CHECK (status IN ('draft','uploading','ready','failed')),
        last_error             TEXT,
        created_at             TEXT NOT NULL,
        updated_at             TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects (created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_projects_status ON projects (status);
    `,
  },
];
