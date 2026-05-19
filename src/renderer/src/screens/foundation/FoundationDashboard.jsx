import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import {
  Building2,
  Users,
  Calendar,
  Bell,
  Activity,
  Shield,
  Settings,
  BarChart2,
  Clock,
  Plus,
  GitBranch,
  Eye,
  TrendingUp,
  TrendingDown,
  Loader2,
} from 'lucide-react';

const SUB_NAV = [
  { label: 'Company Profile', icon: Building2, path: '/foundation/companies' },
  { label: 'Branches & Departments', icon: GitBranch, path: '/foundation/branches' },
  { label: 'Users & Roles', icon: Shield, path: '/foundation/users-roles' },
  { label: 'Workflow Designer', icon: Activity, path: '/foundation/workflows' },
  { label: 'Audit Log Viewer', icon: Eye, path: '/foundation/audit-log' },
  { label: 'System Settings', icon: Settings, path: '/foundation/settings' },
  { label: 'Currencies & Exchange Rates', icon: BarChart2, path: '/foundation/currencies' },
  { label: 'Fiscal Periods', icon: Calendar, path: '/foundation/fiscal-periods' },
  { label: 'Units of Measure', icon: BarChart2, path: '/foundation/uom' },
  { label: 'Tax Groups', icon: Building2, path: '/foundation/tax-groups' },
  { label: 'Number Series', icon: Activity, path: '/foundation/number-series' },
];

