import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import toast from 'react-hot-toast';
import useAuthStore from '../../store/authStore';
import { formatHijri } from '../../utils/hijri';
import {
  Building2,
  MapPin,
  Globe,
  Settings,
  Upload,
  Plus,
  Edit,
  Save,
  Loader2,
  Star,
  Phone,
  Mail,
  AlertTriangle,
  Power,
  DollarSign,
} from 'lucide-react';

const TABS = [
  { id: 'general', label: 'General Info', icon: Building2 },
  { id: 'contact', label: 'Contact & Location', icon: MapPin },
  { id: 'regional', label: 'Regional Settings', icon: Globe },
  { id: 'branches', label: 'Branches', icon: Settings },
];

const INDUSTRIES = [
  'Agriculture', 'Automotive', 'Banking', 'Construction', 'Education',
  'Energy', 'Finance', 'Healthcare', 'Hospitality', 'IT & Technology',
  'Manufacturing', 'Real Estate', 'Retail', 'Telecommunications',
  'Transportation', 'Wholesale', 'Other',
];

const COMPANY_TYPES = ['LLC', 'JSC', 'Sole Proprietorship', 'Partnership', 'Branch', 'NGO', 'Other'];

const DATE_FORMATS = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'];

const NUMBER_FORMATS = ['1,234.56', '1.234,56'];

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'ar', label: 'العربية (Arabic)' },
  { value: 'fr', label: 'Français (French)' },
];

const TIMEZONE_GROUPS = [
  {
    label: 'Africa',
    zones: ['Africa/Cairo', 'Africa/Casablanca', 'Africa/Johannesburg', 'Africa/Lagos', 'Africa/Nairobi'],
  },
  {
    label: 'Asia',
    zones: ['Asia/Dubai', 'Asia/Kolkata', 'Asia/Riyadh', 'Asia/Singapore', 'Asia/Tokyo'],
  },
  {
    label: 'Europe',
    zones: ['Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Moscow'],
  },
  {
    label: 'Americas',
    zones: ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Sao_Paulo'],
  },
];

const MONTHS = [
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

// ---- Sub-components ----

function ConfirmDialog({ open, title, message, onConfirm, onCancel, confirmLabel, variant }) {
  if (!open) return null;
  const isWarning = variant === 'warning';
  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onCancel}>
        <div
          className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-4 flex items-center gap-3">
            <div className={`rounded-full p-2 ${isWarning ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
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
              className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium text-white hover:opacity-90 ${
                isWarning ? 'bg-red-600 hover:bg-red-700' : 'bg-brand-600 hover:bg-brand-700'
              }`}
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
  variant: PropTypes.string,
};

// ---- Main Component ----

