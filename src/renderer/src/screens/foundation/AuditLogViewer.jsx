import { useState, useEffect, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import toast from 'react-hot-toast';
import useAuthStore from '../../store/authStore';
import { Shield, Search, Download, ChevronDown, ChevronUp, Clock, User, Filter, Lock } from 'lucide-react';

// ============================================================
// Constants
// ============================================================
const PAGE_SIZE = 50;
const ROW_HEIGHT = 48;
const OVERSCAN = 10;
const ACTION_TYPES = ['LOGIN', 'LOGOUT', 'CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT'];
const ACTION_COLORS = {
  LOGIN: 'bg-blue-100 text-blue-700',
  LOGOUT: 'bg-gray-100 text-gray-600',
  CREATE: 'bg-green-100 text-green-700',
  UPDATE: 'bg-amber-100 text-amber-700',
  DELETE: 'bg-red-100 text-red-600',
  APPROVE: 'bg-emerald-100 text-emerald-700',
  REJECT: 'bg-rose-100 text-rose-700',
};

// ============================================================
// Helpers
// ============================================================
function formatTimestamp(ts, calendarType) {
  if (!ts) return '—';
  const date = new Date(ts);
  const gregorian = date.toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  if (calendarType === 'hijri') {
    try {
      const hijri = date.toLocaleString('en-u-ca-islamic', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
      });
      return `${gregorian} (${hijri} AH)`;
    } catch {
      return gregorian;
    }
  }
  return gregorian;
}

function formatJson(json) {
  if (!json) return '—';
  try {
    const obj = typeof json === 'string' ? JSON.parse(json) : json;
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(json);
  }
}

function getChangedKeys(oldObj, newObj) {
  const changed = new Set();
  if (!oldObj || !newObj) return changed;
  const o = typeof oldObj === 'string' ? JSON.parse(oldObj) : oldObj;
  const n = typeof newObj === 'string' ? JSON.parse(newObj) : newObj;
  if (typeof o !== 'object' || typeof n !== 'object') return changed;
  for (const key of Object.keys(n)) {
    if (JSON.stringify(o[key]) !== JSON.stringify(n[key])) {
      changed.add(key);
    }
  }
  return changed;
}

