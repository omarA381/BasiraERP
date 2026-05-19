import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import NewCompanyDialog from '../components/dialogs/NewCompanyDialog';
import { User, Lock, Eye, EyeOff, Building2, ChevronDown, Loader2 } from 'lucide-react';

const loginSchema = z.object({
  companyId: z.string().min(1, 'Please select a company'),
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
});

const features = [
  'Foundation & Platform Core',
  'Multi-Company Architecture',
  'Role-Based Access Control',
  'Smart Approval Workflows',
  'Full Audit Trail',
  'Multi-Language & Calendar Support',
];

export default function Login() {
  const [companies, setCompanies] = useState([]);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const navigate = useNavigate();
  const { setUser, setCompany } = useAuthStore();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { companyId: '', username: '', password: '', rememberMe: false },
  });

  useEffect(() => {
    window.electronAPI
      .getCompanies()
      .then((res) => {
        if (res.success) setCompanies(res.data);
      })
      .catch(() => {});
  }, []);

  const refreshCompanies = useCallback(() => {
    window.electronAPI
      .getCompanies()
      .then((res) => {
        if (res.success) setCompanies(res.data);
      })
      .catch(() => {});
  }, []);

  const onSubmit = async (data) => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await window.electronAPI.login({
        username: data.username,
        password: data.password,
        companyId: data.companyId,
      });
      if (res.success) {
        const selectedCompany = companies.find((c) => c.id == data.companyId);
        setUser(res.data);
        if (selectedCompany) setCompany(selectedCompany);
        navigate('/dashboard');
      } else {
        setErrorMsg(res.message || 'Authentication failed');
      }
    } catch {
      setErrorMsg('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {/* ===== LEFT PANEL ===== */}
      <div className="relative hidden w-[40%] flex-col justify-between bg-[#14181c] p-12 lg:flex">
        {/* Animated geometric grid overlay */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <svg
            className="h-full w-full"
            xmlns="http://www.w3.org/2000/svg"
            style={{ animation: 'gridPulse 6s ease-in-out infinite' }}
          >
            <defs>
              <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
                <path
                  d="M 50 0 L 0 0 0 50"
                  fill="none"
                  stroke="rgba(255,255,255,0.05)"
                  strokeWidth="0.5"
                />
              </pattern>
              <pattern id="dots" width="50" height="50" patternUnits="userSpaceOnUse">
                <circle cx="50" cy="50" r="1.5" fill="rgba(20,184,166,0.35)" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
            <rect
              width="100%"
              height="100%"
              fill="url(#dots)"
              style={{ animation: 'dotPulse 4s ease-in-out infinite' }}
            />
          </svg>
        </div>

        {/* CSS keyframes */}
        <style>{`
          @keyframes gridPulse {
            0%, 100% { opacity: 0.7; }
            50% { opacity: 1; }
          }
          @keyframes dotPulse {
            0%, 100% { opacity: 0.5; }
            50% { opacity: 0.9; }
          }
        `}</style>

        {/* Top content */}
        <div className="relative z-10">
          {/* NX Monogram Logo */}
          <div className="mb-8">
            <svg width="56" height="56" viewBox="0 0 56 56" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="nxGrad" x1="0" y1="0" x2="56" y2="56">
                  <stop offset="0%" stopColor="#14b8a6" />
                  <stop offset="100%" stopColor="#0d9488" />
                </linearGradient>
              </defs>
              <rect width="56" height="56" rx="12" fill="url(#nxGrad)" />
              <text
                x="28"
                y="28"
                textAnchor="middle"
                dominantBaseline="central"
                fill="white"
                fontFamily="'Inter', system-ui, sans-serif"
                fontWeight="800"
                fontSize="22"
                letterSpacing="-0.5"
              >
                NX
              </text>
            </svg>
          </div>

          {/* System name */}
          <h1
            className="mb-2 text-4xl font-extrabold tracking-tight text-white"
            style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
          >
            NEXTERP
          </h1>

          {/* Tagline */}
          <p className="mb-10 text-base font-medium tracking-wide text-teal-400">
            Integrated Enterprise Resource Platform
          </p>

          {/* Feature highlights */}
          <ul className="space-y-4">
            {features.map((feature) => (
              <li
                key={feature}
                className="flex items-center gap-3 text-sm text-gray-300"
              >
                <span className="text-teal-400 text-base leading-none" aria-hidden="true">
                  ✦
                </span>
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Bottom content */}
        <div className="relative z-10">
          <p className="mb-2 text-xs font-medium tracking-wider text-gray-500 uppercase">
            Version 1.0.0 &middot; Build 2025
          </p>
          <p className="text-xs text-gray-600">
            &copy; 2025 NEXTERP. All rights reserved.
          </p>
        </div>
      </div>

      {/* ===== RIGHT PANEL ===== */}
      <div className="flex w-full flex-col items-center justify-center bg-white px-6 lg:w-[60%] lg:px-16">
        <div className="w-full max-w-[400px]">
          {/* Heading */}
          <div className="mb-8 text-center lg:text-left">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900">
              Welcome Back
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              Sign in to your account to continue
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
            {/* Company Selector */}
            <div>
              <label
                htmlFor="companyId"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Company
              </label>
              <div className="relative">
                <Building2
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  size={18}
                />
                <select
                  id="companyId"
                  {...register('companyId')}
                  className="block w-full appearance-none rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-10 text-sm text-gray-900 transition-colors focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:outline-none"
                >
                  <option value="" disabled>
                    Select company
                  </option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  size={16}
                />
              </div>
              {errors.companyId && (
                <p className="mt-1 text-xs text-red-500">{errors.companyId.message}</p>
              )}
            </div>

            {/* Username */}
            <div>
              <label
                htmlFor="username"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Username
              </label>
              <div className="relative">
                <User
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  size={18}
                />
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  placeholder="Enter your username"
                  {...register('username')}
                  className="block w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-3 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:outline-none"
                />
              </div>
              {errors.username && (
                <p className="mt-1 text-xs text-red-500">{errors.username.message}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Password
              </label>
              <div className="relative">
                <Lock
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  size={18}
                />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  {...register('password')}
                  className="block w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-10 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>
              )}
            </div>

            {/* Remember Me */}
            <div className="flex items-center gap-2">
              <input
                id="rememberMe"
                type="checkbox"
                {...register('rememberMe')}
                className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
              />
              <label htmlFor="rememberMe" className="text-sm text-gray-600">
                Remember me
              </label>
            </div>

            {/* Sign In Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="flex w-full items-center justify-center rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-700 focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 animate-spin" size={18} />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>

            {/* Error Message */}
            {errorMsg && (
              <p className="text-center text-sm text-red-500" role="alert">
                {errorMsg}
              </p>
            )}

            {/* Register New Company */}
            <div className="text-center">
              <button
                type="button"
                onClick={() => setDialogOpen(true)}
                className="text-sm text-teal-600 underline-offset-2 hover:text-teal-700 hover:underline"
              >
                Register New Company
              </button>
            </div>

            {/* Database Settings Link */}
            <div className="text-center">
              <button
                type="button"
                onClick={() => navigate('/setup')}
                className="text-xs text-gray-400 underline-offset-2 hover:text-teal-600 hover:underline"
              >
                Database Settings
              </button>
            </div>
          </form>
        </div>
      </div>

      <NewCompanyDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSuccess={() => {
          setDialogOpen(false);
          refreshCompanies();
        }}
      />
    </div>
  );
}