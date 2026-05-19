import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import PropTypes from 'prop-types';
import toast from 'react-hot-toast';
import { Building2, User, MapPin, ChevronRight, ChevronLeft, Check, Upload } from 'lucide-react';

// ============================================================
// Zod Schemas per step
// ============================================================

const step1Schema = z.object({
  code: z
    .string()
    .min(1, 'Company code is required')
    .max(10, 'Maximum 10 characters')
    .regex(/^[A-Z0-9]+$/, 'Uppercase letters and numbers only'),
  legalName: z.string().min(1, 'Legal name is required'),
  tradeName: z.string().optional(),
  taxNumber: z.string().optional(),
  country: z.string().min(1, 'Country is required'),
  baseCurrency: z.string().min(1, 'Base currency is required'),
  primaryLanguage: z.string().min(1, 'Primary language is required'),
  calendarType: z.enum(['gregorian', 'hijri']),
});

const step2Schema = z.object({
  streetAddress: z.string().optional(),
  city: z.string().optional(),
  stateRegion: z.string().optional(),
  postalCode: z.string().optional(),
  phone: z.string().optional(),
  fax: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  website: z.string().optional(),
  logoPath: z.string().optional(),
});

const step3Schema = z
  .object({
    fullName: z.string().min(1, 'Full name is required'),
    username: z
      .string()
      .min(3, 'Username must be at least 3 characters')
      .regex(/^[a-zA-Z0-9_]+$/, 'Letters, numbers and underscores only'),
    adminEmail: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string(),
    sendWelcomeEmail: z.boolean().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

const STEP_SCHEMAS = [step1Schema, step2Schema, step3Schema];

// ============================================================
// Constants
// ============================================================

const COUNTRIES = [
  'Saudi Arabia',
  'United Arab Emirates',
  'Egypt',
  'United States',
  'United Kingdom',
  'France',
  'Germany',
  'India',
  'Other',
];

const CURRENCIES = [
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'SAR', label: 'SAR — Saudi Riyal' },
  { value: 'EGP', label: 'EGP — Egyptian Pound' },
  { value: 'AED', label: 'AED — UAE Dirham' },
  { value: 'GBP', label: 'GBP — British Pound' },
  { value: 'INR', label: 'INR — Indian Rupee' },
  { value: 'PKR', label: 'PKR — Pakistani Rupee' },
  { value: 'KWD', label: 'KWD — Kuwaiti Dinar' },
  { value: 'QAR', label: 'QAR — Qatari Riyal' },
  { value: 'BHD', label: 'BHD — Bahraini Dinar' },
  { value: 'OMR', label: 'OMR — Omani Rial' },
];

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'ar', label: 'Arabic' },
  { value: 'fr', label: 'French' },
];

const STEPS = ['Basic Info', 'Contact & Address', 'Admin User'];

function passwordStrength(pw) {
  if (!pw) return { level: '', score: 0 };
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;
  if (score <= 1) return { level: 'Weak', score };
  if (score === 2) return { level: 'Medium', score };
  return { level: 'Strong', score };
}

// ============================================================
// Component
// ============================================================