// ============================================================
// ActionBadge
// ============================================================
function ActionBadge({ action }) {
  const colorClass = ACTION_COLORS[action] || 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${colorClass}`}>
      {action}
    </span>
  );
}

ActionBadge.propTypes = {
  action: PropTypes.string.isRequired,
};

// ============================================================
// ExpandedRow
// ============================================================
function ExpandedRow({ entry }) {
  const oldValues = entry.old_values;
  const newValues = entry.new_values;
  const changedKeys = getChangedKeys(oldValues, newValues);

  return (
    <div className="border-t border-gray-100 bg-gray-50 px-6 py-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase text-gray-500">Old Values</h4>
          <pre className="max-h-48 overflow-auto rounded-md bg-white p-3 text-xs leading-relaxed text-gray-700 shadow-inner">
            {formatJson(oldValues)
              .split('\n')
              .map((line, i) => {
                const keyMatch = line.match(/"(\w+)"/);
                const isChanged = keyMatch && changedKeys.has(keyMatch[1]);
                return (
                  <div
                    key={i}
                    className={isChanged ? 'bg-red-50 text-red-700 -mx-1 px-1' : ''}
                  >
                    {line}
                  </div>
                );
              })}
          </pre>
        </div>
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase text-gray-500">New Values</h4>
          <pre className="max-h-48 overflow-auto rounded-md bg-white p-3 text-xs leading-relaxed text-gray-700 shadow-inner">
            {formatJson(newValues)
              .split('\n')
              .map((line, i) => {
                const keyMatch = line.match(/"(\w+)"/);
                const isChanged = keyMatch && changedKeys.has(keyMatch[1]);
                return (
                  <div
                    key={i}
                    className={isChanged ? 'bg-green-50 text-green-700 -mx-1 px-1' : ''}
                  >
                    {line}
                  </div>
                );
              })}
          </pre>
        </div>
      </div>
      {entry.user_agent && (
        <div className="mt-3">
          <h4 className="mb-1 text-xs font-semibold uppercase text-gray-500">User Agent</h4>
          <p className="rounded-md bg-white p-2 text-xs text-gray-500 font-mono">{entry.user_agent}</p>
        </div>
      )}
    </div>
  );
}

ExpandedRow.propTypes = {
  entry: PropTypes.shape({
    old_values: PropTypes.any,
    new_values: PropTypes.any,
    user_agent: PropTypes.string,
  }).isRequired,
};

// ============================================================
// VirtualTable
// ============================================================
function VirtualTable({ entries, expandedId, onToggleExpand, calendarType }) {
  const containerRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(600);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entriesObs) => {
      for (const e of entriesObs) {
        setContainerHeight(e.contentRect.height);
      }
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const handleScroll = useCallback((e) => {
    setScrollTop(e.target.scrollTop);
  }, []);

  const startIdx = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const endIdx = Math.min(
    entries.length,
    Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + OVERSCAN,
  );
  const visibleEntries = entries.slice(startIdx, endIdx);
  const offsetY = startIdx * ROW_HEIGHT;
  const totalHeight = entries.length * ROW_HEIGHT;

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-auto"
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50">
              <th className="px-5 py-2.5 text-xs font-medium text-gray-500 uppercase w-[200px]">
                <div className="flex items-center gap-1.5">
                  <Clock size={12} />
                  Timestamp
                </div>
              </th>
              <th className="px-5 py-2.5 text-xs font-medium text-gray-500 uppercase w-[140px]">User</th>
              <th className="px-5 py-2.5 text-xs font-medium text-gray-500 uppercase w-[110px]">Action</th>
              <th className="px-5 py-2.5 text-xs font-medium text-gray-500 uppercase w-[130px]">Module/Table</th>
              <th className="px-5 py-2.5 text-xs font-medium text-gray-500 uppercase w-[120px]">Record ID</th>
              <th className="px-5 py-2.5 text-xs font-medium text-gray-500 uppercase w-[130px]">IP Address</th>
              <th className="px-5 py-2.5 text-xs font-medium text-gray-500 uppercase">Details</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ height: offsetY }} />
          {visibleEntries.map((entry) => {
            const isExpanded = expandedId === entry.id;
            return (
              <tr
                key={entry.id}
                className={`cursor-pointer border-b border-gray-50 transition-colors ${
                  isExpanded ? 'bg-brand-50/50' : 'hover:bg-gray-50'
                }`}
                onClick={() => onToggleExpand(entry.id)}
                style={{ height: ROW_HEIGHT }}
              >
                <td className="px-5 py-2.5 text-xs text-gray-600 font-mono whitespace-nowrap">
                  {formatTimestamp(entry.created_at, calendarType)}
                </td>
                <td className="px-5 py-2.5 text-sm text-gray-900 whitespace-nowrap">
                  {entry.user_name || 'System'}
                </td>
                <td className="px-5 py-2.5">
                  <ActionBadge action={entry.action} />
                </td>
                <td className="px-5 py-2.5 text-xs text-gray-500">
                  {entry.table_name || '—'}
                </td>
                <td className="px-5 py-2.5 text-xs text-gray-500 font-mono max-w-[100px] truncate">
                  {entry.record_id ? entry.record_id.substring(0, 8) + '…' : '—'}
                </td>
                <td className="px-5 py-2.5 text-xs text-gray-500 font-mono">
                  {entry.ip_address || '—'}
                </td>
                <td className="px-5 py-2.5">
                  <div className="flex items-center gap-1.5">
                    {isExpanded ? (
                      <ChevronUp size={14} className="text-brand-500" />
                    ) : (
                      <ChevronDown size={14} className="text-gray-400" />
                    )}
                    <span className="text-xs text-gray-500">
                      {entry.new_values ? 'Has data' : '—'}
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

VirtualTable.propTypes = {
  entries: PropTypes.array.isRequired,
  expandedId: PropTypes.number,
  onToggleExpand: PropTypes.func.isRequired,
  calendarType: PropTypes.string,
};

// ============================================================
// StatsPanel
// ============================================================
function StatsPanel({ stats }) {
  const maxActions = stats?.actionsPerDay?.length
    ? Math.max(...stats.actionsPerDay.map((d) => d.count), 1)
    : 1;

  return (
    <div className="space-y-5">
      {/* Actions per day chart */}
      <div>
        <h4 className="mb-3 text-xs font-semibold uppercase text-gray-500">
          Actions per Day (Last 30 Days)
        </h4>
        {stats?.actionsPerDay?.length ? (
          <div className="flex items-end gap-1 h-28">
            {stats.actionsPerDay.map((day) => (
              <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full rounded-t bg-brand-500 hover:bg-brand-600 transition-colors"
                  style={{
                    height: `${Math.max((day.count / maxActions) * 100, 4)}%`,
                  }}
                  title={`${day.date}: ${day.count} actions`}
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400">No data available</p>
        )}
        <div className="mt-2 flex justify-between text-[10px] text-gray-400">
          <span>30 days ago</span>
          <span>Today</span>
        </div>
      </div>

      {/* Top 5 users */}
      <div>
        <h4 className="mb-3 text-xs font-semibold uppercase text-gray-500">
          Top 5 Most Active Users
        </h4>
        {stats?.topUsers?.length ? (
          <div className="space-y-2">
            {stats.topUsers.map((u, idx) => (
              <div key={u.user_name || idx} className="flex items-center gap-3">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-100 text-[10px] font-bold text-brand-700">
                  {idx + 1}
                </span>
                <div className="flex-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-gray-700">
                      {u.user_name || 'System'}
                    </span>
                    <span className="text-gray-500">{u.count}</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full rounded-full bg-gray-100">
                    <div
                      className="h-1.5 rounded-full bg-brand-500"
                      style={{ width: `${(u.count / (stats.topUsers[0]?.count || 1)) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400">No data available</p>
        )}
      </div>
    </div>
  );
}

