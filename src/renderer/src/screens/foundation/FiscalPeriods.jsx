import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import toast from 'react-hot-toast';
import useAuthStore from '../../store/authStore';
import { formatHijriShort } from '../../utils/hijri';
import { Calendar, Lock, Unlock, Plus, AlertTriangle, Loader2 } from 'lucide-react';

const STATUS_COLORS = {
  open: { bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500', bar: 'bg-green-500' },
  closed: { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400', bar: 'bg-gray-300' },
  future: { bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-400', bar: 'bg-blue-300' },
};

function formatDate(dateStr, useHijri) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  if (useHijri) {
    return formatHijriShort(d);
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

function StatusBadge({ status }) {
  const c = STATUS_COLORS[status] || STATUS_COLORS.future;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${c.bg} ${c.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

StatusBadge.propTypes = {
  status: PropTypes.string.isRequired,
};

function ConfirmDialog({ open, title, message, onConfirm, onCancel, confirmLabel }) {
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onCancel}>
        <div
          className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-full bg-amber-100 p-2 text-amber-600">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
              <p className="text-sm text-gray-500">{message}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              {confirmLabel || 'Confirm'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

ConfirmDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  title: PropTypes.string.isRequired,
  message: PropTypes.string.isRequired,
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  confirmLabel: PropTypes.string,
};

export default function FiscalPeriods() {
  const { company } = useAuthStore();

  const [periods, setPeriods] = useState([]);
  const [years, setYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [startMonth, setStartMonth] = useState(1);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, periodId: null, periodName: '', message: '' });
  const [useHijri, setUseHijri] = useState(false);

  const loadPeriods = useCallback(() => {
    if (!company) return;
    setLoading(true);
    window.electronAPI
      .fiscalList({ companyId: company.id, year: selectedYear })
      .then((res) => {
        if (res.success) {
          setPeriods(res.data.periods);
          setYears(res.data.years);
          if (!selectedYear && res.data.years.length > 0) {
            setSelectedYear(res.data.years[0]);
          }
        } else {
          toast.error(res.error || 'Failed');
        }
      })
      .catch(() => toast.error('Connection error'))
      .finally(() => setLoading(false));
  }, [company, selectedYear]);

  useEffect(() => {
    if (!company) return;
    // Check calendar type
    window.electronAPI
      .getCompanyProfile({ companyId: company.id })
      .then((res) => {
        if (res.success && res.data.calendar_type === 'hijri') {
          setUseHijri(true);
        }
      })
      .catch(() => {});
    loadPeriods();
  }, [company, loadPeriods]);

  const handleGenerate = () => {
    if (!selectedYear) {
      toast.error('Please select a fiscal year');
      return;
    }
    setGenerating(true);
    window.electronAPI
      .fiscalGenerate({ companyId: company.id, year: selectedYear, startMonth })
      .then((res) => {
        if (res.success) {
          toast.success(res.data.message);
          loadPeriods();
        } else {
          toast.error(res.error || 'Failed');
        }
      })
      .catch(() => toast.error('Connection error'))
      .finally(() => setGenerating(false));
  };

  const handleOpen = (periodId) => {
    window.electronAPI
      .fiscalOpen({ periodId, companyId: company.id })
      .then((res) => {
        if (res.success) {
          toast.success(res.data.message);
          loadPeriods();
        } else {
          toast.error(res.error || 'Failed');
        }
      })
      .catch(() => toast.error('Connection error'));
  };

  const handleCloseConfirm = (period) => {
    if (period.status !== 'open') return;
    setConfirmDialog({
      open: true,
      periodId: period.id,
      periodName: period.period_name,
      message: `Are you sure you want to close "${period.period_name}"? This will prevent new transactions in this period.`,
    });
  };

  const handleCloseExecute = () => {
    const { periodId } = confirmDialog;
    setConfirmDialog({ open: false, periodId: null, periodName: '', message: '' });
    window.electronAPI
      .fiscalClose({ periodId, companyId: company.id })
      .then((res) => {
        if (res.success) {
          toast.success(res.data.message);
          loadPeriods();
        } else {
          toast.error(res.error || 'Failed');
          if (res.data?.unpostedCount) {
            toast.error(`${res.data.unpostedCount} unposted entries found`, { duration: 5000 });
          }
        }
      })
      .catch(() => toast.error('Connection error'));
  };

  // Build timeline data: 12 months of selected year
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const timelinePeriods = monthNames.map((_, i) => {
    const month = i + 1;
    const match = periods.find((p) => {
      const sd = new Date(p.start_date + 'T00:00:00');
      const ed = new Date(p.end_date + 'T00:00:00');
      const testDate = new Date(selectedYear || new Date().getFullYear(), i, 15);
      return testDate >= sd && testDate <= ed;
    });
    return { month, label: monthNames[i], period: match || null };
  });

  const monthSelectOptions = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' },
  ];

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-5 py-3">
        <h1 className="flex items-center gap-2 text-lg font-bold text-gray-900">
          <Calendar size={20} className="text-brand-500" />
          Fiscal Periods
        </h1>
        <div className="flex items-center gap-3">
          {/* Fiscal Year Selector */}
          <select
            value={selectedYear || ''}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-400 focus:outline-none"
          >
            {years.length === 0 && selectedYear && (
              <option value={selectedYear}>{selectedYear}</option>
            )}
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
            {years.length === 0 && !selectedYear && (
              <option value="">No years</option>
            )}
          </select>

          {/* Start Month */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500">Start:</span>
            <select
              value={startMonth}
              onChange={(e) => setStartMonth(Number(e.target.value))}
              className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-brand-400 focus:outline-none"
            >
              {monthSelectOptions.map((mo) => (
                <option key={mo.value} value={mo.value}>{mo.label}</option>
              ))}
            </select>
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={generating || !selectedYear}
            className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {generating ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Plus size={14} />
            )}
            Generate Periods
          </button>
        </div>
      </div>

      {/* Period Timeline */}
      <div className="border-b border-gray-100 bg-white px-5 py-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
          Period Timeline — {selectedYear || '—'}
        </h3>
        <div className="relative">
          {/* Timeline bar */}
          <div className="flex h-8 overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
            {timelinePeriods.map((tp) => {
              const status = tp.period ? tp.period.status : 'future';
              const c = STATUS_COLORS[status] || STATUS_COLORS.future;
              return (
                <div
                  key={tp.month}
                  className={`flex flex-1 items-center justify-center border-r border-white text-[10px] font-medium text-white last:border-r-0 ${c.bar}`}
                  title={tp.period ? `${tp.period.period_name}: ${status}` : `${tp.label}: No period`}
                >
                  {tp.label}
                </div>
              );
            })}
          </div>
          {/* Legend */}
          <div className="mt-2 flex items-center gap-4">
            {[
              { status: 'open', label: 'Open' },
              { status: 'closed', label: 'Closed' },
              { status: 'future', label: 'Future' },
            ].map((l) => {
              const c = STATUS_COLORS[l.status];
              return (
                <div key={l.status} className="flex items-center gap-1.5">
                  <span className={`h-3 w-3 rounded ${c.bar}`} />
                  <span className="text-xs text-gray-500">{l.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Periods Table */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="animate-spin text-brand-500" size={28} />
          </div>
        ) : periods.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Calendar size={48} className="mb-3 text-gray-300" />
            <p className="text-sm font-medium">No fiscal periods found</p>
            <p className="mt-1 text-xs">Click "Generate Periods" to create periods for the selected fiscal year</p>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50">
                <th className="px-5 py-2.5 text-xs font-medium text-gray-500 uppercase">Period Name</th>
                <th className="px-5 py-2.5 text-xs font-medium text-gray-500 uppercase">Start Date</th>
                <th className="px-5 py-2.5 text-xs font-medium text-gray-500 uppercase">End Date</th>
                <th className="px-5 py-2.5 text-xs font-medium text-gray-500 uppercase">Fiscal Year</th>
                <th className="px-5 py-2.5 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-5 py-2.5 text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {periods.map((period) => (
                <tr key={period.id} className="hover:bg-gray-50">
                  <td className="px-5 py-2.5 font-medium text-gray-900">{period.period_name}</td>
                  <td className="px-5 py-2.5 text-gray-600">
                    {formatDate(period.start_date, useHijri)}
                  </td>
                  <td className="px-5 py-2.5 text-gray-600">
                    {formatDate(period.end_date, useHijri)}
                  </td>
                  <td className="px-5 py-2.5 text-gray-600">{period.fiscal_year}</td>
                  <td className="px-5 py-2.5">
                    <StatusBadge status={period.status} />
                  </td>
                  <td className="px-5 py-2.5">
                    <div className="flex items-center gap-1">
                      {/* Open button */}
                      {(period.status === 'future' || period.status === 'closed') && (
                        <button
                          onClick={() => handleOpen(period.id)}
                          className="rounded p-1.5 text-green-600 hover:bg-green-50"
                          title="Open Period"
                        >
                          <Unlock size={15} />
                        </button>
                      )}
                      {/* Close button */}
                      {period.status === 'open' && (
                        <button
                          onClick={() => handleCloseConfirm(period)}
                          className="rounded p-1.5 text-amber-600 hover:bg-amber-50"
                          title="Close Period"
                        >
                          <Lock size={15} />
                        </button>
                      )}
                      {/* No action available */}
                      {period.status === 'closed' && !periods.some((p) => p.status !== 'closed') && (
                        <span className="text-xs text-gray-400 px-1">—</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Confirm Close Dialog */}
      <ConfirmDialog
        open={confirmDialog.open}
        title="Close Fiscal Period"
        message={confirmDialog.message}
        confirmLabel="Close Period"
        onConfirm={handleCloseExecute}
        onCancel={() => setConfirmDialog({ open: false, periodId: null, periodName: '', message: '' })}
      />
    </div>
  );
}