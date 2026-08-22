import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, Loader2, Shield, ArrowLeft, Monitor, GraduationCap, BookOpen, Code } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';

export default function Login() {
  const { signIn, resetPasswordForEmail } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Forgot password state
  const [mode, setMode] = useState<'login' | 'forgot'>('login');
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast('Please enter both email and password', 'error');
      return;
    }
    setLoading(true);
    const { error } = await signIn(email.trim(), password);
    setLoading(false);
    if (error) {
      toast(error, 'error');
    } else {
      toast('Welcome back!', 'success');
      navigate('/dashboard');
    }
  };

  const handleResetSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!resetEmail) {
      toast('Please enter your registered email address', 'error');
      return;
    }
    setResetLoading(true);
    const { error } = await resetPasswordForEmail(resetEmail.trim());
    setResetLoading(false);
    if (error) {
      toast(error, 'error');
    } else {
      setResetSent(true);
      toast('Password reset link sent to your email', 'success');
    }
  };

  const backToLogin = () => {
    setMode('login');
    setResetEmail('');
    setResetSent(false);
  };

  if (mode === 'forgot') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-slate-50 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md animate-login-card">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-600 text-white mb-4 shadow-lg shadow-indigo-200">
              <Mail className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Reset Password</h1>
            <p className="text-slate-500 mt-1 text-sm">
              {resetSent
                ? 'Check your email for the reset link'
                : 'Enter your registered email to receive a reset link'}
            </p>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl shadow-slate-200/50 border border-white/60 p-6 sm:p-8">
            {resetSent ? (
              <div className="text-center space-y-4">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 text-green-600 mb-2">
                  <Mail className="h-6 w-6" />
                </div>
                <p className="text-sm text-slate-600">
                  If an account exists for <strong className="text-slate-900">{resetEmail}</strong>, a password reset link has been sent.
                </p>
                <p className="text-xs text-slate-400">
                  The link will expire in 1 hour. Check your spam folder if you don't see the email.
                </p>
                <button
                  type="button"
                  onClick={backToLogin}
                  className="inline-flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-800 hover:underline transition"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Login
                </button>
              </div>
            ) : (
              <>
                <form onSubmit={handleResetSubmit} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        type="email"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        placeholder="admin@example.com"
                        className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 transition"
                        autoComplete="email"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-medium py-2.5 rounded-xl transition shadow-md shadow-indigo-200 hover:shadow-lg hover:shadow-indigo-300 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {resetLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                    {resetLoading ? 'Sending...' : 'Send Reset Link'}
                  </button>
                </form>

                <div className="mt-5 pt-5 border-t border-slate-100 text-center">
                  <button
                    type="button"
                    onClick={backToLogin}
                    className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-indigo-600 transition"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Login
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center justify-center gap-2 text-xs text-slate-400 mt-6">
            <Shield className="h-3 w-3" />
            <span>Secured &mdash; Authorized administrators only</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-blue-50 via-indigo-50 to-slate-50">
      {/* ─── Left: Illustration Panel ─── */}
      <div className="hidden lg:flex lg:w-[55%] xl:w-[58%] relative overflow-hidden bg-gradient-to-br from-indigo-600 via-blue-600 to-indigo-700">
        {/* Ambient background orbs */}
        <div className="absolute inset-0">
          <div className="absolute top-[12%] left-[8%] w-52 h-52 rounded-full bg-blue-400/15 animate-login-ambient" />
          <div className="absolute bottom-[18%] right-[12%] w-64 h-64 rounded-full bg-indigo-300/12 animate-login-ambient" style={{ animationDelay: '3s' }} />
          <div className="absolute top-[55%] left-[45%] w-36 h-36 rounded-full bg-sky-400/10 animate-login-ambient" style={{ animationDelay: '6s' }} />
        </div>

        {/* Dot grid pattern */}
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

        {/* ── Scene content ── */}
        <div className="relative z-10 flex flex-col items-center justify-center w-full p-10 xl:p-14">

          {/* Main Monitor */}
          <div className="animate-login-float">
            <div className="bg-slate-900/80 backdrop-blur rounded-2xl p-3 shadow-2xl shadow-indigo-900/40 border border-white/10">
              <div className="bg-slate-800/90 rounded-xl overflow-hidden">
                {/* Title bar */}
                <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-800">
                  <div className="w-2 h-2 rounded-full bg-red-400/70" />
                  <div className="w-2 h-2 rounded-full bg-yellow-400/70" />
                  <div className="w-2 h-2 rounded-full bg-green-400/70" />
                  <div className="ml-3 h-3.5 w-32 rounded bg-white/5" />
                </div>
                {/* Screen content — code lines */}
                <div className="px-4 py-4 space-y-2.5 animate-login-shimmer">
                  <div className="flex gap-2"><div className="w-3 h-3 rounded-sm bg-indigo-400/50" /><div className="h-3 w-28 rounded bg-white/15" /></div>
                  <div className="flex gap-2 pl-5"><div className="h-3 w-20 rounded bg-sky-400/35" /><div className="h-3 w-14 rounded bg-emerald-400/30" /></div>
                  <div className="flex gap-2 pl-5"><div className="h-3 w-16 rounded bg-amber-400/30" /><div className="h-3 w-24 rounded bg-white/12" /></div>
                  <div className="flex gap-2 pl-5"><div className="h-3 w-12 rounded bg-indigo-400/40" /><div className="h-3 w-20 rounded bg-sky-400/25" /></div>
                  <div className="flex gap-2"><div className="h-3 w-24 rounded bg-white/15" /></div>
                  <div className="flex gap-2 pl-5"><div className="h-3 w-14 rounded bg-emerald-400/30" /><div className="h-3 w-10 rounded bg-amber-400/25" /></div>
                </div>
              </div>
            </div>
            {/* Monitor stand */}
            <div className="flex justify-center">
              <div className="w-10 h-5 bg-slate-600/40 rounded-b-lg" />
            </div>
            <div className="flex justify-center">
              <div className="w-20 h-1.5 bg-slate-600/30 rounded-full" />
            </div>
          </div>

          {/* Desk surface */}
          <div className="w-72 xl:w-80 h-1.5 bg-white/10 rounded-full mt-1" />

          {/* Teacher figure (left of monitor) */}
          <div className="absolute left-8 xl:left-14 top-[38%] animate-login-float-slow" style={{ animationDelay: '0.5s' }}>
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-indigo-300/50 border-2 border-white/20" />
              <div className="w-10 h-14 bg-indigo-400/30 rounded-t-lg mt-1" />
            </div>
          </div>

          {/* Student figure (right of monitor, at smaller device) */}
          <div className="absolute right-10 xl:right-16 top-[44%] animate-login-float-slow" style={{ animationDelay: '1.5s' }}>
            <div className="flex flex-col items-center">
              <div className="w-7 h-7 rounded-full bg-sky-300/50 border-2 border-white/20" />
              <div className="w-9 h-12 bg-sky-400/30 rounded-t-lg mt-1" />
            </div>
          </div>

          {/* Small laptop (right side, in front of student) */}
          <div className="absolute right-6 xl:right-12 top-[62%] animate-login-float-slow" style={{ animationDelay: '2s' }}>
            <div className="bg-slate-700/40 rounded-lg p-1.5 border border-white/10">
              <div className="w-14 h-9 bg-slate-800/50 rounded-md flex items-center justify-center">
                <div className="space-y-1 w-10">
                  <div className="h-1.5 w-8 rounded bg-sky-400/30" />
                  <div className="h-1.5 w-6 rounded bg-white/15" />
                  <div className="h-1.5 w-7 rounded bg-indigo-400/25" />
                </div>
              </div>
            </div>
          </div>

          {/* Books stack (left side on desk) */}
          <div className="absolute left-12 xl:left-20 bottom-[32%] animate-login-float-slow" style={{ animationDelay: '1s' }}>
            <div className="space-y-0.5">
              <div className="w-10 h-2.5 rounded-sm bg-amber-400/40" />
              <div className="w-9 h-2.5 rounded-sm bg-blue-400/40" />
              <div className="w-11 h-2.5 rounded-sm bg-emerald-400/35" />
            </div>
          </div>

          {/* Floating education icons */}
          <div className="absolute top-[14%] right-[14%] animate-login-drift">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/10">
              <GraduationCap className="h-5 w-5 text-white/60" />
            </div>
          </div>
          <div className="absolute bottom-[22%] left-[10%] animate-login-drift" style={{ animationDelay: '2s' }}>
            <div className="w-9 h-9 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/10">
              <BookOpen className="h-4 w-4 text-white/50" />
            </div>
          </div>
          <div className="absolute top-[32%] right-[8%] animate-login-drift" style={{ animationDelay: '4s' }}>
            <div className="w-8 h-8 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/10">
              <Monitor className="h-4 w-4 text-white/50" />
            </div>
          </div>
          <div className="absolute bottom-[36%] right-[32%] animate-login-drift" style={{ animationDelay: '3s' }}>
            <div className="w-8 h-8 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/10">
              <Code className="h-4 w-4 text-white/40" />
            </div>
          </div>

          {/* Screen glow accent */}
          <div className="absolute top-[30%] left-1/2 -translate-x-1/2 w-48 h-48 rounded-full bg-blue-400/8 animate-login-glow" />
        </div>
      </div>

      {/* ─── Right: Login Card ─── */}
      <div className="flex-1 flex items-center justify-center px-4 py-8 lg:px-10">
        <div className="w-full max-w-[400px] animate-login-card">
          {/* Branding */}
          <div className="text-center mb-7">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-600 text-white mb-4 shadow-lg shadow-indigo-200/60">
              <Monitor className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">SITH Computer Class</h1>
            <p className="text-slate-500 mt-1 text-sm">Student Management System</p>
          </div>

          {/* Card */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl shadow-slate-200/50 border border-white/60 p-6 sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@example.com"
                    className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 transition"
                    autoComplete="email"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => setMode('forgot')}
                    className="text-xs font-medium text-slate-500 hover:text-indigo-600 transition"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 transition"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-medium py-2.5 rounded-xl transition shadow-md shadow-indigo-200 hover:shadow-lg hover:shadow-indigo-300 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-center gap-2 text-xs text-slate-400 mt-6">
            <Shield className="h-3 w-3" />
            <span>Secured &mdash; Authorized administrators only</span>
          </div>
        </div>
      </div>
    </div>
  );
}
