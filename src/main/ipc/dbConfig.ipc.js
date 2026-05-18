import { app, ipcMain } from 'electron';
import Store from 'electron-store';
import { existsSync, unlinkSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { Client } from 'pg';
import { fileURLToPath } from 'url';

const ENC_KEY = 'nexterp-db-secure-key-2024';
const XOR_KEY = 'nxrp-db-xor-salt';

function xorCipher(text, key) {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return Buffer.from(result, 'binary').toString('base64');
}

const dbStore = new Store({ name: 'db-config', encryptionKey: ENC_KEY });

function getEnvPath() {
  return join(app.getPath('userData'), '.env');
}

function writeEnvFile(config) {
  const lines = [
    `DB_HOST=${config.host}`,
    `DB_PORT=${config.port}`,
    `DB_NAME=${config.database}`,
    `DB_USER=${config.user}`,
    `DB_PASSWORD=${config.password}`,
  ];
  writeFileSync(getEnvPath(), lines.join('\n'), 'utf-8');
}

function removeEnvFile() {
  const envPath = getEnvPath();
  if (existsSync(envPath)) {
    unlinkSync(envPath);
  }
}

export function registerDbConfigIpc() {
  ipcMain.handle('db:test-connection', async (_event, { host, port, database, user, password, ssl }) => {
    try {
      const client = new Client({
        host,
        port: Number(port),
        database,
        user,
        password,
        ssl: ssl ? { rejectUnauthorized: false } : false,
        connectionTimeoutMillis: 10000,
      });
      await client.connect();
      const res = await client.query('SELECT version()');
      const version = res.rows[0]?.version || 'Unknown';
      await client.end();
      return { success: true, data: { message: 'Connection successful', version } };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('db:save-config', async (_event, config) => {
    try {
      const { host, port, database, user, password, ssl } = config;
      const encryptedPassword = xorCipher(password, XOR_KEY);
      dbStore.set('host', host);
      dbStore.set('port', Number(port));
      dbStore.set('database', database);
      dbStore.set('user', user);
      dbStore.set('password', encryptedPassword);
      dbStore.set('ssl', Boolean(ssl));
      writeEnvFile({ host, port, database, user, password });
      return { success: true, data: { message: 'Configuration saved', envPath: getEnvPath() } };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('db:load-config', async () => {
    try {
      const host = dbStore.get('host');
      if (!host) {
        return { success: true, data: null };
      }
      return {
        success: true,
        data: {
          host,
          port: dbStore.get('port'),
          database: dbStore.get('database'),
          user: dbStore.get('user'),
          password: '********',
          ssl: dbStore.get('ssl'),
        },
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('db:delete-config', async () => {
    try {
      dbStore.clear();
      removeEnvFile();
      return { success: true, data: { message: 'Configuration deleted' } };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('db:migrate', async () => {
    try {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      const migrationsDir = join(__dirname, '..', 'db', 'migrations');

      let migrate;
      try {
        ({ migrate } = await import('../db/migrate.js'));
      } catch {
        return {
          success: false,
          error: 'Migration module not found. Ensure src/main/db/migrate.js exists.',
        };
      }

      const result = await migrate(migrationsDir);
      return {
        success: true,
        data: {
          message:
            result.applied.length > 0
              ? `Applied ${result.applied.length} migration(s): ${result.applied.join(', ')}`
              : 'No pending migrations.',
          applied: result.applied,
        },
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
}