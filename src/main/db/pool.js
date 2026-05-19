import Store from 'electron-store';
import { Pool } from 'pg';

const ENC_KEY = 'nexterp-db-secure-key-2024';
const XOR_KEY = 'nxrp-db-xor-salt';

/**
 * Decode a password that was XOR-encrypted then base64-encoded.
 */
function xorDecipher(encoded, key) {
  const binary = Buffer.from(encoded, 'base64').toString('binary');
  let result = '';
  for (let i = 0; i < binary.length; i++) {
    result += String.fromCharCode(binary.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return result;
}

let pool = null;
let store = null;

function getStore() {
  if (!store) {
    store = new Store({ name: 'db-config', encryptionKey: ENC_KEY });
  }
  return store;
}

function getPool() {
  if (pool) return pool;

  const s = getStore();
  const host = s.get('host');
  if (!host) return null;

  const encodedPassword = s.get('password');
  const password = encodedPassword ? xorDecipher(encodedPassword, XOR_KEY) : '';

  pool = new Pool({
    host,
    port: s.get('port') || 5432,
    database: s.get('database'),
    user: s.get('user'),
    password,
    ssl: s.get('ssl') ? { rejectUnauthorized: false } : false,
    max: 10,
    idleTimeoutMillis: 30000,
  });

  return pool;
}

/**
 * Execute a single query against the pool.
 * @param {string} text - SQL query text
 * @param {Array} [params] - Parameterized values
 * @returns {Promise<import('pg').QueryResult>}
 */
export async function query(text, params) {
  const p = getPool();
  if (!p) throw new Error('Database not configured');
  return p.query(text, params);
}

/**
 * Obtain a dedicated client from the pool for transactions.
 * @returns {Promise<import('pg').PoolClient>}
 */
export async function getClient() {
  const p = getPool();
  if (!p) throw new Error('Database not configured');
  return p.connect();
}

/**
 * Test the database connection.
 * @returns {Promise<{ ok: boolean, version?: string, error?: string }>}
 */
export async function testConnection() {
  try {
    const p = getPool();
    if (!p) return { ok: false, error: 'No database configuration found' };
    const client = await p.connect();
    try {
      const res = await client.query('SELECT version()');
      return { ok: true, version: res.rows[0]?.version || 'Unknown' };
    } finally {
      client.release();
    }
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

/**
 * Check whether a DB configuration exists in the store.
 * @returns {boolean}
 */
export function hasConfig() {
  const s = getStore();
  return Boolean(s.get('host'));
}

export default getPool;