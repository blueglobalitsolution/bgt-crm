import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Lock, User as UserIcon, LogIn, Loader2, Sparkles } from 'lucide-react';

export const LoginView: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Please enter your username and password.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await login(username.trim(), password);
    } catch (err: any) {
      setError(err?.message || 'Login failed. Check your credentials.');
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-sm py-4">
        <div className="flex flex-col items-center mb-6">
          <img
            src="/logo.png"
            alt="BGT CRM logo"
            className="w-16 h-16 object-contain mb-3"
          />
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">BGT CRM</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Digital Marketing Agency — Sign in to continue
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xl p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Username
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  autoFocus
                  className="w-full text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-9 pr-3 py-2.5 focus:ring-2 focus:ring-blue-500 dark:text-slate-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-9 pr-3 py-2.5 focus:ring-2 focus:ring-blue-500 dark:text-slate-100"
                />
              </div>
            </div>

            {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}

            <button
              type="submit"
              disabled={busy}
              className="w-full py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center gap-2 shadow-md shadow-blue-600/25 transition-all disabled:opacity-60"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
              {busy ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <div className="mt-4 flex items-start gap-2 text-[11px] text-slate-400 bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 rounded-xl p-3">
            <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
            <span>
              Default admin: <strong className="text-slate-600 dark:text-slate-300">admin</strong> /{' '}
              <strong className="text-slate-600 dark:text-slate-300">admin123</strong> — change it in Settings.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
