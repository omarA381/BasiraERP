import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import {
  LayoutDashboard,
  Building2,
  Users,
  Shield,
  Key,
  GitBranch,
  ClipboardList,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  User,
  ChevronDown,
  Menu,
} from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  {
    label: 'Foundation',
    icon: Building2,
    children: [
      { label: 'Companies', path: '/foundation/companies', icon: Building2 },
      { label: 'Branches', path: '/foundation/branches', icon: GitBranch },
      { label: 'Users', path: '/foundation/users', icon: Users },
      { label: 'Roles', path: '/foundation/roles', icon: Shield },
      { label: 'Permissions', path: '/foundation/permissions', icon: Key },
      { label: 'Audit Log', path: '/foundation/audit-log', icon: ClipboardList },
      { label: 'Workflows', path: '/foundation/workflows', icon: GitBranch },
      { label: 'Settings', path: '/foundation/settings', icon: Settings },
    ],
  },
];

export default function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [expandedModules, setExpandedModules] = useState({ Foundation: true });
  const { user, company, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const toggleModule = (label) => {
    setExpandedModules((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path) => {
    if (path === '/dashboard') return location.pathname === '/dashboard';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gray-50">
      {/* === TOP NAVIGATION === */}
      <header className="flex h-14 shrink-0 items-center justify-between bg-brand-700 px-4 text-white">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen((prev) => !prev)}
            className="rounded p-1 hover:bg-brand-600"
            aria-label="Toggle sidebar"
          >
            <Menu size={20} />
          </button>
          <span className="text-lg font-bold tracking-tight">NEXTERP</span>
          {company && (
            <>
              <span className="text-brand-300">|</span>
              <span className="text-sm font-medium text-brand-100">{company.name}</span>
            </>
          )}
        </div>

        {/* User Dropdown */}
        <div className="relative">
          <button
            onClick={() => setUserMenuOpen((prev) => !prev)}
            className="flex items-center gap-2 rounded px-3 py-1.5 text-sm hover:bg-brand-600"
          >
            <User size={16} />
            <span>{user?.full_name || user?.username || 'User'}</span>
            <ChevronDown size={14} />
          </button>
          {userMenuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
              <div className="absolute right-0 z-20 mt-1 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                <div className="border-b border-gray-100 px-4 py-2">
                  <p className="text-sm font-medium text-gray-900">
                    {user?.full_name || user?.username}
                  </p>
                  <p className="text-xs text-gray-500">{user?.role_name || ''}</p>
                </div>
                <button
                  onClick={() => {
                    setUserMenuOpen(false);
                    navigate('/change-password');
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Key size={14} />
                  Change Password
                </button>
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <LogOut size={14} />
                  Sign Out
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      {/* === BODY (Sidebar + Content) === */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside
          className={`flex shrink-0 flex-col border-r border-gray-200 bg-white transition-all duration-200 ${
            sidebarOpen ? 'w-56' : 'w-14'
          }`}
        >
          <nav className="flex-1 overflow-y-auto py-2">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              if (item.children) {
                const expanded = expandedModules[item.label] ?? true;
                return (
                  <div key={item.label}>
                    <button
                      onClick={() => toggleModule(item.label)}
                      className={`flex w-full items-center gap-3 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 ${
                        sidebarOpen ? 'justify-start' : 'justify-center'
                      }`}
                    >
                      <Icon size={18} className="shrink-0" />
                      {sidebarOpen && (
                        <>
                          <span className="flex-1 text-left">{item.label}</span>
                          <ChevronRight
                            size={14}
                            className={`transition-transform ${expanded ? 'rotate-90' : ''}`}
                          />
                        </>
                      )}
                    </button>
                    {expanded && sidebarOpen && (
                      <div className="ml-4 border-l border-gray-200">
                        {item.children.map((child) => {
                          const ChildIcon = child.icon;
                          const active = isActive(child.path);
                          return (
                            <button
                              key={child.path}
                              onClick={() => navigate(child.path)}
                              className={`flex w-full items-center gap-2 px-3 py-1.5 text-sm ${
                                active
                                  ? 'bg-brand-50 font-medium text-brand-700'
                                  : 'text-gray-500 hover:bg-gray-50'
                              }`}
                            >
                              <ChildIcon size={16} className="shrink-0" />
                              <span>{child.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }
              // Top-level item without children
              const active = isActive(item.path);
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`flex w-full items-center gap-3 px-3 py-2 text-sm font-medium ${
                    sidebarOpen ? 'justify-start' : 'justify-center'
                  } ${
                    active
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Icon size={18} className="shrink-0" />
                  {sidebarOpen && <span>{item.label}</span>}
                </button>
              );
            })}
          </nav>

          {/* Collapse toggle */}
          <button
            onClick={() => setSidebarOpen((prev) => !prev)}
            className="flex items-center justify-center border-t border-gray-200 py-2 text-gray-400 hover:text-gray-600"
          >
            {sidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
          </button>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}