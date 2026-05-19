import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import PropTypes from 'prop-types';
import toast from 'react-hot-toast';
import useAuthStore from '../../store/authStore';
import NewUserDialog from '../../components/dialogs/NewUserDialog';
import {
  Users,
  Shield,
  Search,
  Filter,
  Edit,
  Power,
  Key,
  Plus,
  Save,
  X,
  AlertTriangle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Check,
  UserPlus,
} from 'lucide-react';

const PAGE_SIZE = 20;
const ACTIONS = ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'APPROVE'];

const roleFormSchema = z.object({
  roleName: z.string().min(2, 'Role name is required'),
  description: z.string().optional(),
  cloneFromRoleId: z.string().optional(),
});

// ============================================================
// Helpers
// ============================================================

function initials(name) {
  if (!name) return '?';
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function formatTime(ts) {
  if (!ts) return 'Never';
  return new Date(ts).toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });
}

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
  let pw = '';
  for (let i = 0; i < 12; i++) {
    pw += chars[Math.floor(Math.random() * chars.length)];
  }
  return pw;
}

// ============================================================
// Sub-components
// ============================================================

function ResetPasswordModal({ open, onClose, onSubmit }) {
  const { register, handleSubmit, watch, formState: { errors } } = useForm({
    defaultValues: { password: '', confirmPassword: '', autoGenerate: true },
  });

  if (!open) return null;

  const autoGen = watch('autoGenerate');

  const handleFormSubmit = (data) => {
    onSubmit(data);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
        <div
          className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
              <Key size={18} className="text-brand-600" />
              Reset Password
            </h3>
            <button onClick={onClose} className="rounded p-1 text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          </div>
          <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                {...register('autoGenerate')}
                className="h-4 w-4 rounded border-gray-300 text-brand-600"
              />
              Auto-generate password
            </label>
            {!autoGen && (
              <>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">New Password</label>
                  <input
                    type="text"
                    {...register('password')}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                  {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>}
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Confirm Password</label>
                  <input
                    type="text"
                    {...register('confirmPassword')}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                  {errors.confirmPassword && <p className="mt-1 text-xs text-red-500">{errors.confirmPassword.message}</p>}
                </div>
              </>
            )}
            {autoGen && (
              <div className="rounded-md bg-gray-50 p-3">
                <p className="text-sm text-gray-600">A strong random password will be generated</p>
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
              >
                Reset
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

ResetPasswordModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
};

function AvatarCell({ name }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
        {initials(name)}
      </div>
      <span className="font-medium text-gray-900">{name}</span>
    </div>
  );
}

AvatarCell.propTypes = {
  name: PropTypes.string.isRequired,
};

// ============================================================
// Main Component
// ============================================================

export default function UsersRoles() {
  const { company } = useAuthStore();

  // --- Users state ---
  const [users, setUsers] = useState([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersPage, setUsersPage] = useState(1);
  const [usersLoading, setUsersLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [userDialogOpen, setUserDialogOpen] = useState(false);

  // --- Roles state ---
  const [roles, setRoles] = useState([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState(null);
  const [rolePermissions, setRolePermissions] = useState({});
  const [allPermissions, setAllPermissions] = useState([]);
  const [editingPermissions, setEditingPermissions] = useState(false);
  const [permissionEdits, setPermissionEdits] = useState({});
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [showSodWarning, setShowSodWarning] = useState(false);
  const [sodConflicts, setSodConflicts] = useState([]);

  // --- Password reset ---
  const [resetUserId, setResetUserId] = useState(null);

  // --- New Role ---
  const [showNewRoleForm, setShowNewRoleForm] = useState(false);
  const newRoleForm = useForm({
    resolver: zodResolver(roleFormSchema),
    defaultValues: { roleName: '', description: '', cloneFromRoleId: '' },
  });

  // --- Edit user inline ---
  const [editingUserId, setEditingUserId] = useState(null);
  const editForm = useForm({
    defaultValues: { fullName: '', email: '', phone: '', roleId: '', branchId: '' },
  });

  const searchTimer = useRef(null);

  // ============================================================
  // Load users
  // ============================================================
  const loadUsers = () => {
    if (!company) return;
    setUsersLoading(true);
    window.electronAPI
      .listUsers({
        companyId: company.id,
        search,
        status: statusFilter === 'all' ? undefined : statusFilter === 'must_change' ? 'must_change' : statusFilter,
        page: usersPage,
        limit: PAGE_SIZE,
      })
      .then((res) => {
        if (res.success) {
          setUsers(res.data.users);
          setUsersTotal(res.data.total);
        }
      })
      .catch(() => {})
      .finally(() => setUsersLoading(false));
  };

  useEffect(() => {
    loadUsers();
  }, [company, usersPage, statusFilter]);

  // Debounced search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setUsersPage(1);
      loadUsers();
    }, 400);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [search]);

  // ============================================================
  // Load roles + all permissions
  // ============================================================
  const loadRoles = () => {
    if (!company) return;
    setRolesLoading(true);
    window.electronAPI
      .getRolesWithUserCount({ companyId: company.id })
      .then((res) => {
        if (res.success) setRoles(res.data);
      })
      .catch(() => {})
      .finally(() => setRolesLoading(false));
  };

  const loadAllPermissions = () => {
    window.electronAPI
      .listAllPermissions()
      .then((res) => {
        if (res.success) setAllPermissions(res.data);
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadRoles();
    loadAllPermissions();
  }, [company]);

  // Load permissions for selected role
  useEffect(() => {
    if (!selectedRoleId) {
      setRolePermissions({});
      setEditingPermissions(false);
      return;
    }
    window.electronAPI
      .getRolePermissions({ roleId: selectedRoleId })
      .then((res) => {
        if (res.success) setRolePermissions(res.data);
      })
      .catch(() => {});
    setEditingPermissions(false);
  }, [selectedRoleId]);

  // ============================================================
  // User actions
  // ============================================================
  const handleToggleActive = (userId) => {
    window.electronAPI
      .toggleUserActive({ userId, companyId: company.id })
      .then((res) => {
        if (res.success) {
          toast.success(res.data.is_active ? 'User activated' : 'User deactivated');
          loadUsers();
        } else {
          toast.error(res.error || 'Failed');
        }
      })
      .catch(() => toast.error('Connection error'));
  };

  const handleResetPassword = async (data) => {
    const password = data.autoGenerate ? generatePassword() : data.password;
    try {
      const res = await window.electronAPI.resetUserPassword({
        userId: resetUserId,
        companyId: company.id,
        newPassword: password,
      });
      if (res.success) {
        toast.success(`Password reset. New: ${password}`);
        setResetUserId(null);
      } else {
        toast.error(res.error || 'Failed to reset password');
      }
    } catch {
      toast.error('Connection error');
    }
  };

  const handleStartEdit = (user) => {
    setEditingUserId(user.id);
    editForm.reset({
      fullName: user.full_name || '',
      email: user.email || '',
      phone: user.phone || '',
      roleId: user.role_id || '',
      branchId: user.branch_id || '',
    });
  };

  const handleSaveEdit = () => {
    const rawData = editForm.getValues();
    const data = {
      full_name: rawData.fullName,
      email: rawData.email,
      phone: rawData.phone,
      role_id: rawData.roleId || undefined,
      branch_id: rawData.branchId || undefined,
    };
    window.electronAPI
      .updateUser({
        userId: editingUserId,
        companyId: company.id,
        data,
      })
      .then((res) => {
        if (res.success) {
          toast.success('User updated');
          setEditingUserId(null);
          loadUsers();
        } else {
          toast.error(res.error || 'Failed');
        }
      })
      .catch(() => toast.error('Connection error'));
  };

  // ============================================================
  // Role actions
  // ============================================================
  const handleStartEditPermissions = () => {
    // Build set of existing permissions
    const current = {};
    for (const [module, perms] of Object.entries(rolePermissions)) {
      for (const p of perms) {
        current[`${module}:${p.action_code}`] = true;
      }
    }
    setPermissionEdits(current);
    setEditingPermissions(true);
  };

  const handleTogglePermission = (moduleCode, actionCode) => {
    const key = `${moduleCode}:${actionCode}`;
    setPermissionEdits((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSavePermissions = async () => {
    setSavingPermissions(true);
    const permissionsList = Object.entries(permissionEdits)
      .filter(([, checked]) => checked)
      .map(([key]) => {
        const [module_code, action_code] = key.split(':');
        return { module_code, action_code };
      });

    try {
      const res = await window.electronAPI.updateRolePermissions({
        roleId: selectedRoleId,
        companyId: company.id,
        permissions: permissionsList,
      });
      if (res.success) {
        if (res.data.sodConflicts) {
          setSodConflicts(res.data.sodConflicts);
          setShowSodWarning(true);
        } else {
          toast.success('Permissions updated');
        }
        setEditingPermissions(false);
        // Reload permissions
        window.electronAPI
          .getRolePermissions({ roleId: selectedRoleId })
          .then((r) => {
            if (r.success) setRolePermissions(r.data);
          })
          .catch(() => {});
      } else {
        toast.error(res.error || 'Failed');
      }
    } catch {
      toast.error('Connection error');
    } finally {
      setSavingPermissions(false);
    }
  };

  const handleCreateRole = async (data) => {
    try {
      const res = await window.electronAPI.createRole({
        companyId: company.id,
        roleName: data.roleName,
        description: data.description,
        cloneFromRoleId: data.cloneFromRoleId || null,
      });
      if (res.success) {
        toast.success(`Role "${res.data.role_name}" created`);
        setShowNewRoleForm(false);
        newRoleForm.reset();
        loadRoles();
        setSelectedRoleId(res.data.id);
      } else {
        toast.error(res.error || 'Failed to create role');
      }
    } catch {
      toast.error('Connection error');
    }
  };

  // ============================================================
  // Permissions grid data
  // ============================================================
  const modules = Array.from(new Set(allPermissions.map((p) => p.module_code))).sort();

  const isPermChecked = (module, action) => {
    if (editingPermissions) {
      return permissionEdits[`${module}:${action}`] || false;
    }
    return (rolePermissions[module] || []).some((p) => p.action_code === action);
  };

  // ============================================================
  // Render
  // ============================================================
  const totalPages = Math.ceil(usersTotal / PAGE_SIZE);

  return (
    <div className="flex h-full">
      {/* ===== USERS PANEL (left 60%) ===== */}
      <div className="flex w-[60%] shrink-0 flex-col border-r border-gray-200">
        {/* Toolbar */}
        <div className="flex items-center justify-between border-b border-gray-100 bg-white px-5 py-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <Users size={16} className="text-brand-500" />
            Users
            {usersTotal > 0 && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-normal text-gray-500">
                {usersTotal}
              </span>
            )}
          </h2>
          <button
            onClick={() => setUserDialogOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
          >
            <UserPlus size={14} />
            Add New User
          </button>
        </div>

        {/* Search + Filter */}
        <div className="flex items-center gap-3 border-b border-gray-100 bg-white px-5 py-2">
          <div className="relative flex-1">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, username, or email..."
              className="w-full rounded-lg border border-gray-200 py-1.5 pl-8 pr-3 text-sm focus:border-brand-400 focus:ring-1 focus:ring-brand-400/20 focus:outline-none"
            />
          </div>
          <div className="relative">
            <Filter size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setUsersPage(1); }}
              className="rounded-lg border border-gray-200 py-1.5 pl-7 pr-6 text-sm focus:border-brand-400 focus:outline-none"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="must_change">Must Change Password</option>
            </select>
          </div>
        </div>

        {/* Users table */}
        <div className="flex-1 overflow-y-auto">
          {usersLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="animate-spin text-brand-500" size={28} />
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Users size={40} className="mb-3" />
              <p className="text-sm">No users found</p>
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50">
                  <th className="px-5 py-2 text-xs font-medium text-gray-500 uppercase">User</th>
                  <th className="px-5 py-2 text-xs font-medium text-gray-500 uppercase">Username</th>
                  <th className="px-5 py-2 text-xs font-medium text-gray-500 uppercase">Role</th>
                  <th className="px-5 py-2 text-xs font-medium text-gray-500 uppercase">Branch</th>
                  <th className="px-5 py-2 text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-5 py-2 text-xs font-medium text-gray-500 uppercase">Last Login</th>
                  <th className="px-5 py-2 text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-5 py-2.5">
                      {editingUserId === user.id ? (
                        <input
                          {...editForm.register('fullName')}
                          className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                        />
                      ) : (
                        <AvatarCell name={user.full_name} />
                      )}
                    </td>
                    <td className="px-5 py-2.5">
                      <span className="font-mono text-gray-600">{user.username}</span>
                    </td>
                    <td className="px-5 py-2.5">
                      {editingUserId === user.id ? (
                        <input
                          {...editForm.register('roleId')}
                          className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                        />
                      ) : (
                        <span className="text-gray-600">{user.role_name}</span>
                      )}
                    </td>
                    <td className="px-5 py-2.5 text-gray-500">{user.branch_name || '—'}</td>
                    <td className="px-5 py-2.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          user.is_active
                            ? 'bg-green-50 text-green-700'
                            : 'bg-red-50 text-red-600'
                        }`}
                      >
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                      {user.must_change_password && (
                        <span className="ml-1 rounded-full bg-yellow-50 px-2 py-0.5 text-xs font-medium text-yellow-700">
                          Pwd
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-2.5 text-xs text-gray-400">
                      {formatTime(user.last_login)}
                    </td>
                    <td className="px-5 py-2.5">
                      {editingUserId === user.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={handleSaveEdit}
                            className="rounded p-1 text-green-600 hover:bg-green-50"
                            title="Save"
                          >
                            <Check size={15} />
                          </button>
                          <button
                            onClick={() => setEditingUserId(null)}
                            className="rounded p-1 text-gray-400 hover:bg-gray-100"
                            title="Cancel"
                          >
                            <X size={15} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-0.5">
                          <button
                            onClick={() => handleStartEdit(user)}
                            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-brand-600"
                            title="Edit"
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            onClick={() => handleToggleActive(user.id)}
                            className={`rounded p-1 hover:bg-gray-100 ${
                              user.is_active ? 'text-amber-500 hover:text-amber-600' : 'text-green-500 hover:text-green-600'
                            }`}
                            title={user.is_active ? 'Deactivate' : 'Activate'}
                          >
                            <Power size={14} />
                          </button>
                          <button
                            onClick={() => setResetUserId(user.id)}
                            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-blue-600"
                            title="Reset Password"
                          >
                            <Key size={14} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 bg-white px-5 py-2">
            <p className="text-xs text-gray-500">
              Page {usersPage} of {totalPages}
            </p>
            <div className="flex items-center gap-1">
              <button
                disabled={usersPage <= 1}
                onClick={() => setUsersPage((p) => Math.max(1, p - 1))}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-30"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                disabled={usersPage >= totalPages}
                onClick={() => setUsersPage((p) => p + 1)}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-30"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ===== ROLES PANEL (right 40%) ===== */}
      <div className="flex w-[40%] shrink-0 flex-col bg-white">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <Shield size={16} className="text-brand-500" />
            Roles & Permissions
          </h2>
          <button
            onClick={() => setShowNewRoleForm(!showNewRoleForm)}
            className="flex items-center gap-1 rounded-lg border border-brand-200 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50"
          >
            <Plus size={14} />
            New Role
          </button>
        </div>

        {/* New Role inline form */}
        {showNewRoleForm && (
          <div className="border-b border-gray-100 bg-brand-50/50 px-5 py-3">
            <form onSubmit={newRoleForm.handleSubmit(handleCreateRole)} className="space-y-3">
              <input
                {...newRoleForm.register('roleName')}
                placeholder="Role name"
                className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-400 focus:outline-none"
              />
              {newRoleForm.formState.errors.roleName && (
                <p className="text-xs text-red-500">{newRoleForm.formState.errors.roleName.message}</p>
              )}
              <input
                {...newRoleForm.register('description')}
                placeholder="Description (optional)"
                className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-400 focus:outline-none"
              />
              <select
                {...newRoleForm.register('cloneFromRoleId')}
                className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-400 focus:outline-none"
              >
                <option value="">Clone permissions from...</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>{r.role_name}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setShowNewRoleForm(false); newRoleForm.reset(); }}
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={newRoleForm.formState.isSubmitting}
                  className="flex-1 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Roles list */}
        <div className="flex-1 overflow-y-auto">
          {rolesLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="animate-spin text-gray-300" size={24} />
            </div>
          ) : roles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-gray-400">
              <Shield size={32} className="mb-2" />
              <p className="text-sm">No roles defined</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {roles.map((role) => (
                <div key={role.id}>
                  <button
                    onClick={() => setSelectedRoleId(selectedRoleId === role.id ? null : role.id)}
                    className={`flex w-full items-center justify-between px-5 py-2.5 text-left transition-colors hover:bg-gray-50 ${
                      selectedRoleId === role.id ? 'bg-brand-50' : ''
                    }`}
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-800">{role.role_name}</p>
                      {role.description && (
                        <p className="text-xs text-gray-400 truncate max-w-[220px]">{role.description}</p>
                      )}
                    </div>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                      {role.user_count} users
                    </span>
                  </button>

                  {/* Expanded: permissions grid */}
                  {selectedRoleId === role.id && (
                    <div className="border-t border-gray-100 bg-gray-50/50 px-5 py-3">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Permissions</p>
                        {!editingPermissions ? (
                          <button
                            onClick={handleStartEditPermissions}
                            className="flex items-center gap-1 rounded text-xs font-medium text-brand-600 hover:text-brand-700"
                          >
                            <Edit size={12} />
                            Edit Permissions
                          </button>
                        ) : (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setEditingPermissions(false)}
                              className="rounded text-xs text-gray-400 hover:text-gray-600"
                            >
                              <X size={14} />
                            </button>
                            <button
                              onClick={handleSavePermissions}
                              disabled={savingPermissions}
                              className="flex items-center gap-1 rounded bg-brand-600 px-2 py-0.5 text-xs text-white hover:bg-brand-700 disabled:opacity-50"
                            >
                              <Save size={11} />
                              {savingPermissions ? 'Saving...' : 'Save'}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Permission matrix */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="py-1 pr-2 text-left font-medium text-gray-500">Module</th>
                              {ACTIONS.map((action) => (
                                <th key={action} className="px-1 py-1 text-center font-medium text-gray-400">
                                  {action.slice(0, 4)}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {modules.length === 0 ? (
                              <tr>
                                <td colSpan={6} className="py-4 text-center text-gray-400">
                                  No permissions loaded
                                </td>
                              </tr>
                            ) : (
                              modules.map((mod) => (
                                <tr key={mod} className="border-b border-gray-100">
                                  <td className="py-1.5 pr-2 font-medium text-gray-700">{mod}</td>
                                  {ACTIONS.map((action) => {
                                    const checked = isPermChecked(mod, action);
                                    return (
                                      <td key={action} className="px-1 py-1.5 text-center">
                                        {editingPermissions ? (
                                          <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() => handleTogglePermission(mod, action)}
                                            className="h-3.5 w-3.5 rounded border-gray-300 text-brand-600 cursor-pointer"
                                          />
                                        ) : (
                                          <span
                                            className={`inline-block h-3 w-3 rounded-full ${
                                              checked ? 'bg-green-500' : 'bg-gray-200'
                                            }`}
                                          />
                                        )}
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ===== Modals ===== */}
      {userDialogOpen && company && (
        <NewUserDialog
          companyId={company.id}
          onClose={() => setUserDialogOpen(false)}
          onSuccess={() => {
            setUserDialogOpen(false);
            loadUsers();
          }}
        />
      )}

      <ResetPasswordModal
        open={!!resetUserId}
        onClose={() => setResetUserId(null)}
        onSubmit={handleResetPassword}
      />

      {/* SOD Warning Modal */}
      {showSodWarning && (
        <>
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
            onClick={() => setShowSodWarning(false)}
          >
            <div
              className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-full bg-amber-100 p-2 text-amber-600">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Segregation of Duties Conflict</h3>
                  <p className="text-sm text-gray-500">
                    The following conflicting permission combinations were detected:
                  </p>
                </div>
              </div>
              <ul className="mb-4 space-y-2">
                {sodConflicts.map((c, i) => (
                  <li key={i} className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    {c.message}
                  </li>
                ))}
              </ul>
              <p className="mb-4 text-sm text-gray-500">
                Permissions were saved, but please review these conflicts to ensure proper segregation of duties.
              </p>
              <button
                onClick={() => setShowSodWarning(false)}
                className="w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
              >
                I Understand
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}