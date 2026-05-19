import { dialog, ipcMain } from 'electron';
import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { getClient, query } from '../db/pool.js';

// ============================================================
// FISCAL PERIODS
// ============================================================

ipcMain.handle('fiscal:list', async (_event, { companyId, year }) => {
  try {
    const conditions = ['company_id = $1'];
    const params = [companyId];
    let idx = 2;

    if (year) {
      conditions.push(`fiscal_year = $${++idx}`);
      params.push(year);
    }

    const result = await query(
      `SELECT * FROM fiscal_periods
       WHERE ${conditions.join(' AND ')}
       ORDER BY start_date`,
      params
    );

    // Get distinct years for dropdown
    const yearsResult = await query(
      `SELECT DISTINCT fiscal_year FROM fiscal_periods
       WHERE company_id = $1
       ORDER BY fiscal_year DESC`,
      [companyId]
    );

    return {
      success: true,
      data: {
        periods: result.rows,
        years: yearsResult.rows.map((r) => r.fiscal_year),
      },
    };
  } catch (error) {
    if (error.code === '42P01') {
      return { success: true, data: { periods: [], years: [] } };
    }
    return { success: false, error: error.message };
  }
});

ipcMain.handle('fiscal:generate', async (_event, { companyId, year, startMonth }) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];

    const sm = startMonth || 1;
    const periods = [];

    for (let i = 0; i < 12; i++) {
      const m = ((sm - 1 + i) % 12) + 1;
      const fiscalYear = sm === 1 || m >= sm ? year : year + 1;
      const monthName = monthNames[m - 1];
      const periodName = `${monthName} ${fiscalYear}`;

      // Compute start_date and end_date
      const startDate = new Date(fiscalYear, m - 1, 1);
      const endDate = new Date(fiscalYear, m, 0); // last day of month

      const startStr = startDate.toISOString().slice(0, 10);
      const endStr = endDate.toISOString().slice(0, 10);

      // Check if period already exists
      const existing = await client.query(
        'SELECT id FROM fiscal_periods WHERE company_id = $1 AND period_name = $2',
        [companyId, periodName]
      );

      if (existing.rows.length === 0) {
        const status = i === 0 ? 'open' : 'future';
        await client.query(
          `INSERT INTO fiscal_periods (company_id, period_name, start_date, end_date, status, fiscal_year)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [companyId, periodName, startStr, endStr, status, fiscalYear]
        );
        periods.push(periodName);
      }
    }

    await client.query('COMMIT');

    try {
      await query(
        `INSERT INTO audit_log (company_id, action, table_name, new_values, created_at)
         VALUES ($1, 'FISCAL_GENERATE', 'fiscal_periods', $2, NOW())`,
        [companyId, JSON.stringify({ year, startMonth: sm, count: periods.length })]
      );
    } catch {
      // non-fatal
    }

    return {
      success: true,
      data: { periods, message: `Generated ${periods.length} periods for fiscal year ${year}` },
    };
  } catch (error) {
    await client.query('ROLLBACK');
    return { success: false, error: error.message };
  } finally {
    client.release();
  }
});

ipcMain.handle('fiscal:open', async (_event, { periodId, companyId }) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Get the period
    const periodResult = await client.query(
      'SELECT * FROM fiscal_periods WHERE id = $1 AND company_id = $2',
      [periodId, companyId]
    );
    if (periodResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return { success: false, error: 'Period not found' };
    }
    const period = periodResult.rows[0];

    if (period.status === 'open') {
      await client.query('ROLLBACK');
      return { success: false, error: 'Period is already open' };
    }

    // Check for overlapping open periods
    const overlap = await client.query(
      `SELECT id, period_name, start_date, end_date FROM fiscal_periods
       WHERE company_id = $1 AND status = 'open'
         AND start_date <= $2::date AND end_date >= $3::date`,
      [companyId, period.end_date, period.start_date]
    );

    if (overlap.rows.length > 0) {
      await client.query('ROLLBACK');
      return {
        success: false,
        error: `Cannot open: overlaps with open period "${overlap.rows[0].period_name}" (${overlap.rows[0].start_date} - ${overlap.rows[0].end_date})`,
      };
    }

    // Update status
    await client.query(
      `UPDATE fiscal_periods SET status = 'open' WHERE id = $1 AND company_id = $2`,
      [periodId, companyId]
    );

    // Close any other open periods that overlap in months (non-overlapping, just precaution)
    // Not required since we already did overlap check

    await client.query('COMMIT');

    try {
      await query(
        `INSERT INTO audit_log (company_id, action, table_name, record_id, old_values, new_values, created_at)
         VALUES ($1, 'FISCAL_OPEN', 'fiscal_periods', $2, $3, $4, NOW())`,
        [companyId, periodId, JSON.stringify({ status: period.status }), JSON.stringify({ status: 'open' })]
      );
    } catch {
      // non-fatal
    }

    return { success: true, data: { message: `Period "${period.period_name}" opened` } };
  } catch (error) {
    await client.query('ROLLBACK');
    return { success: false, error: error.message };
  } finally {
    client.release();
  }
});

ipcMain.handle('fiscal:close', async (_event, { periodId, companyId }) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Get the period
    const periodResult = await client.query(
      'SELECT * FROM fiscal_periods WHERE id = $1 AND company_id = $2',
      [periodId, companyId]
    );
    if (periodResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return { success: false, error: 'Period not found' };
    }
    const period = periodResult.rows[0];

    if (period.status !== 'open') {
      await client.query('ROLLBACK');
      return { success: false, error: `Period is ${period.status}, not open` };
    }

    // Check for unposted transactions (placeholder query against a transactions table)
    let unpostedCount = 0;
    try {
      const unpostedResult = await client.query(
        `SELECT COUNT(*)::int AS count FROM journal_entries
         WHERE company_id = $1 AND date >= $2 AND date <= $3 AND is_posted = FALSE`,
        [companyId, period.start_date, period.end_date]
      );
      unpostedCount = unpostedResult.rows[0]?.count || 0;
    } catch {
      // table may not exist yet
    }

    if (unpostedCount > 0) {
      await client.query('ROLLBACK');
      return {
        success: false,
        error: `Cannot close: ${unpostedCount} unposted journal entry/entries exist in this period`,
        data: { unpostedCount },
      };
    }

    // Update status
    await client.query(
      `UPDATE fiscal_periods SET status = 'closed' WHERE id = $1 AND company_id = $2`,
      [periodId, companyId]
    );

    await client.query('COMMIT');

    try {
      await query(
        `INSERT INTO audit_log (company_id, action, table_name, record_id, old_values, new_values, created_at)
         VALUES ($1, 'FISCAL_CLOSE', 'fiscal_periods', $2, $3, $4, NOW())`,
        [companyId, periodId, JSON.stringify({ status: 'open' }), JSON.stringify({ status: 'closed' })]
      );
    } catch {
      // non-fatal
    }

    return { success: true, data: { message: `Period "${period.period_name}" closed` } };
  } catch (error) {
    await client.query('ROLLBACK');
    return { success: false, error: error.message };
  } finally {
    client.release();
  }
});

// ============================================================
// CURRENCIES
// ============================================================

ipcMain.handle('currency:list', async (_event, { companyId }) => {
  try {
    const result = await query(
      `SELECT * FROM currencies WHERE company_id = $1 ORDER BY is_base_currency DESC, currency_code`,
      [companyId]
    );
    return { success: true, data: result.rows };
  } catch (error) {
    if (error.code === '42P01') {
      return { success: true, data: [] };
    }
    return { success: false, error: error.message };
  }
});

ipcMain.handle('currency:add', async (_event, { companyId, currencyCode, currencyName, symbol, decimalPlaces }) => {
  try {
    const result = await query(
      `INSERT INTO currencies (company_id, currency_code, currency_name, symbol, decimal_places)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [companyId, currencyCode.toUpperCase(), currencyName, symbol || null, decimalPlaces || 2]
    );

    try {
      await query(
        `INSERT INTO audit_log (company_id, action, table_name, record_id, new_values, created_at)
         VALUES ($1, 'CURRENCY_ADD', 'currencies', $2, $3, NOW())`,
        [companyId, result.rows[0].id, JSON.stringify({ currencyCode, currencyName })]
      );
    } catch {
      // non-fatal
    }

    return { success: true, data: result.rows[0] };
  } catch (error) {
    if (error.code === '23505') {
      return { success: false, error: `Currency "${currencyCode}" already exists` };
    }
    return { success: false, error: error.message };
  }
});