StatsPanel.propTypes = {
  stats: PropTypes.shape({
    actionsPerDay: PropTypes.array,
    topUsers: PropTypes.array,
  }),
};

// ============================================================
// Main Component
// ============================================================
export default function AuditLogViewer() {
  const { company } = useAuthStore();

  // --- Filter state ---
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterTable, setFilterTable] = useState('');
  const [filterIp, setFilterIp] = useState('');

  // --- Data state ---
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [users, setUsers] = useState([]);
  const [tables, setTables] = useState([]);
  const [statsOpen, setStatsOpen] = useState(false);
  const [stats, setStats] = useState(null);

  const searchTimer = useRef(null);

  // ============================================================
  // Load audit entries
  // ============================================================
  const loadEntries = useCallback(() => {
    if (!company) return;
    setLoading(true);
    const filters = {};
    if (dateFrom) filters.dateFrom = dateFrom;
    if (dateTo) filters.dateTo = dateTo;
    if (filterUser) filters.userId = filterUser;
    if (filterAction) filters.action = filterAction;
    if (filterTable) filters.tableName = filterTable;
    if (filterIp) filters.ipAddress = filterIp;

    window.electronAPI
      .auditQuery({ companyId: company.id, filters, page, limit: PAGE_SIZE })
      .then((res) => {
        if (res.success) {
          setEntries(res.data.entries);
          setTotal(res.data.total);
        } else {
          toast.error(res.error || 'Failed to load audit log');
        }
      })
      .catch(() => toast.error('Connection error'))
      .finally(() => setLoading(false));
  }, [company, dateFrom, dateTo, filterUser, filterAction, filterTable, filterIp, page]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  // ============================================================
  // Load users for dropdown (debounced)
  // ============================================================
  const loadUsers = useCallback(() => {
    if (!company) return;
    window.electronAPI
      .listUsers({ companyId: company.id, limit: 500 })
      .then((res) => {
        if (res.success) setUsers(res.data.users || []);
      })
      .catch(() => {});
  }, [company]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // ============================================================
  // Load distinct tables for dropdown
  // ============================================================
  useEffect(() => {
    if (!company) return;
    window.electronAPI
      .auditGetTables({ companyId: company.id })
      .then((res) => {
        if (res.success) setTables(res.data || []);
      })
      .catch(() => {});
  }, [company]);

  // ============================================================
  // Load stats
  // ============================================================
  const loadStats = useCallback(() => {
    if (!company) return;
    window.electronAPI
      .auditGetStats({ companyId: company.id })
      .then((res) => {
        if (res.success) setStats(res.data);
      })
      .catch(() => {});
  }, [company]);

  const toggleStats = () => {
    if (!statsOpen && !stats) {
      loadStats();
    }
    setStatsOpen((prev) => !prev);
  };

  // ============================================================
  // Toggle row expansion
  // ============================================================
  const handleToggleExpand = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  // ============================================================
  // Export CSV
  // ============================================================
  const handleExportCSV = () => {
    const filters = {};
    if (dateFrom) filters.dateFrom = dateFrom;
    if (dateTo) filters.dateTo = dateTo;
    if (filterUser) filters.userId = filterUser;
    if (filterAction) filters.action = filterAction;
    if (filterTable) filters.tableName = filterTable;
    if (filterIp) filters.ipAddress = filterIp;

    window.electronAPI
      .auditExportCsv({ companyId: company.id, filters })
      .then((res) => {
        if (res.success) {
          toast.success(res.data?.message || 'CSV exported successfully');
        } else {
          toast.error(res.error || 'Export failed');
        }
      })
      .catch(() => toast.error('Connection error'));
  };

  // ============================================================
  // Handle filter change with debounce
  // ============================================================
  const handleFilterChange = (setter) => (e) => {
    setter(e.target.value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setPage(1);
    }, 400);
  };

  const handleFilterChangeImmediate = (setter) => (e) => {
    setter(e.target.value);
    setPage(1);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, []);

  // ============================================================
  // Render
  // ============================================================
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="flex h-full flex-col">
      {/* 🔒 Disclaimer */}
      <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-5 py-2">
        <Lock size={14} className="text-amber-600 shrink-0" />
        <p className="text-xs font-medium text-amber-700">
          This log is append-only and cannot be modified.
        </p>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 bg-white px-5 py-2.5">
        {/* Date From */}
        <div className="flex items-center gap-1.5">
          <label className="text-[11px] font-medium text-gray-500 uppercase">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={handleFilterChangeImmediate(setDateFrom)}
            className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs focus:border-brand-400 focus:outline-none"
          />
        </div>
        {/* Date To */}
        <div className="flex items-center gap-1.5">
          <label className="text-[11px] font-medium text-gray-500 uppercase">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={handleFilterChangeImmediate(setDateTo)}
            className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs focus:border-brand-400 focus:outline-none"
          />
        </div>

        <div className="h-5 w-px bg-gray-200" />

        {/* User Dropdown */}
        <User size={14} className="text-gray-400 shrink-0" />
        <select
          value={filterUser}
          onChange={handleFilterChangeImmediate(setFilterUser)}
          className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs focus:border-brand-400 focus:outline-none"
        >
          <option value="">All Users</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.full_name || u.username}
            </option>
          ))}
        </select>

        {/* Action Dropdown */}
        <select
          value={filterAction}
          onChange={handleFilterChangeImmediate(setFilterAction)}
          className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs focus:border-brand-400 focus:outline-none"
        >
          <option value="">All Actions</option>
          {ACTION_TYPES.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>

        {/* Table Dropdown */}
        <select
          value={filterTable}
          onChange={handleFilterChangeImmediate(setFilterTable)}
          className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs focus:border-brand-400 focus:outline-none"
        >
          <option value="">All Tables</option>
          {tables.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        {/* IP Address */}
        <Search size={14} className="text-gray-400 shrink-0" />
        <input
          type="text"
          value={filterIp}
          onChange={handleFilterChange(setFilterIp)}
          placeholder="IP Address…"
          className="w-32 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs focus:border-brand-400 focus:outline-none"
        />

        <div className="ml-auto flex items-center gap-2">
          {/* Stats toggle */}
          <button
            onClick={toggleStats}
            className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              statsOpen
                ? 'bg-brand-100 text-brand-700'
                : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Filter size={13} />
            Statistics
          </button>

          {/* Export CSV */}
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
          >
            <Download size={13} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Stats Panel (collapsible) */}
      {statsOpen && (
        <div className="border-b border-gray-200 bg-white px-5 py-4">
          <div className="flex items-center gap-2 mb-4">
            <Shield size={16} className="text-brand-500" />
            <h3 className="text-sm font-semibold text-gray-700">Audit Statistics</h3>
          </div>
          <StatsPanel stats={stats} />
        </div>
      )}

      {/* Summary bar */}
      <div className="flex items-center justify-between border-b border-gray-100 bg-white px-5 py-1.5">
        <p className="text-xs text-gray-500">
          {total > 0 ? (
            <>
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of{' '}
              <span className="font-medium text-gray-700">{total}</span> entries
            </>
          ) : (
            'No entries'
          )}
        </p>
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-30"
            >
              ‹
            </button>
            <span className="text-xs text-gray-500 px-1">
              {page} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-30"
            >
              ›
            </button>
          </div>
        )}
      </div>

      {/* Table area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Shield size={40} className="mb-3" />
            <p className="text-sm">No audit entries found</p>
            <p className="mt-1 text-xs">Try adjusting your filters</p>
          </div>
        ) : (
          <>
            {/* Scrollable virtualized table */}
            <VirtualTable
              entries={entries}
              expandedId={expandedId}
              onToggleExpand={handleToggleExpand}
              calendarType={company?.calendar_type}
            />

            {/* Expanded row accordion (rendered below table) */}
            {expandedId !== null && (() => {
              const entry = entries.find((e) => e.id === expandedId);
              if (!entry) return null;
              return (
                <div className="shrink-0 border-t-2 border-brand-200">
                  <ExpandedRow entry={entry} />
                </div>
              );
            })()}
          </>
        )}
      </div>
    </div>
  );
}