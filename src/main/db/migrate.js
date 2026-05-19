import { readFileSync, readdirSync } from 'fs';
import { extname, join } from 'path';
import { query } from './pool.js';

/**
 * Ensures the migrations_log table exists.
 */
async function ensureMigrationsLog() {
  await query(`
    CREATE TABLE IF NOT EXISTS migrations_log (
      id          SERIAL PRIMARY KEY,
      name        VARCHAR(255) NOT NULL UNIQUE,
      applied_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      success     BOOLEAN      NOT NULL DEFAULT TRUE,
      error_msg   TEXT
    );
  `);
}

/**
 * Retrieves the list of already-applied migration names.
 * @returns {Promise<string[]>}
 */
async function getAppliedMigrations() {
  const result = await query(
    'SELECT name FROM migrations_log WHERE success = TRUE ORDER BY id ASC'
  );
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
 * @returns {Promise<{ applied: string[], skipped: number }>}
 */
export async function migrate(migrationsDir) {
  const dir = migrationsDir || join(__dirname, 'migrations');

  await ensureMigrationsLog();

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

    try {
      await query(sql);
      await query(
        'INSERT INTO migrations_log (name, success) VALUES ($1, TRUE)',
        [fileName]
      );
      newlyApplied.push(fileName);
    } catch (error) {
      // Log the failure and re-throw
      await query(
        'INSERT INTO migrations_log (name, success, error_msg) VALUES ($1, FALSE, $2)',
        [fileName, error.message]
      ).catch(() => {});
      throw new Error(`Migration "${fileName}" failed: ${error.message}`);
    }
  }

  return { applied: newlyApplied, skipped: files.length - newlyApplied.length };
}