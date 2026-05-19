import bcrypt from 'bcryptjs';
import { ipcMain } from 'electron';
import { getClient, query } from '../db/pool.js';

// ============================================================
// SOD (Segregation of Duties) Conflict Rules
// ============================================================
const SOD_CONFLICTS = [
  // CREATE + APPROVE on same module
  { actions: ['CREATE', 'APPROVE'], message: 'User should not both create and approve in the same module' },
  // For payment-related modules
  { actions: ['EDIT', 'APPROVE'], message: 'User should not both edit and approve in the same module' },
];

function checkSodConflicts(permissions) {
  // permissions is an array of { module_code, action_code }
  const conflicts = [];

  // Group by module
  const byModule = {};
  for (const p of permissions) {
    if (!byModule[p.module_code]) byModule[p.module_code] = new Set();
    byModule[p.module_code].add(p.action_code);
  }

  for (const [module, actions] of Object.entries(byModule)) {
    for (const rule of SOD_CONFLICTS) {
      const match = rule.actions.every((a) => actions.has(a));
      if (match) {
        conflicts.push({
          module,
          actions: rule.actions,
          message: `${rule.message} (module: ${module}, actions: ${rule.actions.join(' + ')})`,
        });
      }
    }
  }

  return conflicts;
}

// ============================================================
// foundation:get-stats
// ============================================================
ipcMain.handle('foundation:get-stats', async (_event, { companyId }) => {
  try {
    const [activeUsers, activeCompanies, recentAudit] = await Promise.all([
      query(
        'SELECT COUNT(*)::int AS count FROM users WHERE company_id = $1 AND is_active = TRUE',
        [companyId]
      ),
      query(
        'SELECT COUNT(*)::int AS count FROM companies WHERE is_active = TRUE'
      ),
      query(
        `SELECT a.id, a.action, a.table_name, a.ip_address, a.created_at,
                COALESCE(u.full_name, u.username, 'System') AS user_name
         FROM audit_log a
         LEFT JOIN users u ON a.user_id = u.id
         WHERE a.company_id = $1
         ORDER BY a.created_at DESC
         LIMIT 10`,
        [companyId]
      ),
    ]);

    // Pending approvals — for now count workflow approvals (placeholder)
    const pendingApprovals = { count: 0 };
    const openPeriods = { count: 0 };

    try {
      const paResult = await query(
        `SELECT COUNT(*)::int AS count FROM audit_log
         WHERE company_id = $1 AND action = 'WORKFLOW_PENDING'`,
        [companyId]
      );
      pendingApprovals.count = paResult.rows[0]?.count || 0;
    } catch {
      // table/column might not exist yet
    }

    // Fiscal periods — placeholder
    // In a real implementation this would query a fiscal_periods table

    return {
      success: true,
      data: {
        activeUsers: activeUsers.rows[0]?.count || 0,
        activeCompanies: activeCompanies.rows[0]?.count || 0,
        openPeriods: openPeriods.count,
        pendingApprovals: pendingApprovals.count,
        recentAudit: recentAudit.rows,
      },
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ============================================================
// user:list
// ============================================================
ipcMain.handle('user:list', async (_event, { companyId, search, status, page, limit }) => {
  try {
    const offset = ((page || 1) - 1) * (limit || 20);
    const conditions = ['u.company_id = $1'];
    const params = [companyId];
    let paramIdx = 2;

    if (search) {
      conditions.push(
        `(u.full_name ILIKE $${paramIdx} OR u.username ILIKE $${paramIdx} OR u.email ILIKE $${paramIdx})`
      );
      params.push(`%${search}%`);
      paramIdx++;
    }

    if (status === 'active') {
      conditions.push('u.is_active = TRUE');
    } else if (status === 'inactive') {
      conditions.push('u.is_active = FALSE');
    } else if (status === 'must_change') {
      conditions.push('u.must_change_password = TRUE');
    }

    const whereClause = conditions.join(' AND ');

    const [usersResult, countResult] = await Promise.all([
      query(
        `SELECT u.id, u.username, u.full_name, u.email, u.phone, u.is_active,
                u.must_change_password, u.last_login, u.created_at,
                r.role_name, b.name AS branch_name
         FROM users u
         JOIN roles r ON u.role_id = r.id
         LEFT JOIN branches b ON u.branch_id = b.id
         WHERE ${whereClause}
         ORDER BY u.full_name
         LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
        [...params, limit || 20, offset]
      ),
      query(
        `SELECT COUNT(*)::int AS total FROM users u WHERE ${whereClause}`,
        params
      ),
    ]);

    return {
      success: true,
      data: {
        users: usersResult.rows,
        total: countResult.rows[0]?.total || 0,
        page: page || 1,
        limit: limit || 20,
      },
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ============================================================
// user:update
// ============================================================
ipcMain.handle('user:update', async (_event, { userId, companyId, data }) => {
  try {
    // Fetch current for audit
    const old = await query('SELECT * FROM users WHERE id = $1 AND company_id = $2', [userId, companyId]);
    if (old.rows.length === 0) {
      return { success: false, error: 'User not found' };
    }

    const sets = [];
    const params = [];
    let idx = 1;

    if (data.full_name !== undefined) {
      sets.push(`full_name = $${idx++}`);
      params.push(data.full_name);
    }
    if (data.email !== undefined) {
      sets.push(`email = $${idx++}`);
      params.push(data.email);
    }
    if (data.phone !== undefined) {
      sets.push(`phone = $${idx++}`);
      params.push(data.phone);
    }
    if (data.role_id !== undefined) {
      sets.push(`role_id = $${idx++}`);
      params.push(data.role_id);
    }
    if (data.branch_id !== undefined) {
      sets.push(`branch_id = $${idx++}`);
      params.push(data.branch_id);
    }

    if (sets.length === 0) {
      return { success: false, error: 'No fields to update' };
    }

    params.push(userId, companyId);

    await query(
      `UPDATE users SET ${sets.join(', ')} WHERE id = $${idx} AND company_id = $${idx + 1}`,
      params
    );

    // Audit
    try {
      await query(
        `INSERT INTO audit_log (company_id, user_id, action, table_name, record_id, old_values, new_values, created_at)
         VALUES ($1, $2, 'USER_UPDATE', 'users', $3, $4, $5, NOW())`,
        [companyId, userId, userId, JSON.stringify(old.rows[0]), JSON.stringify(data)]
      );
    } catch {
      // non-fatal
    }

    return { success: true, data: { message: 'User updated' } };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ============================================================
// user:toggle-active
// ============================================================
ipcMain.handle('user:toggle-active', async (_event, { userId, companyId }) => {
  try {
    const old = await query('SELECT is_active FROM users WHERE id = $1 AND company_id = $2', [userId, companyId]);
    if (old.rows.length === 0) {
      return { success: false, error: 'User not found' };
    }

    const newState = !old.rows[0].is_active;
    await query('UPDATE users SET is_active = $1 WHERE id = $2 AND company_id = $3', [newState, userId, companyId]);

    // Audit
    try {
      await query(
        `INSERT INTO audit_log (company_id, user_id, action, table_name, record_id, new_values, created_at)
         VALUES ($1, $2, 'USER_TOGGLE_ACTIVE', 'users', $3, $4, NOW())`,
        [companyId, userId, userId, JSON.stringify({ is_active: newState })]
      );
    } catch {
      // non-fatal
    }

    return { success: true, data: { is_active: newState } };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ============================================================
// user:reset-password
// ============================================================
ipcMain.handle('user:reset-password', async (_event, { userId, companyId, newPassword }) => {
  try {
    const passwordHash = await bcrypt.hash(newPassword, 10);

    await query(
      'UPDATE users SET password_hash = $1, must_change_password = TRUE WHERE id = $2 AND company_id = $3',
      [passwordHash, userId, companyId]
    );

    // Audit
    try {
      await query(
        `INSERT INTO audit_log (company_id, user_id, action, table_name, record_id, new_values, created_at)
         VALUES ($1, $2, 'USER_RESET_PASSWORD', 'users', $3, $4, NOW())`,
        [companyId, userId, userId, JSON.stringify({ password_reset: true })]
      );
    } catch {
      // non-fatal
    }

    return { success: true, data: { message: 'Password reset successfully' } };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ============================================================
// role:update-permissions
// ============================================================
ipcMain.handle('role:update-permissions', async (_event, { roleId, companyId, permissions }) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // SOD check
    const conflicts = checkSodConflicts(permissions);

    // Delete existing
    await client.query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);

    // Insert new
    for (const perm of permissions) {
      await client.query(
        `INSERT INTO role_permissions (role_id, permission_id)
         SELECT $1, p.id FROM permissions p
         WHERE p.module_code = $2 AND p.action_code = $3
         ON CONFLICT (role_id, permission_id) DO NOTHING`,
        [roleId, perm.module_code, perm.action_code]
      );
    }

    await client.query('COMMIT');

    // Audit
    try {
      await query(
        `INSERT INTO audit_log (company_id, action, table_name, record_id, new_values, created_at)
         VALUES ($1, 'ROLE_PERMISSIONS_UPDATE', 'role_permissions', $2, $3, NOW())`,
        [companyId, roleId, JSON.stringify({ count: permissions.length })]
      );
    } catch {
      // non-fatal
    }

    return {
      success: true,
      data: {
        message: 'Permissions updated',
        sodConflicts: conflicts.length > 0 ? conflicts : null,
      },
    };
  } catch (error) {
    await client.query('ROLLBACK');
    return { success: false, error: error.message };
  } finally {
    client.release();
  }
});

// ============================================================
// role:create
// ============================================================
ipcMain.handle('role:create', async (_event, { companyId, roleName, description, cloneFromRoleId }) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const roleResult = await client.query(
      `INSERT INTO roles (company_id, role_name, description)
       VALUES ($1, $2, $3)
       RETURNING id, role_name, description`,
      [companyId, roleName, description || null]
    );
    const newRole = roleResult.rows[0];

    // Clone permissions if requested
    if (cloneFromRoleId) {
      await client.query(
        `INSERT INTO role_permissions (role_id, permission_id)
         SELECT $1, permission_id FROM role_permissions WHERE role_id = $2
         ON CONFLICT DO NOTHING`,
        [newRole.id, cloneFromRoleId]
      );
    }

    await client.query('COMMIT');

    // Audit
    try {
      await query(
        `INSERT INTO audit_log (company_id, action, table_name, record_id, new_values, created_at)
         VALUES ($1, 'ROLE_CREATE', 'roles', $2, $3, NOW())`,
        [companyId, newRole.id, JSON.stringify({ roleName, description, clonedFrom: cloneFromRoleId })]
      );
    } catch {
      // non-fatal
    }

    return { success: true, data: newRole };
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') {
      return { success: false, error: `Role "${roleName}" already exists` };
    }
    return { success: false, error: error.message };
  } finally {
    client.release();
  }
});

// ============================================================
// role:get-with-user-count
// ============================================================
ipcMain.handle('role:get-with-user-count', async (_event, { companyId }) => {
  try {
    const result = await query(
      `SELECT r.id, r.role_name, r.description, r.is_system_role,
              COUNT(u.id)::int AS user_count
       FROM roles r
       LEFT JOIN users u ON u.role_id = r.id
       WHERE r.company_id = $1
       GROUP BY r.id
       ORDER BY r.is_system_role DESC, r.role_name`,
      [companyId]
    );
    return { success: true, data: result.rows };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ============================================================
// auth:get-company-id (helper for UI)
// ============================================================
ipcMain.handle('permission:list-all', async () => {
  try {
    const result = await query(
      'SELECT id, module_code, action_code, description FROM permissions ORDER BY module_code, action_code'
    );
    return { success: true, data: result.rows };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

export function registerFoundationIpc() {
  // All handlers registered at module level via ipcMain.handle()
  // This function exists for consistency with register pattern
}