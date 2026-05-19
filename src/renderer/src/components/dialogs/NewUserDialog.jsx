import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import PropTypes from 'prop-types';
import toast from 'react-hot-toast';
import { User, Mail, Phone, Shield, Key, RefreshCw, Check, X, Eye, EyeOff } from 'lucide-react';

// ============================================================
// Zod Schema
// ============================================================

const userSchema = z
  .object({
    branchId: z.string().optional(),
    fullName: z.string().min(1, 'Full name is required'),
    username: z
      .string()
      .min(4, 'Minimum 4 characters')
      .regex(/^[a-zA-Z0-9_]+$/, 'Letters, numbers, and underscores only'),
    email: z.string().min(1, 'Email is required').email('Invalid email address'),
    phone: z.string().optional(),
    roleId: z.string().min(1, 'Please select a role'),
    autoGenerate: z.boolean(),
    password: z.string(),
    confirmPassword: z.string(),
    mustChangePassword: z.boolean(),
    isActive: z.boolean(),
  })
  .refine(
    (data) => {
      if (data.autoGenerate) return true;
      return data.password.length >= 8;
    },
    { message: 'Password must be at least 8 characters', path: ['password'] }
  )
  .refine(
    (data) => {
      if (data.autoGenerate) return true;
      return data.password === data.confirmPassword;
    },
    { message: 'Passwords do not match', path: ['confirmPassword'] }
  );

// ============================================================
// Helpers
// ============================================================

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
  let pw = '';
  for (let i = 0; i < 12; i++) {
    pw += chars[Math.floor(Math.random() * chars.length)];
  }
  return pw;
}

// ============================================================
// Component
// ============================================================

