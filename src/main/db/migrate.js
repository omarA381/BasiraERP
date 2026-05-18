import { readFileSync, readdirSync } from 'fs';
import { extname, join } from 'path';
import { query } from './index.js';

/**
 * Ensures the _migrations tracking table exists.
 */
async function ensureMigrationsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id          SERIAL PRIMARY KEY,
      name        VARCHAR(255) NOT NULL UNIQUE,
      applied_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    );
  `);
}

/**
 * Retrieves the list of already-applied migration names.
 * @returns {Promise<string[]>}
 */
async function getAppliedMigrations() {
  const result = await query('SELECT name FROM _migrations ORDER BY id ASC');
  return result.rows.map((row) => row.name);
}

/**
 * Reads all .sql files from the migrations directory, sorted by name.
 * @param {string} dirPath - Absolute path to the migrations directory.
 * @returns {string[]} Sorted array of absolute file paths.
 */
function getMigrationFiles(dirPath) {
  try {
    return readdirSync(dirPath)
      .filter((file) => extname(file) === '.sql')
      .sort()
      .map((file) => join(dirPath, file));
  } catch {
    return [];
  }
}

/**
 * Runs all pending migrations in alphabetical order.
 * Each .sql file must contain its own BEGIN/COMMIT block.
 *
 * @param {string} [migrationsDir] - Optional absolute path override.
 *   Defaults to the 'migrations' directory adjacent to this file.
 * @returns {Promise<{ applied: string[] }>}
 */
export async function migrate(migrationsDir) {
  const dir = migrationsDir || join(__dirname, 'migrations');

  await ensureMigrationsTable();

  const applied = await getAppliedMigrations();
  const appliedSet = new Set(applied);
  const files = getMigrationFiles(dir);

  const newlyApplied = [];

  for (const filePath of files) {
    const fileName = filePath.split(/[\\/]/).pop();
    if (appliedSet.has(fileName)) {
      continue;
    }

    const sql = readFileSync(filePath, 'utf-8');
    await query(sql);
    await query('INSERT INTO _migrations (name) VALUES ($1)', [fileName]);
    newlyApplied.push(fileName);
  }

  return { applied: newlyApplied };
}