function formatTime(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function StatCard({ icon: Icon, number, label, trend }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-3 flex items-center justify-between">
        <span className="rounded-md bg-brand-50 p-2 text-brand-600">
          <Icon size={20} />
        </span>
        {trend !== undefined && (
          <span
            className={`flex items-center gap-1 text-xs font-medium ${
              trend >= 0 ? 'text-green-600' : 'text-red-500'
            }`}
          >
            {trend >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900">{number}</p>
      <p className="mt-1 text-sm text-gray-500">{label}</p>
    </div>
  );
}

StatCard.propTypes = {
  icon: PropTypes.elementType.isRequired,
  number: PropTypes.number.isRequired,
  label: PropTypes.string.isRequired,
  trend: PropTypes.number,
};

export default function FoundationDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { company } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!company) return;
    setLoading(true);
    setError('');
    window.electronAPI
      .getFoundationStats({ companyId: company.id })
      .then((res) => {
        if (res.success) {
          setStats(res.data);
        } else {
          setError(res.error || 'Failed to load dashboard data');
        }
      })
      .catch(() => setError('Connection error'))
      .finally(() => setLoading(false));
  }, [company]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="animate-spin text-brand-500" size={32} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  const s = stats || {};

  return (
    <div className="flex h-full">
      {/* Sub-navigation sidebar */}
      <aside className="w-56 shrink-0 overflow-y-auto border-r border-gray-200 bg-gray-50 py-2">
        <div className="px-3 pb-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Foundation
          </p>
        </div>
        <nav>
          {SUB_NAV.map((item) => {
            const Icon = item.icon;
            const isActive = item.path === '/foundation/users-roles' && window.location.hash.includes('users-roles');
            return (
              <button
                key={item.label}
                onClick={() => navigate(item.path)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                  isActive
                    ? 'bg-brand-50 font-medium text-brand-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Icon size={16} className="shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-6">
        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">Foundation Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Overview of system foundation and configuration
          </p>
        </div>

        {/* Stats cards */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={Users}
            number={s.activeUsers || 0}
            label="Active Users"
            trend={5}
          />
          <StatCard
            icon={Building2}
            number={s.activeCompanies || 0}
            label="Active Companies"
          />
          <StatCard
            icon={Calendar}
            number={s.openPeriods || 0}
            label="Open Fiscal Periods"
          />
          <StatCard
            icon={Bell}
            number={s.pendingApprovals || 0}
            label="Pending Approvals"
            trend={-2}
          />
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Recent Audit Activity */}
          <div className="lg:col-span-2 rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <Clock size={16} className="text-brand-500" />
                Recent Audit Activity
              </h2>
              <button
                onClick={() => navigate('/foundation/audit-log')}
                className="text-xs font-medium text-brand-600 hover:text-brand-700"
              >
                View All →
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-5 py-2 text-xs font-medium text-gray-500 uppercase">Timestamp</th>
                    <th className="px-5 py-2 text-xs font-medium text-gray-500 uppercase">User</th>
                    <th className="px-5 py-2 text-xs font-medium text-gray-500 uppercase">Action</th>
                    <th className="px-5 py-2 text-xs font-medium text-gray-500 uppercase">Table</th>
                    <th className="px-5 py-2 text-xs font-medium text-gray-500 uppercase">IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {(s.recentAudit || []).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-gray-400">
                        No audit entries yet
                      </td>
                    </tr>
                  ) : (
                    (s.recentAudit || []).map((entry) => (
                      <tr key={entry.id} className="hover:bg-gray-50">
                        <td className="whitespace-nowrap px-5 py-2.5 text-gray-600">
                          {formatTime(entry.created_at)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-2.5 font-medium text-gray-800">
                          {entry.user_name}
                        </td>
                        <td className="whitespace-nowrap px-5 py-2.5">
                          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                            {entry.action}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-5 py-2.5 text-gray-500">
                          {entry.table_name || '—'}
                        </td>
                        <td className="whitespace-nowrap px-5 py-2.5 font-mono text-xs text-gray-400">
                          {entry.ip_address || '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quick Actions + Fiscal Period */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-100 px-5 py-3">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <Activity size={16} className="text-brand-500" />
                  Quick Actions
                </h2>
              </div>
              <div className="space-y-1 p-3">
                <button
                  onClick={() => navigate('/foundation/users-roles')}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-gray-600 hover:bg-brand-50 hover:text-brand-700"
                >
                  <Plus size={14} />
                  New User
                </button>
                <button
                  onClick={() => navigate('/foundation/branches')}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-gray-600 hover:bg-brand-50 hover:text-brand-700"
                >
                  <Plus size={14} />
                  New Branch
                </button>
                <button
                  onClick={() => navigate('/foundation/audit-log')}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-gray-600 hover:bg-brand-50 hover:text-brand-700"
                >
                  <Eye size={14} />
                  View Audit Log
                </button>
              </div>
            </div>

            {/* Fiscal Period Status */}
            <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-100 px-5 py-3">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <Calendar size={16} className="text-brand-500" />
                  Fiscal Period Status
                </h2>
              </div>
              <div className="p-5">
                <div className="relative flex items-center justify-between">
                  {/* Horizontal timeline */}
                  <div className="absolute left-0 right-0 top-1/2 h-0.5 -translate-y-1/2 bg-gray-200" />
                  {['Q1', 'Q2', 'Q3', 'Q4'].map((q, i) => {
                    const status = i === 0 ? 'open' : i === 1 ? 'open' : i === 2 ? 'closed' : 'overdue';
                    const colors = {
                      open: 'bg-green-500 border-green-600',
                      closed: 'bg-gray-300 border-gray-400',
                      overdue: 'bg-red-500 border-red-600',
                    };
                    return (
                      <div key={q} className="relative z-10 flex flex-col items-center gap-1">
                        <div
                          className={`h-4 w-4 rounded-full border-2 ${colors[status]}`}
                        />
                        <span className="text-xs font-medium text-gray-600">{q}</span>
                        <span
                          className={`text-[10px] font-semibold uppercase ${
                            status === 'open'
                              ? 'text-green-600'
                              : status === 'overdue'
                                ? 'text-red-500'
                                : 'text-gray-400'
                          }`}
                        >
                          {status}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-4 text-center text-xs text-gray-400">
                  Current period: Q2 2025 — Open
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}