export default function CompanyProfile() {
  const { company } = useAuthStore();

  const [activeTab, setActiveTab] = useState('general');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState(null);
  const [formData, setFormData] = useState({});
  const [dirtyFields, setDirtyFields] = useState(new Set());
  const [confirmSwitch, setConfirmSwitch] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);

  // Branches state
  const [branches, setBranches] = useState([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [showBranchForm, setShowBranchForm] = useState(false);
  const [editingBranchId, setEditingBranchId] = useState(null);
  const [branchForm, setBranchForm] = useState({ code: '', name: '', address: '', city: '', phone: '', isHeadOffice: false });

  const loadProfile = useCallback(() => {
    if (!company) return;
    setLoading(true);
    window.electronAPI
      .getCompanyProfile({ companyId: company.id })
      .then((res) => {
        if (res.success) {
          setProfile(res.data);
          setFormData(res.data);
          if (res.data.logo_url) {
            setLogoPreview(res.data.logo_url);
          }
        } else {
          toast.error(res.error || 'Failed');
        }
      })
      .catch(() => toast.error('Connection error'))
      .finally(() => setLoading(false));
  }, [company]);

  const loadBranches = useCallback(() => {
    if (!company) return;
    setBranchesLoading(true);
    window.electronAPI
      .listBranches({ companyId: company.id })
      .then((res) => {
        if (res.success) setBranches(res.data);
        else toast.error(res.error || 'Failed');
      })
      .catch(() => toast.error('Connection error'))
      .finally(() => setBranchesLoading(false));
  }, [company]);

  useEffect(() => {
    loadProfile();
    loadBranches();
  }, [company, loadProfile, loadBranches]);

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setDirtyFields((prev) => new Set([...prev, field]));
  };

  const isDirty = dirtyFields.size > 0;

  const handleTabSwitch = (tabId) => {
    if (tabId === activeTab) return;
    if (isDirty) {
      setConfirmSwitch(tabId);
    } else {
      setActiveTab(tabId);
    }
  };

  const confirmTabSwitch = () => {
    if (confirmSwitch) {
      setActiveTab(confirmSwitch);
      setConfirmSwitch(null);
    }
  };

  const handleSave = () => {
    const data = {};
    for (const field of dirtyFields) {
      data[field] = formData[field];
    }
    setSaving(true);
    window.electronAPI
      .updateCompanyProfile({ companyId: company.id, data })
      .then((res) => {
        if (res.success) {
          toast.success('Profile saved');
          setDirtyFields(new Set());
          loadProfile();
        } else {
          toast.error(res.error || 'Failed');
        }
      })
      .catch(() => toast.error('Connection error'))
      .finally(() => setSaving(false));
  };

  const handleLogoUpload = () => {
    window.electronAPI
      .uploadCompanyLogo({ companyId: company.id })
      .then((res) => {
        if (res.success && res.data) {
          setLogoPreview(res.data.url);
          toast.success('Logo uploaded');
        }
      })
      .catch(() => toast.error('Connection error'));
  };

  // Branch actions
  const handleAddBranch = () => {
    if (!branchForm.code || !branchForm.name) {
      toast.error('Code and Name are required');
      return;
    }
    const payload = {
      companyId: company.id,
      code: branchForm.code,
      name: branchForm.name,
      address: branchForm.city ? `${branchForm.address || ''}, ${branchForm.city}`.trim() : (branchForm.address || null),
      city: branchForm.city,
      phone: branchForm.phone,
      isHeadOffice: branchForm.isHeadOffice,
    };
    window.electronAPI
      .createBranch(payload)
      .then((res) => {
        if (res.success) {
          toast.success('Branch added');
          setShowBranchForm(false);
          setBranchForm({ code: '', name: '', address: '', city: '', phone: '', isHeadOffice: false });
          loadBranches();
        } else {
          toast.error(res.error || 'Failed');
        }
      })
      .catch(() => toast.error('Connection error'));
  };

  const handleEditBranch = (branch) => {
    setEditingBranchId(branch.id);
    setBranchForm({
      code: branch.code,
      name: branch.name,
      address: branch.address || '',
      city: '',
      phone: branch.phone || '',
      isHeadOffice: branch.is_head_office,
    });
  };

  const handleUpdateBranch = () => {
    window.electronAPI
      .updateBranch({
        branchId: editingBranchId,
        companyId: company.id,
        data: {
          code: branchForm.code,
          name: branchForm.name,
          address: branchForm.address,
          is_head_office: branchForm.isHeadOffice,
        },
      })
      .then((res) => {
        if (res.success) {
          toast.success('Branch updated');
          setEditingBranchId(null);
          setBranchForm({ code: '', name: '', address: '', city: '', phone: '', isHeadOffice: false });
          loadBranches();
        } else {
          toast.error(res.error || 'Failed');
        }
      })
      .catch(() => toast.error('Connection error'));
  };

  const handleToggleBranch = (branch) => {
    window.electronAPI
      .toggleBranchActive({ branchId: branch.id, companyId: company.id })
      .then((res) => {
        if (res.success) {
          toast.success(`Branch ${res.data.is_active ? 'activated' : 'deactivated'}`);
          loadBranches();
        } else {
          toast.error(res.error || 'Failed');
        }
      })
      .catch(() => toast.error('Connection error'));
  };

  // Hijri preview
  const today = new Date();
  const hijriDate = formatHijri(today);

  if (loading && !profile) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="animate-spin text-brand-500" size={32} />
      </div>
    );
  }

  const f = formData || {};

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-5 py-3">
        <h1 className="flex items-center gap-2 text-lg font-bold text-gray-900">
          <Building2 size={20} className="text-brand-500" />
          Company Profile
        </h1>
        <button
          onClick={handleSave}
          disabled={saving || !isDirty}
          className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {saving ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Save size={14} />
          )}
          Save Changes
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-white px-5">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabSwitch(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                isActive
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* ===== Tab 1: General Info ===== */}
        {activeTab === 'general' && (
          <div className="space-y-6">
            {/* Logo */}
            <div className="flex items-start gap-6">
              <div>
                <div className="h-[150px] w-[150px] overflow-hidden rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center">
                  {logoPreview ? (
                    <img
                      src={logoPreview}
                      alt="Company Logo"
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <div className="flex flex-col items-center text-gray-400">
                      <Building2 size={36} />
                      <span className="mt-1 text-xs">No Logo</span>
                    </div>
                  )}
                </div>
                <button
                  onClick={handleLogoUpload}
                  className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
                >
                  <Upload size={12} />
                  Upload Logo
                </button>
              </div>

              <div className="flex-1 grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Legal Name</label>
                  <input
                    type="text"
                    value={f.legal_name || ''}
                    onChange={(e) => updateField('legal_name', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-400 focus:ring-1 focus:ring-brand-400/20 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Trade Name</label>
                  <input
                    type="text"
                    value={f.trade_name || ''}
                    onChange={(e) => updateField('trade_name', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-400 focus:ring-1 focus:ring-brand-400/20 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Company Code</label>
                  <input
                    type="text"
                    value={f.code || ''}
                    readOnly
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Tax Number</label>
                  <input
                    type="text"
                    value={f.tax_number || ''}
                    onChange={(e) => updateField('tax_number', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-400 focus:ring-1 focus:ring-brand-400/20 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Industry</label>
                  <select
                    value={f.industry || ''}
                    onChange={(e) => updateField('industry', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-400 focus:ring-1 focus:ring-brand-400/20 focus:outline-none"
                  >
                    <option value="">Select Industry</option>
                    {INDUSTRIES.map((ind) => (
                      <option key={ind} value={ind}>{ind}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Company Type</label>
                  <select
                    value={f.company_type || ''}
                    onChange={(e) => updateField('company_type', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-400 focus:ring-1 focus:ring-brand-400/20 focus:outline-none"
                  >
                    <option value="">Select Type</option>
                    {COMPANY_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Foundation Date</label>
                  <input
                    type="date"
                    value={f.foundation_date ? f.foundation_date.slice(0, 10) : ''}
                    onChange={(e) => updateField('foundation_date', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-400 focus:ring-1 focus:ring-brand-400/20 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Description / About</label>
              <textarea
                value={f.description || ''}
                onChange={(e) => updateField('description', e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-400 focus:ring-1 focus:ring-brand-400/20 focus:outline-none"
                placeholder="Brief description of the company..."
              />
            </div>
          </div>
        )}

        {/* ===== Tab 2: Contact & Location ===== */}
        {activeTab === 'contact' && (
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-700">Address</h3>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Country</label>
                <input
                  type="text"
                  value={f.country || ''}
                  onChange={(e) => updateField('country', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-400 focus:ring-1 focus:ring-brand-400/20 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">City</label>
                  <input
                    type="text"
                    value={f.city || ''}
                    onChange={(e) => updateField('city', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-400 focus:ring-1 focus:ring-brand-400/20 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">State / Province</label>
                  <input
                    type="text"
                    value={f.state_province || ''}
                    onChange={(e) => updateField('state_province', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-400 focus:ring-1 focus:ring-brand-400/20 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Postal Code</label>
                <input
                  type="text"
                  value={f.postal_code || ''}
                  onChange={(e) => updateField('postal_code', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-400 focus:ring-1 focus:ring-brand-400/20 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Address Line 1</label>
                <input
                  type="text"
                  value={f.address || ''}
                  onChange={(e) => updateField('address', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-400 focus:ring-1 focus:ring-brand-400/20 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Address Line 2</label>
                <input
                  type="text"
                  value={f.address2 || ''}
                  onChange={(e) => updateField('address2', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-400 focus:ring-1 focus:ring-brand-400/20 focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-700">Contact Details</h3>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Phone</label>
                <div className="relative">
                  <Phone size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={f.phone || ''}
                    onChange={(e) => updateField('phone', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-brand-400 focus:ring-1 focus:ring-brand-400/20 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Fax</label>
                <div className="relative">
                  <Phone size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={f.fax || ''}
                    onChange={(e) => updateField('fax', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-brand-400 focus:ring-1 focus:ring-brand-400/20 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Email</label>
                <div className="relative">
                  <Mail size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    value={f.email || ''}
                    onChange={(e) => updateField('email', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-brand-400 focus:ring-1 focus:ring-brand-400/20 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Website</label>
                <div className="relative">
                  <Globe size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={f.website || ''}
                    onChange={(e) => updateField('website', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-brand-400 focus:ring-1 focus:ring-brand-400/20 focus:outline-none"
                  />
                </div>
              </div>

              {/* Map placeholder */}
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin size={14} className="text-brand-500" />
                  <h4 className="text-xs font-medium text-gray-600">Location Preview</h4>
                </div>
                <div className="rounded-md bg-white border border-gray-200 p-3 text-xs text-gray-500 space-y-0.5">
                  {f.address && <p>{f.address}</p>}
                  {f.city && f.state_province && <p>{f.city}, {f.state_province} {f.postal_code || ''}</p>}
                  {f.country && <p>{f.country}</p>}
                  {!f.address && !f.city && !f.country && (
                    <p className="italic text-gray-400">Address not configured</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===== Tab 3: Regional Settings ===== */}
        {activeTab === 'regional' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              {/* Base Currency */}
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Base Currency</label>
                <div className="relative">
                  <DollarSign size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={f.base_currency || ''}
                    readOnly
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm text-gray-500 cursor-not-allowed"
                  />
                </div>
                <p className="mt-1 text-[10px] text-amber-600">
                  Base currency cannot be changed after first save. Affects all financial reports.
                </p>
              </div>

              {/* Default Language */}
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Default Language</label>
                <select
                  value={f.default_language || 'en'}
                  onChange={(e) => updateField('default_language', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-400 focus:ring-1 focus:ring-brand-400/20 focus:outline-none"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
              </div>

              {/* Calendar Type */}
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Calendar Type</label>
                <div className="flex items-center gap-4 pt-1">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="calendar_type"
                      value="gregorian"
                      checked={f.calendar_type === 'gregorian'}
                      onChange={(e) => updateField('calendar_type', e.target.value)}
                      className="h-4 w-4 text-brand-600"
                    />
                    Gregorian
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="calendar_type"
                      value="hijri"
                      checked={f.calendar_type === 'hijri'}
                      onChange={(e) => updateField('calendar_type', e.target.value)}
                      className="h-4 w-4 text-brand-600"
                    />
                    Hijri
                  </label>
                </div>
                {/* Date Preview */}
                <div className="mt-2 rounded-md bg-gray-50 border border-gray-200 p-3">
                  <p className="text-xs font-medium text-gray-500">Date Preview</p>
                  <div className="mt-1 space-y-1">
                    <p className="text-sm text-gray-700">
                      <span className="text-gray-400">Gregorian:</span>{' '}
                      {today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                    <p className="text-sm text-gray-700">
                      <span className="text-gray-400">Hijri:</span> {hijriDate}
                    </p>
                  </div>
                </div>
              </div>

              {/* Date Format */}
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Date Format</label>
                <select
                  value={f.date_format || 'DD/MM/YYYY'}
                  onChange={(e) => updateField('date_format', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-400 focus:ring-1 focus:ring-brand-400/20 focus:outline-none"
                >
                  {DATE_FORMATS.map((df) => (
                    <option key={df} value={df}>{df}</option>
                  ))}
                </select>
              </div>

              {/* Time Zone */}
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Time Zone</label>
                <select
                  value={f.time_zone || 'Africa/Cairo'}
                  onChange={(e) => updateField('time_zone', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-400 focus:ring-1 focus:ring-brand-400/20 focus:outline-none"
                >
                  {TIMEZONE_GROUPS.map((group) => (
                    <optgroup key={group.label} label={group.label}>
                      {group.zones.map((z) => (
                        <option key={z} value={z}>{z}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              {/* Fiscal Year Start Month */}
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Fiscal Year Start Month</label>
                <select
                  value={f.fiscal_year_start ? f.fiscal_year_start.slice(0, 7) + '-01' : ''}
                  onChange={(e) => {
                    const d = e.target.value;
                    updateField('fiscal_year_start', d);
                  }}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-400 focus:ring-1 focus:ring-brand-400/20 focus:outline-none"
                >
                  {MONTHS.map((m) => (
                    <option key={m.value} value={`${new Date().getFullYear()}-${String(m.value).padStart(2, '0')}-01`}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Number Format */}
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Number Format</label>
                <select
                  value={f.number_format || '1,234.56'}
                  onChange={(e) => updateField('number_format', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-400 focus:ring-1 focus:ring-brand-400/20 focus:outline-none"
                >
                  {NUMBER_FORMATS.map((nf) => (
                    <option key={nf} value={nf}>{nf}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Company name display */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Company Name</label>
              <input
                type="text"
                value={f.name || ''}
                onChange={(e) => updateField('name', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-400 focus:ring-1 focus:ring-brand-400/20 focus:outline-none"
              />
            </div>
          </div>
        )}

        {/* ===== Tab 4: Branches ===== */}
        {activeTab === 'branches' && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">Branches</h3>
              <button
                onClick={() => {
                  setShowBranchForm(!showBranchForm);
                  setEditingBranchId(null);
                  setBranchForm({ code: '', name: '', address: '', city: '', phone: '', isHeadOffice: false });
                }}
                className="flex items-center gap-1.5 rounded-lg border border-brand-200 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50"
              >
                <Plus size={14} />
                Add Branch
              </button>
            </div>

            {/* Inline form */}
            {(showBranchForm || editingBranchId) && (
              <div className="mb-4 rounded-lg border border-gray-200 bg-brand-50/30 p-4">
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500">Branch Code</label>
                    <input
                      type="text"
                      value={branchForm.code}
                      onChange={(e) => setBranchForm((b) => ({ ...b, code: e.target.value }))}
                      className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500">Branch Name</label>
                    <input
                      type="text"
                      value={branchForm.name}
                      onChange={(e) => setBranchForm((b) => ({ ...b, name: e.target.value }))}
                      className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500">City</label>
                    <input
                      type="text"
                      value={branchForm.city}
                      onChange={(e) => setBranchForm((b) => ({ ...b, city: e.target.value }))}
                      className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500">Address</label>
                    <input
                      type="text"
                      value={branchForm.address}
                      onChange={(e) => setBranchForm((b) => ({ ...b, address: e.target.value }))}
                      className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500">Phone</label>
                    <input
                      type="text"
                      value={branchForm.phone}
                      onChange={(e) => setBranchForm((b) => ({ ...b, phone: e.target.value }))}
                      className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs"
                    />
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={branchForm.isHeadOffice}
                        onChange={(e) => setBranchForm((b) => ({ ...b, isHeadOffice: e.target.checked }))}
                        className="h-4 w-4 rounded border-gray-300 text-brand-600"
                      />
                      Head Office
                    </label>
                  </div>
                </div>
                <div className="flex gap-2">
                  {editingBranchId ? (
                    <button
                      onClick={handleUpdateBranch}
                      className="flex items-center gap-1 rounded bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
                    >
                      <Save size={11} />
                      Update
                    </button>
                  ) : (
                    <button
                      onClick={handleAddBranch}
                      className="flex items-center gap-1 rounded bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
                    >
                      <Save size={11} />
                      Save
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setShowBranchForm(false);
                      setEditingBranchId(null);
                      setBranchForm({ code: '', name: '', address: '', city: '', phone: '', isHeadOffice: false });
                    }}
                    className="rounded px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Branches Table */}
            {branchesLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="animate-spin text-brand-500" size={24} />
              </div>
            ) : branches.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <Building2 size={36} className="mb-2 text-gray-300" />
                <p className="text-sm">No branches</p>
              </div>
            ) : (
              <table className="w-full text-left text-sm rounded-lg border border-gray-200 overflow-hidden">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-4 py-2 text-xs font-medium text-gray-500 uppercase">Code</th>
                    <th className="px-4 py-2 text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-4 py-2 text-xs font-medium text-gray-500 uppercase">City</th>
                    <th className="px-4 py-2 text-xs font-medium text-gray-500 uppercase">Head Office</th>
                    <th className="px-4 py-2 text-xs font-medium text-gray-500 uppercase">Active</th>
                    <th className="px-4 py-2 text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {branches.map((branch) => (
                    <tr key={branch.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-mono text-gray-800">{branch.code}</td>
                      <td className="px-4 py-2 text-gray-700">{branch.name}</td>
                      <td className="px-4 py-2 text-gray-500">
                        {(branch.address || '').split(',').slice(-1)[0]?.trim() || '—'}
                      </td>
                      <td className="px-4 py-2">
                        {branch.is_head_office ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                            <Star size={10} />
                            Head Office
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <button
                          onClick={() => handleToggleBranch(branch)}
                          className={`rounded p-1 ${
                            branch.is_active
                              ? 'text-green-600 hover:bg-green-50'
                              : 'text-gray-400 hover:bg-gray-100'
                          }`}
                          title={branch.is_active ? 'Deactivate' : 'Activate'}
                        >
                          <Power size={14} />
                        </button>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-0.5">
                          <button
                            onClick={() => {
                              setShowBranchForm(false);
                              handleEditBranch(branch);
                            }}
                            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-brand-600"
                            title="Edit"
                          >
                            <Edit size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Tab Switch Confirmation Dialog */}
      <ConfirmDialog
        open={!!confirmSwitch}
        title="Unsaved Changes"
        message="You have unsaved changes. Switch tabs without saving?"
        confirmLabel="Discard & Switch"
        onConfirm={confirmTabSwitch}
        onCancel={() => setConfirmSwitch(null)}
      />
    </div>
  );
}