import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { User } from '../types';
import { auditApi } from '../utils/auditApi';
import { PERMISSION_GROUPS } from '../permissions';
import {
  Users as UsersIcon,
  ShieldCheck,
  Plus,
  X,
  Trash2,
  Save,
  Loader2,
  Power,
  UserRound,
} from 'lucide-react';

type Tab = 'users' | 'roles';

export const UsersView: React.FC = () => {
  const { users, roles, refreshUsers, refreshRoles } = useAuth();
  const [tab, setTab] = useState<Tab>('users');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    refreshUsers();
    refreshRoles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-indigo-600" />
          <span>Users & Roles</span>
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Register team members, assign designations, and control access with permission checklists.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 w-fit max-w-full overflow-x-auto">
        <button
          onClick={() => setTab('users')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
            tab === 'users' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <UsersIcon className="w-3.5 h-3.5" />
          Users ({users.length})
        </button>
        <button
          onClick={() => setTab('roles')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
            tab === 'roles' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          Roles & Permissions ({roles.length})
        </button>
      </div>

      {tab === 'users' ? (
        <UsersTab
          users={users}
          roles={roles}
          onChanged={refreshUsers}
          setBusy={setBusy}
          busy={busy}
        />
      ) : (
        <RolesTab roles={roles} onChanged={refreshRoles} setBusy={setBusy} busy={busy} />
      )}
    </div>
  );
};

// ─── Users tab ─────────────────────────────────────────────────────────────

const UsersTab: React.FC<{
  users: User[];
  roles: { designation: string }[];
  onChanged: () => void;
  setBusy: (b: boolean) => void;
  busy: boolean;
}> = ({ users, roles, onChanged, setBusy, busy }) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [designation, setDesignation] = useState(roles[0]?.designation || 'Admin');
  const [active, setActive] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const openAdd = () => {
    setEditing(null);
    setName('');
    setUsername('');
    setPassword('');
    setDesignation(roles[0]?.designation || 'Admin');
    setActive(true);
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (u: User) => {
    setEditing(u);
    setName(u.name);
    setUsername(u.username);
    setPassword('');
    setDesignation(u.designation);
    setActive(u.active === 1);
    setError(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !username.trim() || (!editing && !password)) {
      setError('Name, username and password are required.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (editing) {
        await auditApi.updateUser(editing.id, {
          name: name.trim(),
          username: username.trim(),
          password: password || undefined,
          designation,
          active,
        });
      } else {
        await auditApi.createUser({ name: name.trim(), username: username.trim(), password, designation, active });
      }
      await onChanged();
      setModalOpen(false);
    } catch (err: any) {
      setError(err?.message || 'Failed to save user');
    } finally {
      setBusy(false);
    }
  };

  const handleToggleActive = async (u: User) => {
    setBusy(true);
    try {
      await auditApi.updateUser(u.id, { active: u.active === 1 ? false : true });
      await onChanged();
    } catch (err: any) {
      alert(err?.message || 'Failed to update user');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (u: User) => {
    if (!confirm(`Delete user "${u.name}"?`)) return;
    setBusy(true);
    try {
      await auditApi.deleteUser(u.id);
      await onChanged();
    } catch (err: any) {
      alert(err?.message || 'Failed to delete user');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">Registered team members with CRM access.</p>
        <button
          onClick={openAdd}
          className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 shadow-sm transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          Register User
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200/80 dark:border-slate-800">
              <tr>
                <th className="p-3 pl-4">Name</th>
                <th className="p-3">Username</th>
                <th className="p-3">Designation</th>
                <th className="p-3">Status</th>
                <th className="p-3 pr-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400">
                    No users registered yet.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="p-3 pl-4 font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 flex items-center justify-center">
                        <UserRound className="w-3.5 h-3.5" />
                      </span>
                      {u.name}
                    </td>
                    <td className="p-3 font-mono text-slate-500">{u.username}</td>
                    <td className="p-3">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {u.designation}
                      </span>
                    </td>
                    <td className="p-3">
                      {u.active === 1 ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                          Active
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="p-3 pr-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(u)}
                          title="Edit user"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg>
                        </button>
                        <button
                          onClick={() => handleToggleActive(u)}
                          title={u.active === 1 ? 'Deactivate' : 'Activate'}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/50 transition-colors"
                        >
                          <Power className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(u)}
                          title="Delete user"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-base">
                  {editing ? 'Edit User' : 'Register User'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Grant CRM access to a team member</p>
              </div>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Full Name *</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="e.g. Priya Sharma" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Username *</label>
                <input value={username} onChange={(e) => setUsername(e.target.value)} className={inputCls} placeholder="e.g. karan" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Password {editing ? '(leave blank to keep)' : '*'}
                </label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} placeholder="••••••••" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Designation / Role</label>
                <select value={designation} onChange={(e) => setDesignation(e.target.value)} className={inputCls}>
                  {roles.map((r) => (
                    <option key={r.designation} value={r.designation}>
                      {r.designation}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="rounded border-slate-300 text-blue-600" />
                Active (can log in)
              </label>

              {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={busy} className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 shadow-sm disabled:opacity-60">
                  {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {editing ? 'Save Changes' : 'Register User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Roles & Permissions tab ───────────────────────────────────────────────

const RolesTab: React.FC<{ roles: { designation: string; permissions: string[] }[]; onChanged: () => void; setBusy: (b: boolean) => void; busy: boolean }> = ({
  roles,
  onChanged,
  setBusy,
  busy,
}) => {
  const [editing, setEditing] = useState<string | null>(roles[0]?.designation || null);
  const [permissions, setPermissions] = useState<string[]>(roles[0]?.permissions || []);
  const [newRole, setNewRole] = useState('');
  const [saved, setSaved] = useState(false);

  const selectRole = (r: { designation: string; permissions: string[] }) => {
    setEditing(r.designation);
    setPermissions(r.permissions);
    setSaved(false);
  };

  const togglePerm = (key: string) => {
    setSaved(false);
    setPermissions((prev) => (prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]));
  };

  const handleSave = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      await auditApi.saveRole(editing, permissions);
      setSaved(true);
      await onChanged();
    } catch (err: any) {
      alert(err?.message || 'Failed to save permissions');
    } finally {
      setBusy(false);
    }
  };

  const handleAddRole = async () => {
    const name = newRole.trim();
    if (!name) return;
    if (roles.some((r) => r.designation === name)) {
      alert('That designation already exists.');
      return;
    }
    setBusy(true);
    try {
      await auditApi.saveRole(name, []);
      setNewRole('');
      await onChanged();
    } catch (err: any) {
      alert(err?.message || 'Failed to add designation');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteRole = async (r: string) => {
    if (r === 'Admin') {
      alert('The Admin designation cannot be deleted.');
      return;
    }
    if (!confirm(`Delete designation "${r}"?`)) return;
    setBusy(true);
    try {
      await auditApi.deleteRole(r);
      if (editing === r) {
        setEditing(null);
        setPermissions([]);
      }
      await onChanged();
    } catch (err: any) {
      alert(err?.message || 'Failed to delete designation');
    } finally {
      setBusy(false);
    }
  };

  const current = roles.find((r) => r.designation === editing);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-4">
      {/* Designation list */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-3 space-y-1">
        <p className="px-2 pt-1 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Designations</p>
        {roles.map((r) => (
          <div
            key={r.designation}
            className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
              editing === r.designation
                ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-300'
            }`}
            onClick={() => selectRole(r)}
          >
            <span>{r.designation}</span>
            <span className="text-[10px] text-slate-400">({r.permissions.length})</span>
          </div>
        ))}

        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 mt-2">
          <div className="flex gap-1.5">
            <input
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              placeholder="New designation…"
              className="flex-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 dark:text-slate-100"
            />
            <button onClick={handleAddRole} disabled={busy} className="px-2.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold disabled:opacity-50">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Permission checklist */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-5">
        {!editing || !current ? (
          <p className="text-center text-slate-400 text-sm py-16">Select a designation to manage its permissions.</p>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  {editing}
                  {editing === 'Admin' && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                      Full Access
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-500">Tick the permissions this designation can perform.</p>
              </div>
              <div className="flex items-center gap-2">
                {editing !== 'Admin' && (
                  <button
                    onClick={() => handleDeleteRole(editing)}
                    className="px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-1.5 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                )}
                <button
                  onClick={handleSave}
                  disabled={busy}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 shadow-sm disabled:opacity-60"
                >
                  {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Save Permissions
                </button>
              </div>
            </div>

            {saved && (
              <div className="mb-4 px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
                Permissions saved.
              </div>
            )}

            {editing === 'Admin' ? (
              <p className="text-sm text-slate-500">Admin has access to every feature by default.</p>
            ) : (
              <div className="space-y-5">
                {PERMISSION_GROUPS.map((group) => (
                  <div key={group.group}>
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">{group.group}</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {group.items.map((item) => {
                        const checked = permissions.includes(item.key);
                        return (
                          <label
                            key={item.key}
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium cursor-pointer transition-colors ${
                              checked
                                ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900/60 text-blue-800 dark:text-blue-300'
                                : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200/60 dark:border-slate-800 text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => togglePerm(item.key)}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            {item.label}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const inputCls =
  'w-full text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 focus:ring-2 focus:ring-blue-500 dark:text-slate-100';
