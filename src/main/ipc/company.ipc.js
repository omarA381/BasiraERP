import bcrypt from 'bcryptjs';
import { dialog, ipcMain } from 'electron';
import pool, { query } from '../db/index.js';

export function registerCompanyIpc() {
  ipcMain.handle('company:select-logo', async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: 'Select Company Logo',
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'svg', 'webp'] }],
        properties: ['openFile'],
      });
      if (result.canceled || result.filePaths.length === 0) {
        return { success: true, data: null };
      }
      const filePath = result.filePaths[0];
      const name = filePath.split(/[\\/]/).pop();
      return { success: true, data: { path: filePath, name } };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('company:create', async (_event, { company, adminUser }) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Insert company
      const companyResult = await client.query(
        `INSERT INTO companies (code, name, legal_name, tax_number, address, phone, email, logo_url,
          base_currency, calendar_type, default_language, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, TRUE)
         RETURNING id`,
        [
          company.code,
          company.name,
          company.legalName || null,
          company.taxNumber || null,
          JSON.stringify({
            street: company.streetAddress || null,
            city: company.city || null,
            state: company.stateRegion || null,
            postal: company.postalCode || null,
            country: company.country || null,
            fax: company.fax || null,
            website: company.website || null,
          }),
          company.phone || null,
          company.email || null,
          company.logoPath || null,
          company.baseCurrency || 'USD',
          company.calendarType || 'gregorian',
          company.primaryLanguage || 'en',
        ]
      );
      const companyId = companyResult.rows[0].id;

      // 2. Create default head office branch
      await client.query(
        `INSERT INTO branches (company_id, code, name, is_head_office, is_active)
         VALUES ($1, 'HO', 'Head Office', TRUE, TRUE)`,
        [companyId]
      );

      // 3. Create System Administrator role
      const roleResult = await client.query(
        `INSERT INTO roles (company_id, role_name, description, is_system_role)
         VALUES ($1, 'System Administrator', 'Full system access for company administrator', TRUE)
         RETURNING id`,
        [companyId]
      );
      const roleId = roleResult.rows[0].id;

      // 4. Copy all global permissions to the new role
      await client.query(
        `INSERT INTO role_permissions (role_id, permission_id)
         SELECT $1, id FROM permissions`,
        [roleId]
      );

      // 5. Hash password and insert admin user
      const passwordHash = await bcrypt.hash(adminUser.password, 10);
      await client.query(
        `INSERT INTO users (company_id, username, password_hash, full_name, email, role_id,
          is_active, must_change_password)
         VALUES ($1, $2, $3, $4, $5, $6, TRUE, TRUE)`,
        [companyId, adminUser.username, passwordHash, adminUser.fullName, adminUser.email, roleId]
      );

      await client.query('COMMIT');

      // Fetch the created company for response
      const created = await query('SELECT id, code, name FROM companies WHERE id = $1', [companyId]);

      // Audit log
      try {
        await query(
          `INSERT INTO audit_log (company_id, action, table_name, record_id, new_values, created_at)
           VALUES ($1, 'COMPANY_CREATE', 'companies', $2, $3, NOW())`,
          [companyId, companyId, JSON.stringify({ code: company.code, name: company.name })]
        );
      } catch {
        // audit log failure is non-fatal
      }

      return {
        success: true,
        data: {
          company: created.rows[0],
          message: `Company "${company.name}" created successfully`,
        },
      };
    } catch (error) {
      await client.query('ROLLBACK');
      if (error.code === '23505') {
        const detail = error.detail || '';
        if (detail.includes('code')) {
          return { success: false, error: `Company code "${company.code}" already exists` };
        }
        if (detail.includes('username')) {
          return { success: false, error: `Username "${adminUser.username}" is already taken` };
        }
        return { success: false, error: 'A record with the same unique value already exists' };
      }
      return { success: false, error: error.message };
    } finally {
      client.release();
    }
  });
}