export default function NewUserDialog({ companyId, onSuccess, onClose }) {
  const [branches, setBranches] = useState([]);
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState('idle'); // idle | checking | available | taken

  const usernameTimer = useRef(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(userSchema),
    defaultValues: {
      branchId: '',
      fullName: '',
      username: '',
      email: '',
      phone: '',
      roleId: '',
      autoGenerate: true,
      password: '',
      confirmPassword: '',
      mustChangePassword: true,
      isActive: true,
    },
  });

  const autoGenerate = watch('autoGenerate');
  const usernameValue = watch('username');
  const roleIdValue = watch('roleId');
  const passwordValue = watch('password');

  // Load branches
  useEffect(() => {
    window.electronAPI
      .listBranches({ companyId })
      .then((res) => {
        if (res.success) setBranches(res.data);
      })
      .catch(() => {});
  }, [companyId]);

  // Load roles
  useEffect(() => {
    window.electronAPI
      .listRoles({ companyId })
      .then((res) => {
        if (res.success) setRoles(res.data);
      })
      .catch(() => {});
  }, [companyId]);

  // Load permissions when role changes
  useEffect(() => {
    if (!roleIdValue) {
      setPermissions({});
      return;
    }
    window.electronAPI
      .getRolePermissions({ roleId: roleIdValue })
      .then((res) => {
        if (res.success) setPermissions(res.data);
      })
      .catch(() => setPermissions({}));
  }, [roleIdValue]);

  // Debounced username availability check
  useEffect(() => {
    if (!usernameValue || usernameValue.length < 4) {
      setUsernameStatus('idle');
      return;
    }
    setUsernameStatus('checking');
    if (usernameTimer.current) clearTimeout(usernameTimer.current);
    usernameTimer.current = setTimeout(() => {
      window.electronAPI
        .checkUsername({ username: usernameValue, companyId })
        .then((res) => {
          if (res.success) {
            setUsernameStatus(res.data?.available ? 'available' : 'taken');
          }
        })
        .catch(() => setUsernameStatus('idle'));
    }, 500);
    return () => {
      if (usernameTimer.current) clearTimeout(usernameTimer.current);
    };
  }, [usernameValue, companyId]);

  const handleGenerate = () => {
    const pw = generatePassword();
    setValue('password', pw);
    setValue('confirmPassword', pw);
    setShowPassword(true);
  };

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    try {
      const res = await window.electronAPI.createUser({
        companyId,
        branchId: data.branchId || null,
        fullName: data.fullName,
        username: data.username,
        email: data.email,
        phone: data.phone || null,
        roleId: data.roleId,
        password: data.password,
        mustChangePassword: data.mustChangePassword,
        isActive: data.isActive,
      });
      if (res.success) {
        toast.success(`User "${data.username}" created successfully`);
        onSuccess();
      } else {
        toast.error(res.error || 'Failed to create user');
      }
    } catch {
      toast.error('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const permissionModules = Object.keys(permissions).sort();

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      >
        {/* Modal */}
        <div
          className="relative mx-4 max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl bg-white shadow-2xl animate-slide-up"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4 rounded-t-xl">
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-teal-600" />
              <h2 className="text-lg font-semibold text-gray-900">Add New User</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <X size={18} />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-5 space-y-4" noValidate>
            {/* Company (read-only) */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Company
              </label>
              <input
                type="text"
                value={companyId}
                readOnly
                disabled
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500"
              />
            </div>

            {/* Branch */}
            <div>
              <label htmlFor="branchId" className="mb-1 block text-sm font-medium text-gray-700">
                Branch
              </label>
              <select
                id="branchId"
                {...register('branchId')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:outline-none"
              >
                <option value="">Head Office (default)</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} {b.is_head_office ? '(HQ)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Full Name */}
            <div>
              <label htmlFor="fullName" className="mb-1 block text-sm font-medium text-gray-700">
                Full Name *
              </label>
              <input
                id="fullName"
                {...register('fullName')}
                placeholder="John Doe"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:outline-none"
              />
              {errors.fullName && (
                <p className="mt-1 text-xs text-red-500">{errors.fullName.message}</p>
              )}
            </div>

            {/* Username */}
            <div>
              <label htmlFor="username" className="mb-1 block text-sm font-medium text-gray-700">
                Username *
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  id="username"
                  {...register('username')}
                  placeholder="john_doe"
                  autoComplete="off"
                  className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-10 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:outline-none"
                />
                {usernameStatus === 'checking' && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <RefreshCw size={14} className="animate-spin text-gray-400" />
                  </div>
                )}
                {usernameStatus === 'available' && (
                  <Check size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500" />
                )}
                {usernameStatus === 'taken' && (
                  <X size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500" />
                )}
              </div>
              {errors.username && (
                <p className="mt-1 text-xs text-red-500">{errors.username.message}</p>
              )}
              {usernameStatus === 'available' && (
                <p className="mt-1 text-xs text-green-600">Username is available</p>
              )}
              {usernameStatus === 'taken' && (
                <p className="mt-1 text-xs text-red-500">Username is already taken</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">
                Email *
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  id="email"
                  type="email"
                  {...register('email')}
                  placeholder="john@company.com"
                  className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:outline-none"
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>
              )}
            </div>

            {/* Phone */}
            <div>
              <label htmlFor="phone" className="mb-1 block text-sm font-medium text-gray-700">
                Phone
              </label>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  id="phone"
                  {...register('phone')}
                  placeholder="+1 234 567 8900"
                  className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:outline-none"
                />
              </div>
            </div>

            {/* Role */}
            <div>
              <label htmlFor="roleId" className="mb-1 block text-sm font-medium text-gray-700">
                Role *
              </label>
              <div className="relative">
                <Shield className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <select
                  id="roleId"
                  {...register('roleId')}
                  className="w-full appearance-none rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:outline-none"
                >
                  <option value="">Select a role</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.role_name}
                    </option>
                  ))}
                </select>
              </div>
              {errors.roleId && (
                <p className="mt-1 text-xs text-red-500">{errors.roleId.message}</p>
              )}
            </div>

            {/* Permissions Preview */}
            {permissionModules.length > 0 && (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Permissions Preview
                </p>
                <div className="space-y-2">
                  {permissionModules.map((mod) => (
                    <div key={mod}>
                      <p className="text-xs font-medium text-gray-700 uppercase">{mod}</p>
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {permissions[mod].map((perm) => (
                          <span
                            key={`${perm.module_code}-${perm.action_code}`}
                            className="inline-block rounded bg-teal-100 px-1.5 py-0.5 text-xs text-teal-700"
                          >
                            {perm.action_code}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Auto-generate Password Toggle */}
            <div className="rounded-lg border border-gray-200 p-4">
              <div className="flex items-center gap-3">
                <input
                  id="autoGenerate"
                  type="checkbox"
                  {...register('autoGenerate')}
                  className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                />
                <label htmlFor="autoGenerate" className="text-sm font-medium text-gray-700">
                  Auto-generate password
                </label>
              </div>

              {autoGenerate && (
                <div className="mt-3 space-y-2">
                  <button
                    type="button"
                    onClick={handleGenerate}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-teal-300 bg-teal-50 px-3 py-1.5 text-sm font-medium text-teal-700 hover:bg-teal-100 transition-colors"
                  >
                    <RefreshCw size={14} />
                    Generate Password
                  </button>
                  {passwordValue && (
                    <div className="relative">
                      <Key className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={passwordValue}
                        readOnly
                        className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-10 text-sm font-mono text-gray-700"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((p) => !p)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {!autoGenerate && (
                <div className="mt-3 space-y-3">
                  <div>
                    <label htmlFor="password" className="mb-1 block text-xs font-medium text-gray-600">
                      Password *
                    </label>
                    <div className="relative">
                      <Key className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        {...register('password')}
                        placeholder="Minimum 8 characters"
                        autoComplete="new-password"
                        className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-10 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((p) => !p)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {errors.password && (
                      <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="confirmPassword" className="mb-1 block text-xs font-medium text-gray-600">
                      Confirm Password *
                    </label>
                    <div className="relative">
                      <Key className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                      <input
                        id="confirmPassword"
                        type={showConfirmPassword ? 'text' : 'password'}
                        {...register('confirmPassword')}
                        placeholder="Re-enter password"
                        autoComplete="new-password"
                        className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-10 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((p) => !p)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        tabIndex={-1}
                      >
                        {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {errors.confirmPassword && (
                      <p className="mt-1 text-xs text-red-500">{errors.confirmPassword.message}</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Checkboxes */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  id="mustChangePassword"
                  type="checkbox"
                  {...register('mustChangePassword')}
                  className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                />
                <label htmlFor="mustChangePassword" className="text-sm text-gray-700">
                  Must change password on first login
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="isActive"
                  type="checkbox"
                  {...register('isActive')}
                  className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                />
                <label htmlFor="isActive" className="text-sm text-gray-700">
                  Account is active
                </label>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 border-t border-gray-200 pt-5">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
              >
                {isSubmitting ? 'Creating...' : 'Create User'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(30px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        .animate-slide-up { animation: slideUp 0.3s ease-out; }
      `}</style>
    </>
  );
}

NewUserDialog.propTypes = {
  companyId: PropTypes.string.isRequired,
  onSuccess: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};