export default function NewCompanyDialog({ open, onClose, onSuccess }) {
  const [step, setStep] = useState(0);
  const [logoName, setLogoName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    trigger,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    defaultValues: {
      code: '',
      legalName: '',
      tradeName: '',
      taxNumber: '',
      country: '',
      baseCurrency: '',
      primaryLanguage: '',
      calendarType: 'gregorian',
      streetAddress: '',
      city: '',
      stateRegion: '',
      postalCode: '',
      phone: '',
      fax: '',
      email: '',
      website: '',
      logoPath: '',
      fullName: '',
      username: '',
      adminEmail: '',
      password: '',
      confirmPassword: '',
      sendWelcomeEmail: false,
    },
  });

  const passwordValue = watch('password');
  const pwStrength = passwordStrength(passwordValue);

  const handleNext = async () => {
    const valid = await trigger(undefined, { resolver: zodResolver(STEP_SCHEMAS[step]) });
    if (valid) setStep((s) => Math.min(s + 1, 2));
  };

  const handleBack = () => {
    setStep((s) => Math.max(s - 1, 0));
  };

  const handleLogoSelect = async () => {
    try {
      const result = await window.electronAPI.selectLogo();
      if (result.success && result.data?.path) {
        setValue('logoPath', result.data.path);
        setLogoName(result.data.name || 'logo.png');
      }
    } catch {
      // silently fail
    }
  };

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    try {
      const payload = {
        company: {
          code: data.code,
          name: data.legalName,
          legalName: data.tradeName || data.legalName,
          taxNumber: data.taxNumber || undefined,
          country: data.country,
          streetAddress: data.streetAddress || undefined,
          city: data.city || undefined,
          stateRegion: data.stateRegion || undefined,
          postalCode: data.postalCode || undefined,
          phone: data.phone || undefined,
          fax: data.fax || undefined,
          email: data.email || undefined,
          website: data.website || undefined,
          logoPath: data.logoPath || undefined,
          baseCurrency: data.baseCurrency,
          calendarType: data.calendarType,
          primaryLanguage: data.primaryLanguage,
        },
        adminUser: {
          fullName: data.fullName,
          username: data.username,
          email: data.adminEmail,
          password: data.password,
        },
      };
      const res = await window.electronAPI.createCompany(payload);
      if (res.success) {
        toast.success(res.data?.message || 'Company created successfully');
        onSuccess();
      } else {
        toast.error(res.error || 'Failed to create company');
      }
    } catch {
      toast.error('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      >
        {/* Modal */}
        <div
          className="relative mx-4 w-full max-w-2xl animate-slide-up rounded-xl bg-white shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-teal-600" />
              <h2 className="text-lg font-semibold text-gray-900">Register New Company</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Stepper */}
          <div className="flex items-center justify-center gap-0 px-6 pt-6">
            {STEPS.map((label, idx) => (
              <div key={label} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                      idx < step
                        ? 'bg-teal-600 text-white'
                        : idx === step
                          ? 'bg-teal-600 text-white'
                          : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {idx < step ? <Check size={16} /> : idx + 1}
                  </div>
                  <span
                    className={`mt-1 text-xs whitespace-nowrap ${
                      idx === step ? 'font-medium text-teal-700' : 'text-gray-400'
                    }`}
                  >
                    {label}
                  </span>
                </div>
                {idx < STEPS.length - 1 && (
                  <div
                    className={`mx-2 h-0.5 w-16 rounded ${
                      idx < step ? 'bg-teal-600' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Form body */}
          <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-6" noValidate>
            {/* ============================================================ */}
            {/* STEP 1 — Basic Info                                               */}
            {/* ============================================================ */}
            {step === 0 && (
              <div className="space-y-4 animate-fade-in">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="code" className="mb-1 block text-sm font-medium text-gray-700">
                      Company Code *
                    </label>
                    <input
                      id="code"
                      {...register('code', {
                        onChange: (e) => {
                          e.target.value = e.target.value.toUpperCase();
                          register('code').onChange(e);
                        },
                      })}
                      maxLength={10}
                      placeholder="e.g. NEXTRP"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono uppercase tracking-wide placeholder:normal-case placeholder:tracking-normal focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:outline-none"
                    />
                    {errors.code && (
                      <p className="mt-1 text-xs text-red-500">{errors.code.message}</p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="baseCurrency" className="mb-1 block text-sm font-medium text-gray-700">
                      Base Currency *
                    </label>
                    <select
                      id="baseCurrency"
                      {...register('baseCurrency')}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:outline-none"
                    >
                      <option value="">Select currency</option>
                      {CURRENCIES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                    {errors.baseCurrency && (
                      <p className="mt-1 text-xs text-red-500">{errors.baseCurrency.message}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label htmlFor="legalName" className="mb-1 block text-sm font-medium text-gray-700">
                    Company Legal Name *
                  </label>
                  <input
                    id="legalName"
                    {...register('legalName')}
                    placeholder="Full legal entity name"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:outline-none"
                  />
                  {errors.legalName && (
                    <p className="mt-1 text-xs text-red-500">{errors.legalName.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="tradeName" className="mb-1 block text-sm font-medium text-gray-700">
                      Trade Name
                    </label>
                    <input
                      id="tradeName"
                      {...register('tradeName')}
                      placeholder="Short / trade name"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="taxNumber" className="mb-1 block text-sm font-medium text-gray-700">
                      Tax Registration #
                    </label>
                    <input
                      id="taxNumber"
                      {...register('taxNumber')}
                      placeholder="VAT / Tax ID"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="country" className="mb-1 block text-sm font-medium text-gray-700">
                      Country *
                    </label>
                    <select
                      id="country"
                      {...register('country')}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:outline-none"
                    >
                      <option value="">Select country</option>
                      {COUNTRIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    {errors.country && (
                      <p className="mt-1 text-xs text-red-500">{errors.country.message}</p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="primaryLanguage" className="mb-1 block text-sm font-medium text-gray-700">
                      Primary Language *
                    </label>
                    <select
                      id="primaryLanguage"
                      {...register('primaryLanguage')}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:outline-none"
                    >
                      <option value="">Select language</option>
                      {LANGUAGES.map((l) => (
                        <option key={l.value} value={l.value}>
                          {l.label}
                        </option>
                      ))}
                    </select>
                    {errors.primaryLanguage && (
                      <p className="mt-1 text-xs text-red-500">{errors.primaryLanguage.message}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Calendar Type *
                  </label>
                  <div className="flex gap-6">
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="radio"
                        value="gregorian"
                        {...register('calendarType')}
                        className="text-teal-600 focus:ring-teal-500"
                      />
                      Gregorian
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="radio"
                        value="hijri"
                        {...register('calendarType')}
                        className="text-teal-600 focus:ring-teal-500"
                      />
                      Hijri
                    </label>
                  </div>
                  {errors.calendarType && (
                    <p className="mt-1 text-xs text-red-500">{errors.calendarType.message}</p>
                  )}
                </div>
              </div>
            )}

            {/* ============================================================ */}
            {/* STEP 2 — Contact & Address                                     */}
            {/* ============================================================ */}
            {step === 1 && (
              <div className="space-y-4 animate-fade-in">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <MapPin size={16} className="text-teal-600" />
                  Address
                </div>
                <div>
                  <label htmlFor="streetAddress" className="mb-1 block text-sm font-medium text-gray-700">
                    Street Address
                  </label>
                  <input
                    id="streetAddress"
                    {...register('streetAddress')}
                    placeholder="Building, street"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="city" className="mb-1 block text-sm font-medium text-gray-700">
                      City
                    </label>
                    <input
                      id="city"
                      {...register('city')}
                      placeholder="City"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="stateRegion" className="mb-1 block text-sm font-medium text-gray-700">
                      State / Region
                    </label>
                    <input
                      id="stateRegion"
                      {...register('stateRegion')}
                      placeholder="State"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:outline-none"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="postalCode" className="mb-1 block text-sm font-medium text-gray-700">
                      Postal Code
                    </label>
                    <input
                      id="postalCode"
                      {...register('postalCode')}
                      placeholder="ZIP / postal"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="phone" className="mb-1 block text-sm font-medium text-gray-700">
                      Phone
                    </label>
                    <input
                      id="phone"
                      {...register('phone')}
                      placeholder="+1 234 567 8900"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:outline-none"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="fax" className="mb-1 block text-sm font-medium text-gray-700">
                      Fax
                    </label>
                    <input
                      id="fax"
                      {...register('fax')}
                      placeholder="Fax number"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">
                      Email
                    </label>
                    <input
                      id="email"
                      type="email"
                      {...register('email')}
                      placeholder="company@domain.com"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:outline-none"
                    />
                    {errors.email && (
                      <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>
                    )}
                  </div>
                </div>
                <div>
                  <label htmlFor="website" className="mb-1 block text-sm font-medium text-gray-700">
                    Website
                  </label>
                  <input
                    id="website"
                    {...register('website')}
                    placeholder="https://www.company.com"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Company Logo
                  </label>
                  <button
                    type="button"
                    onClick={handleLogoSelect}
                    className="flex items-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-3 text-sm text-gray-500 hover:border-teal-400 hover:text-teal-600 transition-colors"
                  >
                    <Upload size={16} />
                    {logoName || 'Click to select logo file'}
                  </button>
                </div>
              </div>
            )}

            {/* ============================================================ */}
            {/* STEP 3 — Admin User                                            */}
            {/* ============================================================ */}
            {step === 2 && (
              <div className="space-y-4 animate-fade-in">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <User size={16} className="text-teal-600" />
                  Initial Administrator
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="fullName" className="mb-1 block text-sm font-medium text-gray-700">
                      Full Name *
                    </label>
                    <input
                      id="fullName"
                      {...register('fullName')}
                      placeholder="Admin full name"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:outline-none"
                    />
                    {errors.fullName && (
                      <p className="mt-1 text-xs text-red-500">{errors.fullName.message}</p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="username" className="mb-1 block text-sm font-medium text-gray-700">
                      Username *
                    </label>
                    <input
                      id="username"
                      {...register('username')}
                      placeholder="admin_user"
                      autoComplete="off"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:outline-none"
                    />
                    {errors.username && (
                      <p className="mt-1 text-xs text-red-500">{errors.username.message}</p>
                    )}
                  </div>
                </div>
                <div>
                  <label htmlFor="adminEmail" className="mb-1 block text-sm font-medium text-gray-700">
                    Email *
                  </label>
                  <input
                    id="adminEmail"
                    type="email"
                    {...register('adminEmail')}
                    placeholder="admin@company.com"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:outline-none"
                  />
                  {errors.adminEmail && (
                    <p className="mt-1 text-xs text-red-500">{errors.adminEmail.message}</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-700">
                      Password *
                    </label>
                    <input
                      id="password"
                      type="password"
                      {...register('password')}
                      placeholder="Min 6 characters"
                      autoComplete="new-password"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:outline-none"
                    />
                    {errors.password && (
                      <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>
                    )}
                    {passwordValue && (
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="h-1.5 flex-1 rounded-full bg-gray-200">
                          <div
                            className={`h-full rounded-full transition-all ${
                              pwStrength.score <= 1
                                ? 'w-1/3 bg-red-500'
                                : pwStrength.score === 2
                                  ? 'w-2/3 bg-yellow-500'
                                  : 'w-full bg-green-500'
                            }`}
                          />
                        </div>
                        <span
                          className={`text-xs font-medium ${
                            pwStrength.level === 'Weak'
                              ? 'text-red-500'
                              : pwStrength.level === 'Medium'
                                ? 'text-yellow-600'
                                : 'text-green-600'
                          }`}
                        >
                          {pwStrength.level}
                        </span>
                      </div>
                    )}
                  </div>
                  <div>
                    <label htmlFor="confirmPassword" className="mb-1 block text-sm font-medium text-gray-700">
                      Confirm Password *
                    </label>
                    <input
                      id="confirmPassword"
                      type="password"
                      {...register('confirmPassword')}
                      placeholder="Re-enter password"
                      autoComplete="new-password"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:outline-none"
                    />
                    {errors.confirmPassword && (
                      <p className="mt-1 text-xs text-red-500">{errors.confirmPassword.message}</p>
                    )}
                  </div>
                </div>
                <div className="rounded-lg bg-gray-50 px-4 py-3">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Building2 size={14} />
                    Role:{' '}
                    <span className="font-medium text-gray-900">System Administrator (Full Access)</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="sendWelcomeEmail"
                    type="checkbox"
                    {...register('sendWelcomeEmail')}
                    className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                  />
                  <label htmlFor="sendWelcomeEmail" className="text-sm text-gray-600">
                    Send welcome email with credentials
                  </label>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="mt-6 flex items-center justify-between border-t border-gray-200 pt-5">
              <div>
                {step > 0 && (
                  <button
                    type="button"
                    onClick={handleBack}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <ChevronLeft size={16} />
                    Back
                  </button>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Cancel
                </button>
                {step < 2 ? (
                  <button
                    type="button"
                    onClick={handleNext}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 transition-colors"
                  >
                    Next
                    <ChevronRight size={16} />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-6 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
                  >
                    {isSubmitting ? 'Creating...' : 'Create Company'}
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* CSS animations */}
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(30px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .animate-slide-up { animation: slideUp 0.3s ease-out; }
        .animate-fade-in  { animation: fadeIn 0.25s ease-in; }
      `}</style>
    </>
  );
}

NewCompanyDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSuccess: PropTypes.func.isRequired,
};