ipcMain.handle('currency:toggle-active', async (_event, { currencyId, companyId }) => {
  try {
    const old = await query(
      'SELECT is_active, is_base_currency, currency_code FROM currencies WHERE id = $1 AND company_id = $2',
      [currencyId, companyId]
    );
    if (old.rows.length === 0) {
      return { success: false, error: 'Currency not found' };
    }

    const cur = old.rows[0];
    if (cur.is_base_currency && cur.is_active) {
      return { success: false, error: 'Cannot deactivate the base currency' };
    }

    const newState = !cur.is_active;
    await query(
      'UPDATE currencies SET is_active = $1 WHERE id = $2 AND company_id = $3',
      [newState, currencyId, companyId]
    );

    return { success: true, data: { is_active: newState, message: `${cur.currency_code} ${newState ? 'activated' : 'deactivated'}` } };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ============================================================
// EXCHANGE RATES
// ============================================================

ipcMain.handle('currency:rates-list', async (_event, { companyId, fromCurrency, toCurrency, dateFrom, dateTo }) => {
  try {
    const conditions = ['er.company_id = $1'];
    const params = [companyId];
    let idx = 2;

    if (fromCurrency) {
      conditions.push(`er.from_currency = $${idx++}`);
      params.push(fromCurrency.toUpperCase());
    }
    if (toCurrency) {
      conditions.push(`er.to_currency = $${idx++}`);
      params.push(toCurrency.toUpperCase());
    }
    if (dateFrom) {
      conditions.push(`er.effective_date >= $${idx++}`);
      params.push(dateFrom);
    }
    if (dateTo) {
      conditions.push(`er.effective_date <= $${idx++}`);
      params.push(dateTo);
    }

    const result = await query(
      `SELECT er.*, COALESCE(u.full_name, u.username) AS created_by_name
       FROM exchange_rates er
       LEFT JOIN users u ON er.created_by = u.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY er.effective_date DESC, er.created_at DESC
       LIMIT 200`,
      params
    );

    return { success: true, data: result.rows };
  } catch (error) {
    if (error.code === '42P01') {
      return { success: true, data: [] };
    }
    return { success: false, error: error.message };
  }
});

ipcMain.handle('currency:add-rate', async (_event, { companyId, fromCurrency, toCurrency, rate, effectiveDate, source }) => {
  try {
    const result = await query(
      `INSERT INTO exchange_rates (company_id, from_currency, to_currency, rate, effective_date, source, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, NULL)
       RETURNING *`,
      [companyId, fromCurrency.toUpperCase(), toCurrency.toUpperCase(), rate, effectiveDate, source || 'manual']
    );

    try {
      await query(
        `INSERT INTO audit_log (company_id, action, table_name, record_id, new_values, created_at)
         VALUES ($1, 'EXCHANGE_RATE_ADD', 'exchange_rates', $2, $3, NOW())`,
        [companyId, result.rows[0].id, JSON.stringify({ fromCurrency, toCurrency, rate, effectiveDate })]
      );
    } catch {
      // non-fatal
    }

    return { success: true, data: result.rows[0] };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('currency:fetch-live', async (_event, { companyId, baseCurrency }) => {
  try {
    // Try to fetch from exchangerate-api.com (free tier) or use mock data
    let rates = [];
    const targetCurrencies = ['EUR', 'GBP', 'JPY', 'SAR', 'AED', 'EGP', 'INR', 'CNY'];

    try {
      const response = await fetch(
        `https://api.exchangerate-api.com/v4/latest/${baseCurrency || 'USD'}`
      );
      const data = await response.json();

      if (data && data.rates) {
        const today = new Date().toISOString().slice(0, 10);
        for (const target of targetCurrencies) {
          if (data.rates[target]) {
            rates.push({
              fromCurrency: baseCurrency || 'USD',
              toCurrency: target,
              rate: data.rates[target],
              effectiveDate: today,
              source: 'api',
            });
          }
        }
      }
    } catch {
      // Fallback: mock rates if API is unavailable
      const today = new Date().toISOString().slice(0, 10);
      const mockRates = {
        USD: { EUR: 0.92, GBP: 0.79, JPY: 149.5, SAR: 3.75, AED: 3.67, EGP: 48.5, INR: 83.5, CNY: 7.24 },
        EUR: { USD: 1.09, GBP: 0.86, JPY: 162.3, SAR: 4.07, AED: 3.99, EGP: 52.8, INR: 90.8, CNY: 7.87 },
        SAR: { USD: 0.2667, EUR: 0.2457, GBP: 0.2107, JPY: 39.87, AED: 0.9787, EGP: 12.93, INR: 22.27, CNY: 1.931 },
      };

      const base = baseCurrency || 'USD';
      const rateSet = mockRates[base] || mockRates.USD;

      for (const [target, rate] of Object.entries(rateSet)) {
        rates.push({
          fromCurrency: base,
          toCurrency: target,
          rate,
          effectiveDate: today,
          source: 'mock',
        });
      }
    }

    // Insert fetched rates
    const inserted = [];
    for (const r of rates) {
      try {
        const result = await query(
          `INSERT INTO exchange_rates (company_id, from_currency, to_currency, rate, effective_date, source, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, NULL)
           ON CONFLICT DO NOTHING
           RETURNING *`,
          [companyId, r.fromCurrency, r.toCurrency, r.rate, r.effectiveDate, r.source]
        );
        if (result.rows.length > 0) {
          inserted.push(result.rows[0]);
        }
      } catch {
        // skip duplicates
      }
    }

    try {
      await query(
        `INSERT INTO audit_log (company_id, action, table_name, new_values, created_at)
         VALUES ($1, 'EXCHANGE_RATES_FETCH', 'exchange_rates', $2, NOW())`,
        [companyId, JSON.stringify({ count: inserted.length, source: inserted.length > 0 ? inserted[0].source : 'none' })]
      );
    } catch {
      // non-fatal
    }

    return { success: true, data: { inserted, message: `Fetched and inserted ${inserted.length} rates` } };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ============================================================
// COMPANY PROFILE
// ============================================================

ipcMain.handle('company:get-profile', async (_event, { companyId }) => {
  try {
    const result = await query(
      `SELECT * FROM companies WHERE id = $1`,
      [companyId]
    );
    if (result.rows.length === 0) {
      return { success: false, error: 'Company not found' };
    }
    return { success: true, data: result.rows[0] };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('company:update-profile', async (_event, { companyId, data }) => {
  try {
    const sets = [];
    const params = [];
    let idx = 1;

    const fields = [
      'legal_name', 'trade_name', 'tax_number', 'industry', 'company_type',
      'foundation_date', 'description', 'address', 'phone', 'email', 'website',
      'fax', 'city', 'state_province', 'postal_code', 'country',
      'default_language', 'calendar_type', 'date_format', 'time_zone',
      'number_format', 'base_currency', 'fiscal_year_start',
    ];

    for (const field of fields) {
      if (data[field] !== undefined) {
        sets.push(`${field} = $${idx++}`);
        params.push(data[field]);
      }
    }

    if (sets.length === 0) {
      return { success: false, error: 'No fields to update' };
    }

    params.push(companyId);

    await query(
      `UPDATE companies SET ${sets.join(', ')} WHERE id = $${idx}`,
      params
    );

    try {
      await query(
        `INSERT INTO audit_log (company_id, action, table_name, record_id, new_values, created_at)
         VALUES ($1, 'COMPANY_UPDATE', 'companies', $2, $3, NOW())`,
        [companyId, companyId, JSON.stringify(data)]
      );
    } catch {
      // non-fatal
    }

    return { success: true, data: { message: 'Company profile updated' } };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('company:upload-logo', async (_event, { companyId }) => {
  try {
    const result = await dialog.showOpenDialog({
      title: 'Select Company Logo',
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'svg', 'webp'] }],
      properties: ['openFile'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: true, data: null };
    }

    const srcPath = result.filePaths[0];
    const ext = srcPath.split('.').pop();
    const destDir = join(process.resourcesPath, '..', 'userData', 'logos');
    if (!existsSync(destDir)) {
      mkdirSync(destDir, { recursive: true });
    }

    const destFile = `${companyId}.${ext}`;
    const destPath = join(destDir, destFile);
    copyFileSync(srcPath, destPath);

    // Update the company logo_url
    await query(
      'UPDATE companies SET logo_url = $1 WHERE id = $2',
      [`logos/${destFile}`, companyId]
    );

    return { success: true, data: { path: destPath, name: destFile, url: `logos/${destFile}` } };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ============================================================
// BRANCHES
// ============================================================

ipcMain.handle('branch:create', async (_event, { companyId, code, name, address, city, phone, isHeadOffice }) => {
  try {
    const result = await query(
      `INSERT INTO branches (company_id, code, name, address, is_head_office, is_active)
       VALUES ($1, $2, $3, $4, $5, TRUE)
       RETURNING *`,
      [companyId, code, name, address || null, isHeadOffice || false]
    );

    try {
      const addr = city ? (address ? `${address}, ${city}` : city) : (address || null);
      if (addr) {
        await query('UPDATE branches SET address = $1 WHERE id = $2', [addr, result.rows[0].id]);
      }
    } catch {
      // non-fatal
    }

    try {
      await query(
        `INSERT INTO audit_log (company_id, action, table_name, record_id, new_values, created_at)
         VALUES ($1, 'BRANCH_CREATE', 'branches', $2, $3, NOW())`,
        [companyId, result.rows[0].id, JSON.stringify({ code, name })]
      );
    } catch {
      // non-fatal
    }

    return { success: true, data: result.rows[0] };
  } catch (error) {
    if (error.code === '23505') {
      return { success: false, error: `Branch code "${code}" already exists` };
    }
    return { success: false, error: error.message };
  }
});

ipcMain.handle('branch:update', async (_event, { branchId, companyId, data }) => {
  try {
    const sets = [];
    const params = [];
    let idx = 1;

    const fields = ['code', 'name', 'address', 'is_head_office'];
    for (const field of fields) {
      if (data[field] !== undefined) {
        sets.push(`${field} = $${idx++}`);
        params.push(data[field]);
      }
    }

    if (sets.length === 0) {
      return { success: false, error: 'No fields to update' };
    }

    params.push(branchId, companyId);

    await query(
      `UPDATE branches SET ${sets.join(', ')} WHERE id = $${idx} AND company_id = $${idx + 1}`,
      params
    );

    return { success: true, data: { message: 'Branch updated' } };
  } catch (error) {
    if (error.code === '23505') {
      return { success: false, error: 'Branch code already exists' };
    }
    return { success: false, error: error.message };
  }
});

ipcMain.handle('branch:toggle-active', async (_event, { branchId, companyId }) => {
  try {
    const old = await query(
      'SELECT is_active, id, name FROM branches WHERE id = $1 AND company_id = $2',
      [branchId, companyId]
    );
    if (old.rows.length === 0) {
      return { success: false, error: 'Branch not found' };
    }

    // Check users count if deactivating
    if (old.rows[0].is_active) {
      const users = await query(
        'SELECT COUNT(*)::int AS count FROM users WHERE branch_id = $1 AND is_active = TRUE',
        [branchId]
      );
      if (users.rows[0]?.count > 0) {
        return { success: false, error: `Cannot deactivate: ${users.rows[0].count} active user(s) assigned to this branch` };
      }
    }

    const newState = !old.rows[0].is_active;
    await query(
      'UPDATE branches SET is_active = $1 WHERE id = $2 AND company_id = $3',
      [newState, branchId, companyId]
    );

    return { success: true, data: { is_active: newState } };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

export function registerFiscalCurrenciesIpc() {
  // All handlers registered at module level via ipcMain.handle()
}