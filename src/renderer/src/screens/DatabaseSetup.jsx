import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Database,
  Server,
  Lock,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  Wifi,
} from 'lucide-react';

const dbSchema = z.object({
  host: z.string().min(1, 'Host is required'),
  port: z.coerce.number().int().min(1, 'Min 1').max(65535, 'Max 65535'),
  database: z
    .string()
    .min(1, 'Database name is required')
    .regex(/^[a-zA-Z0-9_]+$/, 'Alphanumeric + underscores only'),
  user: z.string().min(1, 'Username is required'),
  password: z.string().min(4, 'Password must be at least 4 characters'),
  ssl: z.boolean(),
});

const STATUS = {
  IDLE: 'idle',
  TESTING: 'testing',
  SUCCESS: 'success',
  FAILED: 'failed',
};

export default function DatabaseSetup() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [testStatus, setTestStatus] = useState(STATUS.IDLE);
  const [testMessage, setTestMessage] = useState('');
  const [pgVersion, setPgVersion] = useState('');
  const [envPath, setEnvPath] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    watch,
  } = useForm({
    resolver: zodResolver(dbSchema),
    defaultValues: {
      host: 'localhost',
      port: 5432,
      database: '',
      user: '',
      password: '',
      ssl: false,
    },
  });

  const sslValue = watch('ssl');

  const handleTestConnection = async () => {
    setTestStatus(STATUS.TESTING);
    setTestMessage('Testing connection...');
    setPgVersion('');

    const hostEl = document.getElementById('db-host');
    const portEl = document.getElementById('db-port');
    const dbEl = document.getElementById('db-database');
    const userEl = document.getElementById('db-user');
    const passEl = document.getElementById('db-password');

    const config = {
      host: hostEl?.value || 'localhost',
      port: portEl?.value || 5432,
      database: dbEl?.value || '',
      user: userEl?.value || '',
      password: passEl?.value || '',
      ssl: sslValue,
    };

    try {
      const result = await window.electronAPI.testConnection(config);
      if (result.success) {
        setTestStatus(STATUS.SUCCESS);
        setTestMessage('Connected');
        setPgVersion(result.data?.version || '');
      } else {
        setTestStatus(STATUS.FAILED);
        setTestMessage(result.error || 'Connection failed');
      }
    } catch (err) {
      setTestStatus(STATUS.FAILED);
      setTestMessage(err.message || 'Unexpected error');
    }
  };

  const onSubmit = async (data) => {
    try {
      const result = await window.electronAPI.saveDbConfig(data);
      if (result.success) {
        setEnvPath(result.data?.envPath || '');
        toast.success('Configuration saved successfully');
        setTimeout(() => navigate('/login'), 1000);
      } else {
        toast.error(result.error || 'Failed to save configuration');
      }
    } catch (err) {
      toast.error(err.message || 'Unexpected error');
    }
  };

  const handleLoadSaved = async () => {
    try {
      const result = await window.electronAPI.loadDbConfig();
      if (result.success && result.data) {
        reset({
          host: result.data.host || 'localhost',
          port: result.data.port || 5432,
          database: result.data.database || '',
          user: result.data.user || '',
          password: result.data.password || '',
          ssl: result.data.ssl || false,
        });
        setTestStatus(STATUS.IDLE);
        setTestMessage('');
        setPgVersion('');
        toast.success('Configuration loaded');
      } else {
        toast('No saved configuration found', { icon: 'ℹ️' });
      }
    } catch (err) {
      toast.error(err.message || 'Failed to load configuration');
    }
  };

  const statusDotClass = {
    [STATUS.IDLE]: 'bg-slate-600',
    [STATUS.TESTING]: 'bg-yellow-500 animate-pulse',
    [STATUS.SUCCESS]: 'bg-emerald-500 animate-pulse',
    [STATUS.FAILED]: 'bg-red-500 animate-pulse',
  };

  const StatusBadge = () => {
    if (testStatus === STATUS.IDLE) return null;
    return (
      <div className="flex items-center gap-2 mt-3 px-4 py-2 rounded border border-slate-700 bg-slate-800/60">
        <span className={`h-2.5 w-2.5 rounded-full ${statusDotClass[testStatus]}`} />
        <span className="text-sm text-slate-300 font-mono">{testMessage}</span>
        {testStatus === STATUS.SUCCESS && pgVersion && (
          <>
            <CheckCircle className="h-4 w-4 text-emerald-500" />
            <span className="text-xs text-slate-500 font-mono truncate max-w-xs">{pgVersion}</span>
          </>
        )}
        {testStatus === STATUS.FAILED && <XCircle className="h-4 w-4 text-red-500" />}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#0f172a] flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 px-8 py-5">
        <div className="flex items-center gap-3">
          <Database className="h-7 w-7 text-[#0d9488]" />
          <div>
            <h1 className="text-xl font-bold text-white tracking-wider font-mono">NEXTERP</h1>
            <p className="text-xs text-slate-500 tracking-wide">Enterprise Resource Platform</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-lg">
          <div className="border border-slate-800 bg-[#0f172a] rounded-sm">
            {/* Form Header */}
            <div className="border-b border-slate-800 px-6 py-4">
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4 text-[#0d9488]" />
                <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-widest">
                  Database Connection
                </h2>
              </div>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-5 space-y-4">
              {/* Host */}
              <div>
                <label htmlFor="db-host" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Host
                </label>
                <input
                  id="db-host"
                  {...register('host')}
                  className="w-full bg-slate-900 border border-slate-700 rounded-sm px-3 py-2.5 text-sm text-slate-200 font-mono placeholder:text-slate-600 focus:outline-none focus:border-[#0d9488] transition-colors"
                  placeholder="localhost"
                />
                {errors.host && (
                  <p className="mt-1 text-xs text-red-400">{errors.host.message}</p>
                )}
              </div>

              {/* Port */}
              <div>
                <label htmlFor="db-port" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Port
                </label>
                <input
                  id="db-port"
                  type="number"
                  {...register('port')}
                  className="w-full bg-slate-900 border border-slate-700 rounded-sm px-3 py-2.5 text-sm text-slate-200 font-mono placeholder:text-slate-600 focus:outline-none focus:border-[#0d9488] transition-colors"
                  placeholder="5432"
                />
                {errors.port && (
                  <p className="mt-1 text-xs text-red-400">{errors.port.message}</p>
                )}
              </div>

              {/* Database Name */}
              <div>
                <label htmlFor="db-database" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Database Name
                </label>
                <input
                  id="db-database"
                  {...register('database')}
                  className="w-full bg-slate-900 border border-slate-700 rounded-sm px-3 py-2.5 text-sm text-slate-200 font-mono placeholder:text-slate-600 focus:outline-none focus:border-[#0d9488] transition-colors"
                  placeholder="nexterp_db"
                />
                {errors.database && (
                  <p className="mt-1 text-xs text-red-400">{errors.database.message}</p>
                )}
              </div>

              {/* Username */}
              <div>
                <label htmlFor="db-user" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Username
                </label>
                <input
                  id="db-user"
                  {...register('user')}
                  className="w-full bg-slate-900 border border-slate-700 rounded-sm px-3 py-2.5 text-sm text-slate-200 font-mono placeholder:text-slate-600 focus:outline-none focus:border-[#0d9488] transition-colors"
                  placeholder="postgres"
                />
                {errors.user && (
                  <p className="mt-1 text-xs text-red-400">{errors.user.message}</p>
                )}
              </div>

              {/* Password */}
              <div>
                <label htmlFor="db-password" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-600" />
                  <input
                    id="db-password"
                    type={showPassword ? 'text' : 'password'}
                    {...register('password')}
                    className="w-full bg-slate-900 border border-slate-700 rounded-sm pl-9 pr-10 py-2.5 text-sm text-slate-200 font-mono placeholder:text-slate-600 focus:outline-none focus:border-[#0d9488] transition-colors"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-[#0d9488] transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>
                )}
              </div>

              {/* SSL Toggle */}
              <div className="flex items-center gap-3 pt-1">
                <input
                  id="db-ssl"
                  type="checkbox"
                  {...register('ssl')}
                  className="h-4 w-4 rounded-sm border-slate-700 bg-slate-900 text-[#0d9488] focus:ring-[#0d9488] focus:ring-offset-0 cursor-pointer"
                />
                <label htmlFor="db-ssl" className="text-sm text-slate-400 cursor-pointer select-none">
                  Enable SSL Connection
                </label>
              </div>

              {/* Status Badge */}
              <StatusBadge />

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testStatus === STATUS.TESTING}
                  className="flex-1 flex items-center justify-center gap-2 border border-slate-700 text-slate-300 hover:text-[#0d9488] hover:border-[#0d9488] rounded-sm px-4 py-2.5 text-sm font-semibold uppercase tracking-wider transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Wifi className="h-4 w-4" />
                  Test Connection
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 flex items-center justify-center gap-2 bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-sm px-4 py-2.5 text-sm font-semibold uppercase tracking-wider transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Database className="h-4 w-4" />
                  Save & Continue
                </button>
              </div>

              {/* Load Saved */}
              <div className="text-center">
                <button
                  type="button"
                  onClick={handleLoadSaved}
                  className="text-xs text-slate-500 hover:text-[#0d9488] uppercase tracking-wider transition-colors"
                >
                  Load Saved Configuration
                </button>
              </div>
            </form>
          </div>

          {/* Footer */}
          <p className="mt-4 text-center text-xs text-slate-600 font-mono">
            {envPath ? (
              <>Configuration saved to: {envPath}</>
            ) : (
              <>Configure your PostgreSQL connection to continue</>
            )}
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 px-8 py-3">
        <p className="text-center text-xs text-slate-600 font-mono">
          NEXTERP &copy; {new Date().getFullYear()} — Enterprise Resource Platform
        </p>
      </footer>
    </div>
  );
}