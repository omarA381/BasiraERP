import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import toast from 'react-hot-toast';
import useAuthStore from '../../store/authStore';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  DollarSign,
  RefreshCw,
  TrendingUp,
  Plus,
  Star,
  Globe,
  Loader2,
  X,
  Save,
  Power,
} from 'lucide-react';

// ---- Sub-components ----

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
              <TrendingUp size={20} />
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

// ---- Main Component ----

export default function Currencies() {
  const { company } = useAuthStore();

  // Currencies state
  const [currencies, setCurrencies] = useState([]);
  const [currenciesLoading, setCurrenciesLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ code: '', name: '', symbol: '', decimals: 2 });

  // Exchange rates state
  const [rates, setRates] = useState([]);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [filters, setFilters] = useState({ fromCurrency: '', toCurrency: '', dateFrom: '', dateTo: '' });
  const [showRateForm, setShowRateForm] = useState(false);
  const [rateForm, setRateForm] = useState({ fromCurrency: '', toCurrency: '', rate: '', effectiveDate: new Date().toISOString().slice(0, 10), source: 'manual' });
  const [fetchingLive, setFetchingLive] = useState(false);

  // Chart
  const [chartData, setChartData] = useState([]);
  const [chartPair, setChartPair] = useState('');

  // Base currency change dialog
  const [baseChangeDialog, setBaseChangeDialog] = useState({ open: false, currencyId: null, currencyName: '' });

  const loadCurrencies = useCallback(() => {
    if (!company) return;
    setCurrenciesLoading(true);
    window.electronAPI
      .currencyList({ companyId: company.id })
      .then((res) => {
        if (res.success) setCurrencies(res.data);
        else toast.error(res.error || 'Failed');
      })
      .catch(() => toast.error('Connection error'))
      .finally(() => setCurrenciesLoading(false));
  }, [company]);

  const loadRates = useCallback(() => {
    if (!company) return;
    setRatesLoading(true);
    window.electronAPI
      .currencyRatesList({
        companyId: company.id,
        fromCurrency: filters.fromCurrency || undefined,
        toCurrency: filters.toCurrency || undefined,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
      })
      .then((res) => {
        if (res.success) {
          setRates(res.data);
          // Build chart data from rates
          if (chartPair) {
            const [from, to] = chartPair.split('/');
            const filtered = res.data.filter((r) => r.from_currency === from && r.to_currency === to);
            const sorted = [...filtered].sort((a, b) => a.effective_date.localeCompare(b.effective_date));
            setChartData(sorted.map((r) => ({ date: r.effective_date, rate: parseFloat(r.rate) })));
          }
        } else {
          toast.error(res.error || 'Failed');
        }
      })
      .catch(() => toast.error('Connection error'))
      .finally(() => setRatesLoading(false));
  }, [company, filters, chartPair]);

  useEffect(() => {
    loadCurrencies();
  }, [company, loadCurrencies]);

  useEffect(() => {
    loadRates();
  }, [company, loadRates]);

  const handleAddCurrency = () => {
    if (!addForm.code || !addForm.name) {
      toast.error('Currency code and name are required');
      return;
    }
    window.electronAPI
      .currencyAdd({
        companyId: company.id,
        currencyCode: addForm.code,
        currencyName: addForm.name,
        symbol: addForm.symbol,
        decimalPlaces: addForm.decimals,
      })
      .then((res) => {
        if (res.success) {
          toast.success(`Currency "${addForm.code}" added`);
          setShowAddForm(false);
          setAddForm({ code: '', name: '', symbol: '', decimals: 2 });
          loadCurrencies();
        } else {
          toast.error(res.error || 'Failed');
        }
      })
      .catch(() => toast.error('Connection error'));
  };

  const handleToggleActive = (currency) => {
    if (currency.is_base_currency && currency.is_active) {
      toast.error('Cannot deactivate the base currency');
      return;
    }
    window.electronAPI
      .currencyToggleActive({ currencyId: currency.id, companyId: company.id })
      .then((res) => {
        if (res.success) {
          toast.success(res.data.message);
          loadCurrencies();
        } else {
          toast.error(res.error || 'Failed');
        }
      })
      .catch(() => toast.error('Connection error'));
  };

  const handleAddRate = () => {
    if (!rateForm.fromCurrency || !rateForm.toCurrency || !rateForm.rate || !rateForm.effectiveDate) {
      toast.error('All fields are required');
      return;
    }
    window.electronAPI
      .currencyAddRate({
        companyId: company.id,
        fromCurrency: rateForm.fromCurrency,
        toCurrency: rateForm.toCurrency,
        rate: parseFloat(rateForm.rate),
        effectiveDate: rateForm.effectiveDate,
        source: rateForm.source,
      })
      .then((res) => {
        if (res.success) {
          toast.success('Rate added');
          setShowRateForm(false);
          setRateForm({ fromCurrency: '', toCurrency: '', rate: '', effectiveDate: new Date().toISOString().slice(0, 10), source: 'manual' });
          loadRates();
        } else {
          toast.error(res.error || 'Failed');
        }
      })
      .catch(() => toast.error('Connection error'));
  };

  const handleFetchLive = () => {
    const baseCurrency = currencies.find((c) => c.is_base_currency);
    setFetchingLive(true);
    window.electronAPI
      .currencyFetchLive({
        companyId: company.id,
        baseCurrency: baseCurrency?.currency_code || 'USD',
      })
      .then((res) => {
        if (res.success) {
          toast.success(res.data.message);
          loadRates();
        } else {
          toast.error(res.error || 'Failed');
        }
      })
      .catch(() => toast.error('Connection error'))
      .finally(() => setFetchingLive(false));
  };

  const handleChartPairSelect = (pair) => {
    setChartPair(pair);
    const [from, to] = pair.split('/');
    setFilters((f) => ({ ...f, fromCurrency: from, toCurrency: to }));
  };

  const baseCurrency = currencies.find((c) => c.is_base_currency);

  // Generate currency pair suggestions for chart
  const currencyPairs = [];
  if (baseCurrency) {
    for (const c of currencies) {
      if (c.currency_code !== baseCurrency.currency_code && c.is_active) {
        currencyPairs.push(`${baseCurrency.currency_code}/${c.currency_code}`);
      }
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-5 py-3">
        <h1 className="flex items-center gap-2 text-lg font-bold text-gray-900">
          <DollarSign size={20} className="text-brand-500" />
          Currencies & Exchange Rates
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1.5 rounded-lg border border-brand-200 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50"
          >
            <Plus size={14} />
            Add Currency
          </button>
          <button
            onClick={handleFetchLive}
            disabled={fetchingLive}
            className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {fetchingLive ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <RefreshCw size={14} />
            )}
            Fetch Live Rates
          </button>
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Currencies list */}
        <div className="w-[40%] shrink-0 border-r border-gray-200 overflow-y-auto">
          {/* Inline Add Form */}
          {showAddForm && (
            <div className="border-b border-gray-200 bg-brand-50/50 px-5 py-3">
              <div className="grid grid-cols-4 gap-2">
                <input
                  placeholder="Code (e.g. USD)"
                  value={addForm.code}
                  onChange={(e) => setAddForm((a) => ({ ...a, code: e.target.value.toUpperCase() }))}
                  maxLength={3}
                  className="rounded border border-gray-300 px-2 py-1.5 text-xs"
                />
                <input
                  placeholder="Name"
                  value={addForm.name}
                  onChange={(e) => setAddForm((a) => ({ ...a, name: e.target.value }))}
                  className="rounded border border-gray-300 px-2 py-1.5 text-xs"
                />
                <input
                  placeholder="Symbol ($)"
                  value={addForm.symbol}
                  onChange={(e) => setAddForm((a) => ({ ...a, symbol: e.target.value }))}
                  className="rounded border border-gray-300 px-2 py-1.5 text-xs"
                />
                <input
                  type="number"
                  placeholder="Decimals"
                  value={addForm.decimals}
                  onChange={(e) => setAddForm((a) => ({ ...a, decimals: parseInt(e.target.value) || 0 }))}
                  min={0}
                  max={6}
                  className="rounded border border-gray-300 px-2 py-1.5 text-xs"
                />
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => { setShowAddForm(false); setAddForm({ code: '', name: '', symbol: '', decimals: 2 }); }}
                  className="rounded px-3 py-1 text-xs text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddCurrency}
                  className="flex items-center gap-1 rounded bg-brand-600 px-3 py-1 text-xs font-medium text-white hover:bg-brand-700"
                >
                  <Save size={11} />
                  Save
                </button>
              </div>
            </div>
          )}

          {/* Currencies Table */}
          {currenciesLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-brand-500" size={24} />
            </div>
          ) : currencies.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <DollarSign size={36} className="mb-2 text-gray-300" />
              <p className="text-sm">No currencies defined</p>
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-2 text-xs font-medium text-gray-500 uppercase">Code</th>
                  <th className="px-4 py-2 text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-4 py-2 text-xs font-medium text-gray-500 uppercase">Symbol</th>
                  <th className="px-4 py-2 text-xs font-medium text-gray-500 uppercase">Dec</th>
                  <th className="px-4 py-2 text-xs font-medium text-gray-500 uppercase">Base</th>
                  <th className="px-4 py-2 text-xs font-medium text-gray-500 uppercase">Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {currencies.map((cur) => (
                  <tr key={cur.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono font-medium text-gray-900">{cur.currency_code}</td>
                    <td className="px-4 py-2 text-gray-600">{cur.currency_name}</td>
                    <td className="px-4 py-2 text-gray-600">{cur.symbol || '—'}</td>
                    <td className="px-4 py-2 text-gray-500">{cur.decimal_places}</td>
                    <td className="px-4 py-2">
                      {cur.is_base_currency ? (
                        <Star size={14} className="text-amber-500 fill-amber-500" />
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <button
                        onClick={() => handleToggleActive(cur)}
                        className={`rounded p-1 ${
                          cur.is_active
                            ? 'text-green-600 hover:bg-green-50'
                            : 'text-gray-400 hover:bg-gray-100'
                        }`}
                        title={cur.is_active ? 'Deactivate' : 'Activate'}
                      >
                        <Power size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Right: Exchange Rates */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Filters */}
          <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50/50 px-4 py-2">
            <span className="text-xs font-medium text-gray-500">Filters:</span>
            <select
              value={filters.fromCurrency}
              onChange={(e) => setFilters((f) => ({ ...f, fromCurrency: e.target.value }))}
              className="rounded border border-gray-300 px-2 py-1 text-xs"
            >
              <option value="">From</option>
              {currencies.map((c) => (
                <option key={c.id} value={c.currency_code}>{c.currency_code}</option>
              ))}
            </select>
            <select
              value={filters.toCurrency}
              onChange={(e) => setFilters((f) => ({ ...f, toCurrency: e.target.value }))}
              className="rounded border border-gray-300 px-2 py-1 text-xs"
            >
              <option value="">To</option>
              {currencies.map((c) => (
                <option key={c.id} value={c.currency_code}>{c.currency_code}</option>
              ))}
            </select>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
              className="rounded border border-gray-300 px-2 py-1 text-xs"
            />
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
              className="rounded border border-gray-300 px-2 py-1 text-xs"
            />
            <button
              onClick={() => setFilters({ fromCurrency: '', toCurrency: '', dateFrom: '', dateTo: '' })}
              className="rounded px-2 py-1 text-xs text-gray-400 hover:text-gray-600"
            >
              <X size={14} />
            </button>
            <div className="flex-1" />
            <button
              onClick={() => setShowRateForm(!showRateForm)}
              className="flex items-center gap-1 rounded border border-brand-200 px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50"
            >
              <Plus size={12} />
              Add Rate
            </button>
          </div>

          {/* Add Rate Form */}
          {showRateForm && (
            <div className="border-b border-gray-200 bg-brand-50/50 px-4 py-3">
              <div className="flex items-center gap-2">
                <select
                  value={rateForm.fromCurrency}
                  onChange={(e) => setRateForm((r) => ({ ...r, fromCurrency: e.target.value }))}
                  className="rounded border border-gray-300 px-2 py-1.5 text-xs"
                >
                  <option value="">From Currency</option>
                  {currencies.map((c) => (
                    <option key={c.id} value={c.currency_code}>{c.currency_code} - {c.currency_name}</option>
                  ))}
                </select>
                <select
                  value={rateForm.toCurrency}
                  onChange={(e) => setRateForm((r) => ({ ...r, toCurrency: e.target.value }))}
                  className="rounded border border-gray-300 px-2 py-1.5 text-xs"
                >
                  <option value="">To Currency</option>
                  {currencies.map((c) => (
                    <option key={c.id} value={c.currency_code}>{c.currency_code} - {c.currency_name}</option>
                  ))}
                </select>
                <input
                  type="number"
                  step="0.00000001"
                  placeholder="Rate"
                  value={rateForm.rate}
                  onChange={(e) => setRateForm((r) => ({ ...r, rate: e.target.value }))}
                  className="w-28 rounded border border-gray-300 px-2 py-1.5 text-xs"
                />
                <input
                  type="date"
                  value={rateForm.effectiveDate}
                  onChange={(e) => setRateForm((r) => ({ ...r, effectiveDate: e.target.value }))}
                  className="rounded border border-gray-300 px-2 py-1.5 text-xs"
                />
                <select
                  value={rateForm.source}
                  onChange={(e) => setRateForm((r) => ({ ...r, source: e.target.value }))}
                  className="rounded border border-gray-300 px-2 py-1.5 text-xs"
                >
                  <option value="manual">Manual</option>
                  <option value="api">API</option>
                </select>
                <button
                  onClick={handleAddRate}
                  className="flex items-center gap-1 rounded bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
                >
                  <Save size={11} />
                  Save
                </button>
                <button
                  onClick={() => setShowRateForm(false)}
                  className="rounded px-2 py-1.5 text-xs text-gray-400 hover:text-gray-600"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-1 overflow-hidden">
            {/* Rates Table */}
            <div className="flex-1 overflow-y-auto">
              {ratesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="animate-spin text-brand-500" size={24} />
                </div>
              ) : rates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                  <TrendingUp size={36} className="mb-2 text-gray-300" />
                  <p className="text-sm">No exchange rates found</p>
                </div>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50">
                      <th className="px-4 py-2 text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-4 py-2 text-xs font-medium text-gray-500 uppercase">From</th>
                      <th className="px-4 py-2 text-xs font-medium text-gray-500 uppercase">To</th>
                      <th className="px-4 py-2 text-xs font-medium text-gray-500 uppercase">Rate</th>
                      <th className="px-4 py-2 text-xs font-medium text-gray-500 uppercase">Source</th>
                      <th className="px-4 py-2 text-xs font-medium text-gray-500 uppercase">Created By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {rates.map((r) => (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-gray-600">{r.effective_date}</td>
                        <td className="px-4 py-2 font-mono text-gray-800">{r.from_currency}</td>
                        <td className="px-4 py-2 font-mono text-gray-800">{r.to_currency}</td>
                        <td className="px-4 py-2 font-mono text-gray-900">{parseFloat(r.rate).toFixed(6)}</td>
                        <td className="px-4 py-2">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            r.source === 'api' ? 'bg-purple-50 text-purple-700' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {r.source}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-gray-500">{r.created_by_name || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Chart Panel */}
            <div className="w-[320px] shrink-0 border-l border-gray-200 p-3">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                Rate History
              </h4>
              <select
                value={chartPair}
                onChange={(e) => handleChartPairSelect(e.target.value)}
                className="mb-3 w-full rounded border border-gray-300 px-2 py-1 text-xs"
              >
                <option value="">Select pair...</option>
                {currencyPairs.map((pair) => (
                  <option key={pair} value={pair}>{pair}</option>
                ))}
              </select>

              {chartData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                  <Globe size={28} className="mb-1 text-gray-300" />
                  <p className="text-xs">Select a currency pair</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 9 }} angle={-45} textAnchor="end" height={40} />
                    <YAxis tick={{ fontSize: 9 }} domain={['auto', 'auto']} tickFormatter={(v) => v.toFixed(4)} />
                    <Tooltip
                      contentStyle={{ fontSize: 11, borderRadius: 8 }}
                      formatter={(value) => [parseFloat(value).toFixed(6), 'Rate']}
                    />
                    <Line
                      type="monotone"
                      dataKey="rate"
                      stroke="#2563eb"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}

              {/* Base Currency Info */}
              {baseCurrency && (
                <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <p className="text-xs font-medium text-gray-500">Base Currency</p>
                  <p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-gray-900">
                    <Star size={14} className="text-amber-500 fill-amber-500" />
                    {baseCurrency.currency_code} — {baseCurrency.currency_name}
                  </p>
                  <p className="mt-1 text-[10px] text-gray-400">
                    Changing the base currency affects all financial calculations.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}