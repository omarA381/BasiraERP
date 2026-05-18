import bcrypt from 'bcryptjs';
import { ipcMain } from 'electron';
import { query } from '../db/index.js';

const sessions = new Map();

function auditInsert(userId, action, ip, detail) {
  return query(
    `INSERT INTO audit_log (user_id, action, table_name, ip_address, timestamp, old_values, new_values)
     VALUES ($1, $2, $3, $4, NOW(), $5, $6)`,
    [userId, action, 'auth', ip, null, JSON.stringify(detail)]
  );
}

function senderIp(event) {
  return event.sender.getURL();
}

export function registerAuthIpc() {
  ipcMain.handle('auth:login', async (event, { username, password, companyId }) => {
    try {
      const ip = senderIp(event);

      const result = await query(
        `SELECT u.id, u.username, u.full_name, u.email, u.role_id, r.role_name,
                u.company_id, u.is_active, u.password_hash, u.last_login
         FROM users u
         JOIN roles r ON u.role_id = r.id
         WHERE u.username = $1 AND u.company_id = $2`,
        [username, companyId]
      );

      if (result.rows.length === 0) {
        await auditInsert(null, 'LOGIN', ip, { username, companyId, success: false, reason: 'user_not_found' });
        return { success: false, message: 'Invalid credentials' };
      }

      const user = result.rows[0];

      if (!user.is_active) {
        await auditInsert(user.id, 'LOGIN', ip, { username, companyId, success: false, reason: 'account_inactive' });
        return { success: false, message: 'Invalid credentials' };
      }

      const passwordValid = await bcrypt.compare(password, user.password_hash);

      if (!passwordValid) {
        await auditInsert(user.id, 'LOGIN', ip, { username, companyId, success: false, reason: 'invalid_password' });
        return { success: false, message: 'Invalid credentials' };
      }

      await query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

      await auditInsert(user.id, 'LOGIN', ip, { username, companyId, success: true });

      sessions.set(event.sender.id, { userId: user.id, username: user.username, companyId });

      const { password_hash, ...userData } = user;
      return { success: true, data: userData };
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  ipcMain.handle('auth:logout', async (event) => {
    try {
      const session = sessions.get(event.sender.id);
      const userId = session?.userId || null;
      const ip = senderIp(event);

      await auditInsert(userId, 'LOGOUT', ip, { userId });

      sessions.delete(event.sender.id);
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  ipcMain.handle('auth:get-companies', async () => {
    try {
      const result = await query(
        'SELECT id, name FROM companies WHERE is_active = true ORDER BY name'
      );
      return { success: true, data: result.rows };
    } catch (error) {
      return { success: false, message: error.message };
    }
  });
}