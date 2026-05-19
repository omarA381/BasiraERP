import bcrypt from 'bcryptjs';
import { ipcMain } from 'electron';
import { query } from '../db/pool.js';

export function registerUserIpc() {
  // ============================================================
  // user:create
  // ============================================================
  ipcMain.handle('user:create', async (_event, { companyId, branchId, fullName, username, email, phone, roleId, password, mustChangePassword, isActive }) => {
    try {
      // Check duplicate username
      const exists = await query(
        'SELECT id FROM users WHERE company_id = $1 AND username = $2',
        [companyId, username]
      );
      if (exists.rows.length > 0) {
        return { success: false, error: `Username "${username}" is already taken in this company` };
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const result = await query(
        `INSERT INTO users (company_id, branch_id, username, password_hash, full_name, email, phone, role_id,
          is_active, must_change_password)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id, username, full_name, email, role_id, is_active, created_at`,
        [companyId, branchId || null, username, passwordHash, fullName, email, phone || null, roleId, isActive !== false, mustChangePassword !== false]
      );
      const user = result.rows[0];

      // Audit log
      try {
        await query(
          `INSERT INTO audit_log (company_id, user_id, action, table_name, record_id, new_values, created_at)
           VALUES ($1, $2, 'USER_CREATE', 'users', $3, $4, NOW())`,
          [companyId, user.id, user.id, JSON.stringify({ username, fullName, email })]
        );
      } catch {
        // non-fatal
      }

      return { success: true, data: user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // ============================================================
  // user:check-username
  // ============================================================
  ipcMain.handle('user:check-username', async (_event, { username, companyId }) => {
    try {
      const result = await query(
        'SELECT EXISTS(SELECT 1 FROM users WHERE company_id = $1 AND username = $2) AS taken',
        [companyId, username]
      );
      return { success: true, data: { available: !result.rows[0].taken } };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // ============================================================
  // role:list
  // ============================================================
  ipcMain.handle('role:list', async (_event, { companyId }) => {
    try {
      const result = await query(
        'SELECT id, role_name, description FROM roles WHERE company_id = $1 ORDER BY role_name',
        [companyId]
      );
      return { success: true, data: result.rows };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // ============================================================
  // role:get-permissions
  // ============================================================
  ipcMain.handle('role:get-permissions', async (_event, { roleId }) => {
    try {
      const result = await query(
        `SELECT p.module_code, p.action_code, p.description
         FROM role_permissions rp
         JOIN permissions p ON rp.permission_id = p.id
         WHERE rp.role_id = $1
         ORDER BY p.module_code, p.action_code`,
        [roleId]
      );
      // Group by module_code
      const grouped = {};
      for (const row of result.rows) {
        if (!grouped[row.module_code]) {
          grouped[row.module_code] = [];
        }
        grouped[row.module_code].push(row);
      }
      return { success: true, data: grouped };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // ============================================================
  // branch:list
  // ============================================================
  ipcMain.handle('branch:list', async (_event, { companyId }) => {
    try {
      const result = await query(
        'SELECT id, code, name, is_head_office FROM branches WHERE company_id = $1 AND is_active = TRUE ORDER BY is_head_office DESC, name',
        [companyId]
      );
      return { success: true, data: result.rows };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
}