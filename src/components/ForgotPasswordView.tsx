import React, { useEffect, useRef, useState } from 'react';
import { auditApi } from '../utils/auditApi';
import { Mail, ShieldCheck, Lock, RefreshCw, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';

type Step = 'email' | 'otp' | 'newPassword' | 'done';

export const ForgotPasswordView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => clearTimer, []);

  const startCountdown = (seconds: number) => {
    clearTimer();
    setSecondsLeft(seconds);
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearTimer();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  };

  const sendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please enter your registered email.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await auditApi.forgotPassword(email.trim());
      setOtp('');
      setStep('otp');
      startCountdown(res.expiresInSeconds || 60);
    } catch (err: any) {
      setError(err?.message || 'Failed to send OTP.');
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim()) {
      setError('Please enter the 6-digit OTP.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await auditApi.verifyResetOtp(email.trim(), otp.trim());
      setPassword('');
      setConfirm('');
      setStep('newPassword');
    } catch (err: any) {
      setError(err?.message || 'OTP verification failed.');
    } finally {
      setBusy(false);
    }
  };

  const submitNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await auditApi.resetPassword(email.trim(), otp.trim(), password);
      clearTimer();
      setStep('done');
    } catch (err: any) {
      setError(err?.message || 'Failed to reset password.');
    } finally {
      setBusy(false);
    }
  };

  const expired = step === 'otp' && secondsLeft === 0;

  const inputCls =
    'w-full text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 focus:ring-2 focus:ring-blue-500 dark:text-slate-100';

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-sm py-4">
        <div className="flex flex-col items-center mb-6">
          <img src="/logo.png" alt="BGT CRM logo" className="w-16 h-16 object-contain mb-3" />
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">BGT CRM</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Reset your password</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xl p-6">
          {step === 'done' ? (
            <div className="flex flex-col items-center text-center space-y-3">
              <CheckCircle2 className="w-10 h-10 text-emerald-500" />
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Password updated successfully</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">You can now sign in with your new password.</p>
              <button
                onClick={onBack}
                className="w-full py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center gap-2 shadow-md shadow-blue-600/25 transition-all"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Sign In
              </button>
            </div>
          ) : step === 'email' ? (
            <form onSubmit={sendOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Registered email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    autoFocus
                    className={inputCls + ' pl-9'}
                  />
                </div>
              </div>

              {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}

              <button
                type="submit"
                disabled={busy}
                className="w-full py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center gap-2 shadow-md shadow-blue-600/25 transition-all disabled:opacity-60"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                {busy ? 'Sending…' : 'Send OTP'}
              </button>

              <button
                type="button"
                onClick={onBack}
                className="w-full py-2 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
              </button>
            </form>
          ) : step === 'otp' ? (
            <form onSubmit={verifyOtp} className="space-y-4">
              <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/70 dark:border-emerald-800">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <p className="text-xs text-emerald-800 dark:text-emerald-200">
                  A 6-digit OTP was sent to <strong>{email}</strong> for password reset.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">6-digit OTP</label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="••••••"
                  inputMode="numeric"
                  autoFocus
                  className="w-full text-center text-2xl tracking-[0.5em] font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-3 px-3 focus:ring-2 focus:ring-blue-500 dark:text-slate-100"
                />
                <p className={`mt-2 text-xs font-medium ${expired ? 'text-rose-600' : 'text-slate-400'}`}>
                  {expired ? 'This OTP has expired. Request a new one below.' : secondsLeft > 0 ? `Valid for ${secondsLeft}s` : 'Verifying…'}
                </p>
              </div>

              {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}

              <button
                type="submit"
                disabled={busy || expired}
                className="w-full py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center gap-2 shadow-md shadow-blue-600/25 transition-all disabled:opacity-60"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                {busy ? 'Verifying…' : 'Verify OTP'}
              </button>

              <div className="flex items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={() => sendOtp({ preventDefault: () => {} } as any)}
                  disabled={busy}
                  className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50 flex items-center gap-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Resend OTP
                </button>
                <button
                  type="button"
                  onClick={() => {
                    clearTimer();
                    setStep('email');
                    setError(null);
                  }}
                  disabled={busy}
                  className="text-xs font-semibold text-slate-500 hover:underline disabled:opacity-50 flex items-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={submitNewPassword} className="space-y-4">
              <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/70 dark:border-emerald-800">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <p className="text-xs text-emerald-800 dark:text-emerald-200">OTP verified. Set your new password below.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">New password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" autoFocus className={inputCls + ' pl-9'} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Confirm new password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Re-enter new password" className={inputCls + ' pl-9'} />
                </div>
              </div>

              {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}

              <button
                type="submit"
                disabled={busy}
                className="w-full py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center gap-2 shadow-md shadow-blue-600/25 transition-all disabled:opacity-60"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                {busy ? 'Saving…' : 'Set New Password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
