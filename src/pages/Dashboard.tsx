import { useEffect, useState } from 'react';
import {
  Users,
  UserCheck,
  BookOpen,
  BookmarkCheck,
  CalendarCheck,
  Wallet,
  FileText,
  Award,
  TrendingUp,
  AlertCircle,
  CheckCheck,
  XCircle,
  GraduationCap,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { cn } from '@/utils/cn';
import { todayStr, calcAttendancePercent } from '@/utils/date';

function formatINR(n: number): string {
  return `₹${n.toLocaleString('en-IN')}`;
}

interface Stats {
  totalStudents: number;
  activeStudents: number;
  totalCourses: number;
  activeCourses: number;
  totalEnrollments: number;
  todayPresent: number;
  todayAbsent: number;
  pendingFees: number;
  upcomingExams: number;
  readyCertificates: number;
  issuedCertificates: number;
  issuedThisMonth: number;
}

const initialStats: Stats = {
  totalStudents: 0,
  activeStudents: 0,
  totalCourses: 0,
  activeCourses: 0,
  totalEnrollments: 0,
  todayPresent: 0,
  todayAbsent: 0,
  pendingFees: 0,
  upcomingExams: 0,
  readyCertificates: 0,
  issuedCertificates: 0,
  issuedThisMonth: 0,
};

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>(initialStats);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      setLoading(true);
      setError(null);
      try {
        const today = todayStr();

        const [
          studentsRes,
          activeStudentsRes,
          coursesRes,
          activeCoursesRes,
          enrollmentsRes,
          todayPresentRes,
          todayAbsentRes,
          pendingFeesAmountRes,
          upcomingExamsRes,
          readyCertificatesRes,
          issuedCertificatesRes,
          issuedThisMonthRes,
        ] = await Promise.all([
          supabase.from('students').select('*', { count: 'exact', head: true }),
          supabase.from('students').select('*', { count: 'exact', head: true }).eq('status', 'Active'),
          supabase.from('courses').select('*', { count: 'exact', head: true }),
          supabase.from('courses').select('*', { count: 'exact', head: true }).eq('status', 'Active'),
          supabase.from('enrollments').select('*', { count: 'exact', head: true }),
          supabase.from('attendance').select('*', { count: 'exact', head: true }).eq('attendance_date', today).eq('status', 'Present'),
          supabase.from('attendance').select('*', { count: 'exact', head: true }).eq('attendance_date', today).eq('status', 'Absent'),
          (async () => {
            const { data: enrollments } = await supabase
              .from('enrollments')
              .select('id, final_fees')
              .neq('status', 'Inactive');
            const enrollList = enrollments ?? [];
            if (enrollList.length === 0) return { pendingAmount: 0 };
            const ids = enrollList.map((e) => e.id);
            const { data: payments } = await supabase
              .from('fee_payments')
              .select('enrollment_id, amount')
              .eq('is_voided', false)
              .in('enrollment_id', ids);
            const paidMap: Record<string, number> = {};
            (payments ?? []).forEach((p) => {
              paidMap[p.enrollment_id] = (paidMap[p.enrollment_id] ?? 0) + Number(p.amount);
            });
            const pendingAmount = enrollList.reduce((sum, e) => {
              const paid = paidMap[e.id] ?? 0;
              return sum + Math.max(0, Number(e.final_fees) - paid);
            }, 0);
            return { pendingAmount };
          })(),
          supabase.from('exams').select('*', { count: 'exact', head: true }),
          supabase.from('certificates').select('*', { count: 'exact', head: true }).eq('status', 'Ready'),
          supabase.from('certificates').select('*', { count: 'exact', head: true }).eq('status', 'Issued'),
          supabase.from('certificates').select('*', { count: 'exact', head: true }).eq('status', 'Issued').gte('issue_date', `${today.substring(0, 7)}-01`),
        ]);

        setStats({
          totalStudents: studentsRes.count ?? 0,
          activeStudents: activeStudentsRes.count ?? 0,
          totalCourses: coursesRes.count ?? 0,
          activeCourses: activeCoursesRes.count ?? 0,
          totalEnrollments: enrollmentsRes.count ?? 0,
          todayPresent: todayPresentRes.count ?? 0,
          todayAbsent: todayAbsentRes.count ?? 0,
          pendingFees: pendingFeesAmountRes.pendingAmount,
          upcomingExams: upcomingExamsRes.count ?? 0,
          readyCertificates: readyCertificatesRes.count ?? 0,
          issuedCertificates: issuedCertificatesRes.count ?? 0,
          issuedThisMonth: issuedThisMonthRes.count ?? 0,
        });
      } catch {
        setError('Unable to load dashboard data. Please try again.');
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  const todayTotal = stats.todayPresent + stats.todayAbsent;
  const todayPercent = calcAttendancePercent(stats.todayPresent, todayTotal);

  const primaryCards = [
    {
      label: 'Total Students',
      value: stats.totalStudents,
      icon: Users,
      color: 'bg-sky-50 text-sky-600 border-sky-200',
      iconBg: 'bg-sky-100',
    },
    {
      label: 'Active Students',
      value: stats.activeStudents,
      icon: UserCheck,
      color: 'bg-emerald-50 text-emerald-600 border-emerald-200',
      iconBg: 'bg-emerald-100',
    },
    {
      label: 'Total Courses',
      value: stats.totalCourses,
      icon: BookOpen,
      color: 'bg-amber-50 text-amber-600 border-amber-200',
      iconBg: 'bg-amber-100',
    },
    {
      label: 'Active Courses',
      value: stats.activeCourses,
      icon: BookmarkCheck,
      color: 'bg-violet-50 text-violet-600 border-violet-200',
      iconBg: 'bg-violet-100',
    },
  ];

  const secondaryCards = [
    {
      label: 'Pending Fees',
      value: formatINR(stats.pendingFees),
      icon: Wallet,
      hint: 'Outstanding balance',
    },
    {
      label: 'Enrollments',
      value: stats.totalEnrollments,
      icon: GraduationCap,
      hint: 'Total enrollments',
    },
    {
      label: 'Exams',
      value: stats.upcomingExams,
      icon: FileText,
      hint: 'Total exam records',
    },
    {
      label: 'Certificates',
      value: stats.readyCertificates,
      icon: Award,
      hint: 'Ready to be issued',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Overview of your computer training institute
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {/* Primary stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {primaryCards.map((card) => (
          <div
            key={card.label}
            className={cn(
              'rounded-xl border p-5 transition',
              card.color
            )}
          >
            <div className="flex items-center justify-between mb-3">
              <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', card.iconBg)}>
                <card.icon className="h-5 w-5" />
              </div>
            </div>
            <p className="text-3xl font-bold tabular-nums">
              {loading ? (
                <span className="inline-block w-12 h-8 bg-current/10 rounded animate-pulse" />
              ) : (
                card.value
              )}
            </p>
            <p className="text-sm font-medium mt-1 opacity-80">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Today's Attendance section */}
      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <CalendarCheck className="h-4 w-4 text-slate-400" />
          Today's Attendance
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-sm transition">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600">
                <CheckCheck className="h-4 w-4" />
              </div>
              <p className="text-sm font-medium text-slate-600">Present Today</p>
            </div>
            <p className="text-2xl font-bold text-emerald-700 tabular-nums">
              {loading ? (
                <span className="inline-block w-10 h-7 bg-slate-100 rounded animate-pulse" />
              ) : (
                stats.todayPresent
              )}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-sm transition">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center text-red-600">
                <XCircle className="h-4 w-4" />
              </div>
              <p className="text-sm font-medium text-slate-600">Absent Today</p>
            </div>
            <p className="text-2xl font-bold text-red-700 tabular-nums">
              {loading ? (
                <span className="inline-block w-10 h-7 bg-slate-100 rounded animate-pulse" />
              ) : (
                stats.todayAbsent
              )}
            </p>
          </div>
          <div className="bg-slate-900 rounded-xl p-5 text-white">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center text-white">
                <TrendingUp className="h-4 w-4" />
              </div>
              <p className="text-sm font-medium text-slate-300">Attendance %</p>
            </div>
            <p className="text-2xl font-bold tabular-nums">
              {loading ? (
                <span className="inline-block w-10 h-7 bg-white/10 rounded animate-pulse" />
              ) : todayTotal === 0 ? (
                <span className="text-base text-slate-300 font-normal">No attendance recorded today</span>
              ) : (
                `${todayPercent}%`
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Secondary stat cards */}
      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-slate-400" />
          Quick Overview
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {secondaryCards.map((card) => (
            <div
              key={card.label}
              className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-sm transition"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                  <card.icon className="h-4 w-4" />
                </div>
                <p className="text-sm font-medium text-slate-600">{card.label}</p>
              </div>
              <p className="text-2xl font-bold text-slate-900 tabular-nums">
                {loading ? (
                  <span className="inline-block w-10 h-7 bg-slate-100 rounded animate-pulse" />
                ) : (
                  card.value
                )}
              </p>
              <p className="text-xs text-slate-400 mt-1">{card.hint}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Certificates section */}
      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <Award className="h-4 w-4 text-slate-400" />
          Certificates
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Ready', value: stats.readyCertificates, color: 'text-amber-700', bg: 'bg-amber-100' },
            { label: 'Total Issued', value: stats.issuedCertificates, color: 'text-emerald-700', bg: 'bg-emerald-100' },
            { label: 'Issued This Month', value: stats.issuedThisMonth, color: 'text-sky-700', bg: 'bg-sky-100' },
          ].map((card) => (
            <div key={card.label} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-sm transition">
              <div className="flex items-center gap-3 mb-3">
                <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', card.bg, card.color)}>
                  <Award className="h-4 w-4" />
                </div>
                <p className="text-sm font-medium text-slate-600">{card.label}</p>
              </div>
              <p className={cn('text-2xl font-bold tabular-nums', card.color)}>
                {loading ? (
                  <span className="inline-block w-10 h-7 bg-slate-100 rounded animate-pulse" />
                ) : (
                  card.value
                )}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
