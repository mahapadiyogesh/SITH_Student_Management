import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Users, CalendarCheck, Wallet, AlertCircle, BookOpen,
  GraduationCap, FileText, Award, Loader2, Search,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { cn } from '@/utils/cn';
import { formatDateDMY } from '@/utils/date';
import type { Student } from '@/types/database';

// ---------- Shared helpers ----------

function formatINR(n: number): string {
  return `₹${n.toLocaleString('en-IN')}`;
}

// ---------- Types ----------

interface Tab { id: string; label: string; icon: typeof Users }
const TABS: Tab[] = [
  { id: 'students', label: 'Students', icon: Users },
  { id: 'attendance', label: 'Attendance', icon: CalendarCheck },
  { id: 'fees', label: 'Fees / Collections', icon: Wallet },
  { id: 'pending', label: 'Pending Fees', icon: AlertCircle },
  { id: 'courses', label: 'Course-wise', icon: BookOpen },
  { id: 'enrollments', label: 'Enrollments', icon: GraduationCap },
  { id: 'exams', label: 'Exams', icon: FileText },
  { id: 'certificates', label: 'Certificates', icon: Award },
];

// ================================================================
// STUDENT REPORT
// ================================================================

function StudentReport() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    const query = supabase.from('students').select('*').order('full_name');
    const { data } = await query;
    setStudents((data ?? []) as Student[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchStudents(); }, [fetchStudents]);

  const filtered = useMemo(() => students.filter(s => {
    if (statusFilter !== 'All' && s.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return s.full_name.toLowerCase().includes(q) ||
        (s.student_id ?? '').toLowerCase().includes(q) ||
        (s.mobile_number ?? '').toLowerCase().includes(q);
    }
    return true;
  }), [students, search, statusFilter]);

  const activeCount = students.filter(s => s.status === 'Active').length;
  const inactiveCount = students.filter(s => s.status === 'Inactive').length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-lg border border-slate-200 p-3 text-center">
          <p className="text-xs text-slate-400">Total</p>
          <p className="text-xl font-bold text-slate-900 tabular-nums">{students.length}</p>
        </div>
        <div className="bg-emerald-50 rounded-lg border border-emerald-200 p-3 text-center">
          <p className="text-xs text-emerald-600">Active</p>
          <p className="text-xl font-bold text-emerald-700 tabular-nums">{activeCount}</p>
        </div>
        <div className="bg-slate-50 rounded-lg border border-slate-200 p-3 text-center">
          <p className="text-xs text-slate-500">Inactive</p>
          <p className="text-xl font-bold text-slate-600 tabular-nums">{inactiveCount}</p>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, ID, mobile..."
            className="w-full pl-10 pr-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
        </div>
        <div className="flex gap-1.5">
          {(['All', 'Active', 'Inactive'] as const).map(f => (
            <button key={f} onClick={() => setStatusFilter(f)}
              className={cn('px-3 py-2 rounded-lg text-sm font-medium transition',
                statusFilter === f ? 'bg-slate-900 text-white' : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50')}>
              {f}
            </button>
          ))}
        </div>
      </div>

      <ReportTable loading={loading} empty="No students found">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            <th className="text-left px-4 py-2.5 font-medium text-slate-600 text-xs">Student ID</th>
            <th className="text-left px-4 py-2.5 font-medium text-slate-600 text-xs">Name</th>
            <th className="text-left px-4 py-2.5 font-medium text-slate-600 text-xs hidden sm:table-cell">Mobile</th>
            <th className="text-left px-4 py-2.5 font-medium text-slate-600 text-xs hidden md:table-cell">Email</th>
            <th className="text-left px-4 py-2.5 font-medium text-slate-600 text-xs hidden lg:table-cell">Admission</th>
            <th className="text-left px-4 py-2.5 font-medium text-slate-600 text-xs">Status</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(s => (
            <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50">
              <td className="px-4 py-2.5 font-mono text-xs text-slate-800">{s.student_id ?? '—'}</td>
              <td className="px-4 py-2.5 text-sm font-medium text-slate-900">{s.full_name}</td>
              <td className="px-4 py-2.5 text-sm text-slate-600 hidden sm:table-cell">{s.mobile_number ?? '—'}</td>
              <td className="px-4 py-2.5 text-sm text-slate-600 hidden md:table-cell">{s.email ?? '—'}</td>
              <td className="px-4 py-2.5 text-sm text-slate-600 hidden lg:table-cell">{formatDateDMY(s.admission_date)}</td>
              <td className="px-4 py-2.5">
                <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-medium',
                  s.status === 'Active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500')}>
                  {s.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </ReportTable>
      <p className="text-xs text-slate-400 text-center">Showing {filtered.length} of {students.length} students</p>
    </div>
  );
}

// ================================================================
// ATTENDANCE REPORT
// ================================================================

function AttendanceReport() {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('attendance')
      .select(`*, students:student_id ( student_id, full_name )`)
      .order('attendance_date', { ascending: false });
    if (dateFrom) query = query.gte('attendance_date', dateFrom);
    if (dateTo) query = query.lte('attendance_date', dateTo);
    const { data } = await query;
    setRecords(data ?? []);
    setLoading(false);
  }, [dateFrom, dateTo]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = useMemo(() => records.filter(r => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (r.students?.full_name ?? '').toLowerCase().includes(q) ||
      (r.students?.student_id ?? '').toLowerCase().includes(q);
  }), [records, search]);

  const presentCount = filtered.filter(r => r.status === 'Present').length;
  const absentCount = filtered.filter(r => r.status === 'Absent').length;
  const pct = filtered.length > 0 ? Math.round((presentCount / filtered.length) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-white rounded-lg border border-slate-200 p-3 text-center">
          <p className="text-xs text-slate-400">Total Records</p>
          <p className="text-xl font-bold text-slate-900 tabular-nums">{filtered.length}</p>
        </div>
        <div className="bg-emerald-50 rounded-lg border border-emerald-200 p-3 text-center">
          <p className="text-xs text-emerald-600">Present</p>
          <p className="text-xl font-bold text-emerald-700 tabular-nums">{presentCount}</p>
        </div>
        <div className="bg-red-50 rounded-lg border border-red-200 p-3 text-center">
          <p className="text-xs text-red-600">Absent</p>
          <p className="text-xl font-bold text-red-700 tabular-nums">{absentCount}</p>
        </div>
        <div className="bg-slate-900 rounded-lg p-3 text-center">
          <p className="text-xs text-slate-300">Attendance %</p>
          <p className="text-xl font-bold text-white tabular-nums">{pct}%</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search student..." className="w-full pl-10 pr-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
        </div>
        <div className="flex items-center gap-2 text-sm">
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="px-2.5 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
          <span className="text-slate-400">to</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="px-2.5 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
        </div>
      </div>

      <ReportTable loading={loading} empty="No attendance records found">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            <th className="text-left px-4 py-2.5 font-medium text-slate-600 text-xs">Date</th>
            <th className="text-left px-4 py-2.5 font-medium text-slate-600 text-xs">Student</th>
            <th className="text-left px-4 py-2.5 font-medium text-slate-600 text-xs hidden sm:table-cell">Student ID</th>
            <th className="text-left px-4 py-2.5 font-medium text-slate-600 text-xs">Status</th>
            <th className="text-left px-4 py-2.5 font-medium text-slate-600 text-xs hidden md:table-cell">Batch</th>
          </tr>
        </thead>
        <tbody>
          {filtered.slice(0, 200).map(r => (
            <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
              <td className="px-4 py-2.5 text-sm text-slate-800 tabular-nums">{formatDateDMY(r.attendance_date)}</td>
              <td className="px-4 py-2.5 text-sm font-medium text-slate-900">{r.students?.full_name ?? '—'}</td>
              <td className="px-4 py-2.5 text-sm text-slate-600 hidden sm:table-cell">{r.students?.student_id ?? '—'}</td>
              <td className="px-4 py-2.5">
                <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-medium',
                  r.status === 'Present' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700')}>
                  {r.status}
                </span>
              </td>
              <td className="px-4 py-2.5 text-sm text-slate-600 hidden md:table-cell">{r.batch_name || '—'}</td>
            </tr>
          ))}
        </tbody>
      </ReportTable>
      {filtered.length > 200 && <p className="text-xs text-slate-400 text-center">Showing first 200 of {filtered.length} records</p>}
      {filtered.length <= 200 && filtered.length > 0 && <p className="text-xs text-slate-400 text-center">Showing {filtered.length} records</p>}
    </div>
  );
}

// ================================================================
// FEES / COLLECTIONS REPORT
// ================================================================

function FeesReport() {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('fee_payments')
      .select(`*, enrollments!inner ( batch_name, students:student_id ( student_id, full_name ), courses:course_id ( course_name ) )`)
      .eq('is_voided', false)
      .order('payment_date', { ascending: false });
    if (dateFrom) query = query.gte('payment_date', dateFrom);
    if (dateTo) query = query.lte('payment_date', dateTo);
    const { data } = await query;
    setPayments(data ?? []);
    setLoading(false);
  }, [dateFrom, dateTo]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalCollected = payments.reduce((s, p) => s + Number(p.amount), 0);

  const byMode = useMemo(() => {
    const modes: Record<string, number> = {};
    payments.forEach(p => {
      const m = p.payment_mode ?? 'Other';
      modes[m] = (modes[m] ?? 0) + Number(p.amount);
    });
    return Object.entries(modes).sort((a, b) => b[1] - a[1]);
  }, [payments]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-emerald-50 rounded-lg border border-emerald-200 p-4">
          <p className="text-xs text-emerald-600">Total Collected</p>
          <p className="text-2xl font-bold text-emerald-700 tabular-nums">{formatINR(totalCollected)}</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <p className="text-xs text-slate-400">Transactions</p>
          <p className="text-2xl font-bold text-slate-900 tabular-nums">{payments.length}</p>
        </div>
      </div>

      {byMode.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <p className="text-xs font-medium text-slate-600 mb-2">By Payment Mode</p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {byMode.map(([mode, amount]) => (
              <div key={mode} className="text-center">
                <p className="text-xs text-slate-400">{mode}</p>
                <p className="text-sm font-bold text-slate-800 tabular-nums">{formatINR(amount)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 text-sm">
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
          className="px-2.5 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
        <span className="text-slate-400">to</span>
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
          className="px-2.5 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
      </div>

      <ReportTable loading={loading} empty="No payments found in this period">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            <th className="text-left px-4 py-2.5 font-medium text-slate-600 text-xs">Date</th>
            <th className="text-left px-4 py-2.5 font-medium text-slate-600 text-xs">Student</th>
            <th className="text-left px-4 py-2.5 font-medium text-slate-600 text-xs hidden md:table-cell">Course</th>
            <th className="text-right px-4 py-2.5 font-medium text-slate-600 text-xs">Amount</th>
            <th className="text-left px-4 py-2.5 font-medium text-slate-600 text-xs hidden sm:table-cell">Mode</th>
            <th className="text-left px-4 py-2.5 font-medium text-slate-600 text-xs hidden lg:table-cell">Receipt #</th>
          </tr>
        </thead>
        <tbody>
          {payments.slice(0, 200).map(p => (
            <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50">
              <td className="px-4 py-2.5 text-sm text-slate-800 tabular-nums">{formatDateDMY(p.payment_date)}</td>
              <td className="px-4 py-2.5 text-sm font-medium text-slate-900">{p.enrollments?.students?.full_name ?? '—'}</td>
              <td className="px-4 py-2.5 text-sm text-slate-600 hidden md:table-cell">{p.enrollments?.courses?.course_name ?? '—'}</td>
              <td className="px-4 py-2.5 text-sm text-slate-900 text-right font-medium tabular-nums">{formatINR(Number(p.amount))}</td>
              <td className="px-4 py-2.5 text-sm text-slate-600 hidden sm:table-cell">{p.payment_mode ?? '—'}</td>
              <td className="px-4 py-2.5 text-xs font-mono text-slate-600 hidden lg:table-cell">{p.receipt_number ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </ReportTable>
      {payments.length > 0 && <p className="text-xs text-slate-400 text-center">Showing {Math.min(200, payments.length)} of {payments.length} payments</p>}
    </div>
  );
}

// ================================================================
// PENDING FEES REPORT
// ================================================================

function PendingFeesReport() {
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [courseFilter, setCourseFilter] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('enrollments')
      .select(`*, students:student_id ( student_id, full_name ), courses:course_id ( id, course_name )`)
      .neq('status', 'Inactive')
      .order('created_at', { ascending: false });
    const enrollList = (data ?? []) as any[];
    if (enrollList.length === 0) { setEnrollments([]); setLoading(false); return; }

    const ids = enrollList.map(e => e.id);
    const { data: payments } = await supabase
      .from('fee_payments').select('enrollment_id, amount')
      .eq('is_voided', false).in('enrollment_id', ids);
    const paidMap: Record<string, number> = {};
    (payments ?? []).forEach(p => { paidMap[p.enrollment_id] = (paidMap[p.enrollment_id] ?? 0) + Number(p.amount); });

    const withBalance = enrollList.map(e => ({
      ...e,
      paid: paidMap[e.id] ?? 0,
      balance: Math.max(0, Number(e.final_fees) - (paidMap[e.id] ?? 0)),
    }));
    setEnrollments(withBalance);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = useMemo(() => enrollments.filter(e => {
    if (e.balance <= 0) return false;
    if (courseFilter && e.courses?.id !== courseFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (e.students?.full_name ?? '').toLowerCase().includes(q) ||
        (e.students?.student_id ?? '').toLowerCase().includes(q);
    }
    return true;
  }), [enrollments, search, courseFilter]);

  const totalPending = filtered.reduce((s, e) => s + e.balance, 0);

  const courseOptions = useMemo(() => {
    const set = new Map<string, string>();
    enrollments.forEach(e => { if (e.courses) set.set(e.courses.id, e.courses.course_name); });
    return Array.from(set.entries());
  }, [enrollments]);

  return (
    <div className="space-y-4">
      <div className="bg-red-50 rounded-lg border border-red-200 p-4">
        <p className="text-xs text-red-600">Total Pending Amount</p>
        <p className="text-2xl font-bold text-red-700 tabular-nums">{formatINR(totalPending)}</p>
        <p className="text-xs text-red-500 mt-1">{filtered.length} enrollment{filtered.length !== 1 ? 's' : ''} with outstanding balance</p>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search student..."
            className="w-full pl-10 pr-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
        </div>
        <select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)}
          className="px-2.5 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900">
          <option value="">All Courses</option>
          {courseOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
      </div>

      <ReportTable loading={loading} empty="No pending fees">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            <th className="text-left px-4 py-2.5 font-medium text-slate-600 text-xs">Student</th>
            <th className="text-left px-4 py-2.5 font-medium text-slate-600 text-xs hidden sm:table-cell">Student ID</th>
            <th className="text-left px-4 py-2.5 font-medium text-slate-600 text-xs">Course</th>
            <th className="text-right px-4 py-2.5 font-medium text-slate-600 text-xs">Final Fees</th>
            <th className="text-right px-4 py-2.5 font-medium text-slate-600 text-xs hidden sm:table-cell">Paid</th>
            <th className="text-right px-4 py-2.5 font-medium text-slate-600 text-xs">Pending</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(e => (
            <tr key={e.id} className="border-b border-slate-100 hover:bg-slate-50">
              <td className="px-4 py-2.5 text-sm font-medium text-slate-900">{e.students?.full_name ?? '—'}</td>
              <td className="px-4 py-2.5 text-sm text-slate-600 hidden sm:table-cell">{e.students?.student_id ?? '—'}</td>
              <td className="px-4 py-2.5 text-sm text-slate-700">{e.courses?.course_name ?? '—'}</td>
              <td className="px-4 py-2.5 text-sm text-slate-800 text-right tabular-nums">{formatINR(Number(e.final_fees))}</td>
              <td className="px-4 py-2.5 text-sm text-emerald-600 text-right tabular-nums hidden sm:table-cell">{formatINR(e.paid)}</td>
              <td className="px-4 py-2.5 text-sm text-red-600 text-right font-bold tabular-nums">{formatINR(e.balance)}</td>
            </tr>
          ))}
        </tbody>
      </ReportTable>
    </div>
  );
}

// ================================================================
// COURSE-WISE REPORT
// ================================================================

function CourseReport() {
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: coursesData } = await supabase.from('courses').select('*').order('course_name');
    const { data: enrollData } = await supabase.from('enrollments').select('id, course_id, final_fees, status');
    const { data: paymentData } = await supabase.from('fee_payments').select('enrollment_id, amount')
      .eq('is_voided', false);

    const paidByEnroll: Record<string, number> = {};
    (paymentData ?? []).forEach(p => {
      paidByEnroll[p.enrollment_id] = (paidByEnroll[p.enrollment_id] ?? 0) + Number(p.amount);
    });

    const enriched = (coursesData ?? []).map(c => {
      const courseEnrolls = (enrollData ?? []).filter(e => e.course_id === c.id);
      const activeEnrolls = courseEnrolls.filter(e => e.status !== 'Inactive');
      const totalFees = activeEnrolls.reduce((s, e) => s + Number(e.final_fees), 0);
      const enrollIds = courseEnrolls.map(e => e.id);
      const collected = enrollIds.reduce((s, id) => s + (paidByEnroll[id] ?? 0), 0);
      return {
        ...c,
        totalEnrollments: courseEnrolls.length,
        activeEnrollments: activeEnrolls.length,
        totalFees,
        collected,
        pending: Math.max(0, totalFees - collected),
      };
    });
    setCourses(enriched);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="space-y-4">
      <ReportTable loading={loading} empty="No courses found">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            <th className="text-left px-4 py-2.5 font-medium text-slate-600 text-xs">Course</th>
            <th className="text-left px-4 py-2.5 font-medium text-slate-600 text-xs">Code</th>
            <th className="text-right px-4 py-2.5 font-medium text-slate-600 text-xs hidden sm:table-cell">Enrollments</th>
            <th className="text-right px-4 py-2.5 font-medium text-slate-600 text-xs hidden md:table-cell">Total Fees</th>
            <th className="text-right px-4 py-2.5 font-medium text-slate-600 text-xs hidden md:table-cell">Collected</th>
            <th className="text-right px-4 py-2.5 font-medium text-slate-600 text-xs">Pending</th>
            <th className="text-left px-4 py-2.5 font-medium text-slate-600 text-xs hidden lg:table-cell">Status</th>
          </tr>
        </thead>
        <tbody>
          {courses.map(c => (
            <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
              <td className="px-4 py-2.5 text-sm font-medium text-slate-900">{c.course_name}</td>
              <td className="px-4 py-2.5 text-sm text-slate-600">{c.course_code ?? '—'}</td>
              <td className="px-4 py-2.5 text-sm text-slate-800 text-right tabular-nums hidden sm:table-cell">{c.activeEnrollments}/{c.totalEnrollments}</td>
              <td className="px-4 py-2.5 text-sm text-slate-800 text-right tabular-nums hidden md:table-cell">{formatINR(c.totalFees)}</td>
              <td className="px-4 py-2.5 text-sm text-emerald-600 text-right tabular-nums hidden md:table-cell">{formatINR(c.collected)}</td>
              <td className="px-4 py-2.5 text-sm text-red-600 text-right font-bold tabular-nums">{formatINR(c.pending)}</td>
              <td className="px-4 py-2.5 hidden lg:table-cell">
                <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-medium',
                  c.status === 'Active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500')}>
                  {c.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </ReportTable>
    </div>
  );
}

// ================================================================
// ENROLLMENT REPORT
// ================================================================

function EnrollmentReport() {
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('enrollments')
      .select(`*, students:student_id ( student_id, full_name ), courses:course_id ( course_name )`)
      .order('created_at', { ascending: false });
    if (statusFilter !== 'All') query = query.eq('status', statusFilter);
    const { data } = await query;
    setEnrollments(data ?? []);
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = useMemo(() => {
    if (!search.trim()) return enrollments;
    const q = search.toLowerCase();
    return enrollments.filter(e =>
      (e.students?.full_name ?? '').toLowerCase().includes(q) ||
      (e.students?.student_id ?? '').toLowerCase().includes(q) ||
      (e.courses?.course_name ?? '').toLowerCase().includes(q)
    );
  }, [enrollments, search]);

  const STATUS_COLORS: Record<string, string> = {
    Active: 'bg-emerald-50 text-emerald-700',
    'Exam Pending': 'bg-amber-50 text-amber-700',
    Completed: 'bg-sky-50 text-sky-700',
    Inactive: 'bg-slate-100 text-slate-500',
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..." className="w-full pl-10 pr-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
        </div>
        <div className="flex gap-1.5">
          {['All', 'Active', 'Exam Pending', 'Completed', 'Inactive'].map(f => (
            <button key={f} onClick={() => setStatusFilter(f)}
              className={cn('px-3 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap',
                statusFilter === f ? 'bg-slate-900 text-white' : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50')}>
              {f}
            </button>
          ))}
        </div>
      </div>

      <ReportTable loading={loading} empty="No enrollments found">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            <th className="text-left px-4 py-2.5 font-medium text-slate-600 text-xs">Student</th>
            <th className="text-left px-4 py-2.5 font-medium text-slate-600 text-xs hidden sm:table-cell">ID</th>
            <th className="text-left px-4 py-2.5 font-medium text-slate-600 text-xs">Course</th>
            <th className="text-left px-4 py-2.5 font-medium text-slate-600 text-xs hidden md:table-cell">Batch</th>
            <th className="text-right px-4 py-2.5 font-medium text-slate-600 text-xs hidden sm:table-cell">Fees</th>
            <th className="text-left px-4 py-2.5 font-medium text-slate-600 text-xs">Status</th>
            <th className="text-left px-4 py-2.5 font-medium text-slate-600 text-xs hidden lg:table-cell">Joining</th>
          </tr>
        </thead>
        <tbody>
          {filtered.slice(0, 200).map(e => (
            <tr key={e.id} className="border-b border-slate-100 hover:bg-slate-50">
              <td className="px-4 py-2.5 text-sm font-medium text-slate-900">{e.students?.full_name ?? '—'}</td>
              <td className="px-4 py-2.5 text-sm text-slate-600 hidden sm:table-cell">{e.students?.student_id ?? '—'}</td>
              <td className="px-4 py-2.5 text-sm text-slate-700">{e.courses?.course_name ?? '—'}</td>
              <td className="px-4 py-2.5 text-sm text-slate-600 hidden md:table-cell">{e.batch_name || '—'}</td>
              <td className="px-4 py-2.5 text-sm text-slate-800 text-right tabular-nums hidden sm:table-cell">{formatINR(Number(e.final_fees))}</td>
              <td className="px-4 py-2.5">
                <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-medium', STATUS_COLORS[e.status] ?? 'bg-slate-100 text-slate-500')}>
                  {e.status}
                </span>
              </td>
              <td className="px-4 py-2.5 text-sm text-slate-600 hidden lg:table-cell">{formatDateDMY(e.joining_date)}</td>
            </tr>
          ))}
        </tbody>
      </ReportTable>
      {filtered.length > 0 && <p className="text-xs text-slate-400 text-center">Showing {Math.min(200, filtered.length)} of {filtered.length}</p>}
    </div>
  );
}

// ================================================================
// EXAM REPORT
// ================================================================

function ExamReport() {
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [resultFilter, setResultFilter] = useState<string>('All');
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('exams')
      .select(`*, enrollments!inner ( batch_name, students:student_id ( student_id, full_name ), courses:course_id ( course_name ) )`)
      .order('created_at', { ascending: false });
    setExams(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = useMemo(() => exams.filter(e => {
    if (resultFilter !== 'All' && e.result !== resultFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (e.enrollments?.students?.full_name ?? '').toLowerCase().includes(q) ||
        (e.enrollments?.students?.student_id ?? '').toLowerCase().includes(q);
    }
    return true;
  }), [exams, resultFilter, search]);

  const passCount = filtered.filter(e => e.result === 'Pass').length;
  const failCount = filtered.filter(e => e.result === 'Fail').length;
  const pendingCount = filtered.filter(e => e.result === 'Pending' || !e.result).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-white rounded-lg border border-slate-200 p-3 text-center">
          <p className="text-xs text-slate-400">Total</p><p className="text-xl font-bold text-slate-900 tabular-nums">{filtered.length}</p>
        </div>
        <div className="bg-emerald-50 rounded-lg border border-emerald-200 p-3 text-center">
          <p className="text-xs text-emerald-600">Pass</p><p className="text-xl font-bold text-emerald-700 tabular-nums">{passCount}</p>
        </div>
        <div className="bg-red-50 rounded-lg border border-red-200 p-3 text-center">
          <p className="text-xs text-red-600">Fail</p><p className="text-xl font-bold text-red-700 tabular-nums">{failCount}</p>
        </div>
        <div className="bg-amber-50 rounded-lg border border-amber-200 p-3 text-center">
          <p className="text-xs text-amber-600">Pending</p><p className="text-xl font-bold text-amber-700 tabular-nums">{pendingCount}</p>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search student..."
            className="w-full pl-10 pr-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
        </div>
        <div className="flex gap-1.5">
          {['All', 'Pass', 'Fail', 'Pending'].map(f => (
            <button key={f} onClick={() => setResultFilter(f)}
              className={cn('px-3 py-2 rounded-lg text-sm font-medium transition',
                resultFilter === f ? 'bg-slate-900 text-white' : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50')}>
              {f}
            </button>
          ))}
        </div>
      </div>

      <ReportTable loading={loading} empty="No exam records">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            <th className="text-left px-4 py-2.5 font-medium text-slate-600 text-xs">Student</th>
            <th className="text-left px-4 py-2.5 font-medium text-slate-600 text-xs hidden sm:table-cell">ID</th>
            <th className="text-left px-4 py-2.5 font-medium text-slate-600 text-xs">Course</th>
            <th className="text-left px-4 py-2.5 font-medium text-slate-600 text-xs hidden lg:table-cell">Exam</th>
            <th className="text-left px-4 py-2.5 font-medium text-slate-600 text-xs">Date</th>
            <th className="text-right px-4 py-2.5 font-medium text-slate-600 text-xs">Marks</th>
            <th className="text-left px-4 py-2.5 font-medium text-slate-600 text-xs">Result</th>
          </tr>
        </thead>
        <tbody>
          {filtered.slice(0, 200).map(e => {
            const total = e.total_marks ? Number(e.total_marks) : null;
            const obtained = e.marks_obtained != null ? Number(e.marks_obtained) : null;
            const pct = total && obtained != null ? Math.round((obtained / total) * 100) : null;
            return (
              <tr key={e.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-2.5 text-sm font-medium text-slate-900">{e.enrollments?.students?.full_name ?? '—'}</td>
                <td className="px-4 py-2.5 text-sm text-slate-600 hidden sm:table-cell">{e.enrollments?.students?.student_id ?? '—'}</td>
                <td className="px-4 py-2.5 text-sm text-slate-700">{e.enrollments?.courses?.course_name ?? '—'}</td>
                <td className="px-4 py-2.5 text-sm text-slate-600 hidden lg:table-cell">{e.exam_name || '—'}</td>
                <td className="px-4 py-2.5 text-sm text-slate-800 tabular-nums">{formatDateDMY(e.exam_date)}</td>
                <td className="px-4 py-2.5 text-sm text-slate-800 text-right tabular-nums">
                  {obtained != null && total != null ? `${obtained}/${total}` : '—'}
                  {pct != null && <span className="text-xs text-slate-400 ml-1">({pct}%)</span>}
                </td>
                <td className="px-4 py-2.5">
                  <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-medium',
                    e.result === 'Pass' ? 'bg-emerald-50 text-emerald-700' :
                    e.result === 'Fail' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700')}>
                    {e.result ?? 'Pending'}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </ReportTable>
      {filtered.length > 0 && <p className="text-xs text-slate-400 text-center">Showing {Math.min(200, filtered.length)} of {filtered.length}</p>}
    </div>
  );
}

// ================================================================
// CERTIFICATE REPORT
// ================================================================

function CertificateReport() {
  const [certs, setCerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('certificates')
      .select(`*, enrollments!inner ( batch_name, students:student_id ( student_id, full_name ), courses:course_id ( course_name ) )`)
      .order('created_at', { ascending: false });
    setCerts(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = useMemo(() => certs.filter(c => {
    if (statusFilter !== 'All' && c.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (c.certificate_number ?? '').toLowerCase().includes(q) ||
        (c.enrollments?.students?.full_name ?? '').toLowerCase().includes(q) ||
        (c.enrollments?.students?.student_id ?? '').toLowerCase().includes(q);
    }
    return true;
  }), [certs, statusFilter, search]);

  const readyCount = filtered.filter(c => c.status === 'Ready').length;
  const issuedCount = filtered.filter(c => c.status === 'Issued').length;
  const cancelledCount = filtered.filter(c => c.status === 'Cancelled').length;

  const STATUS_COLORS: Record<string, string> = {
    Ready: 'bg-amber-50 text-amber-700', Issued: 'bg-emerald-50 text-emerald-700', Cancelled: 'bg-red-50 text-red-700',
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-white rounded-lg border border-slate-200 p-3 text-center">
          <p className="text-xs text-slate-400">Total</p><p className="text-xl font-bold text-slate-900 tabular-nums">{filtered.length}</p>
        </div>
        <div className="bg-amber-50 rounded-lg border border-amber-200 p-3 text-center">
          <p className="text-xs text-amber-600">Ready</p><p className="text-xl font-bold text-amber-700 tabular-nums">{readyCount}</p>
        </div>
        <div className="bg-emerald-50 rounded-lg border border-emerald-200 p-3 text-center">
          <p className="text-xs text-emerald-600">Issued</p><p className="text-xl font-bold text-emerald-700 tabular-nums">{issuedCount}</p>
        </div>
        <div className="bg-red-50 rounded-lg border border-red-200 p-3 text-center">
          <p className="text-xs text-red-600">Cancelled</p><p className="text-xl font-bold text-red-700 tabular-nums">{cancelledCount}</p>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by number or student..."
            className="w-full pl-10 pr-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
        </div>
        <div className="flex gap-1.5">
          {['All', 'Ready', 'Issued', 'Cancelled'].map(f => (
            <button key={f} onClick={() => setStatusFilter(f)}
              className={cn('px-3 py-2 rounded-lg text-sm font-medium transition',
                statusFilter === f ? 'bg-slate-900 text-white' : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50')}>
              {f}
            </button>
          ))}
        </div>
      </div>

      <ReportTable loading={loading} empty="No certificates found">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            <th className="text-left px-4 py-2.5 font-medium text-slate-600 text-xs">Certificate #</th>
            <th className="text-left px-4 py-2.5 font-medium text-slate-600 text-xs">Student</th>
            <th className="text-left px-4 py-2.5 font-medium text-slate-600 text-xs hidden sm:table-cell">Course</th>
            <th className="text-left px-4 py-2.5 font-medium text-slate-600 text-xs hidden md:table-cell">Month</th>
            <th className="text-left px-4 py-2.5 font-medium text-slate-600 text-xs">Status</th>
            <th className="text-left px-4 py-2.5 font-medium text-slate-600 text-xs hidden lg:table-cell">Issue Date</th>
          </tr>
        </thead>
        <tbody>
          {filtered.slice(0, 200).map(c => (
            <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
              <td className="px-4 py-2.5 font-mono text-xs font-medium text-slate-800">{c.certificate_number ?? '—'}</td>
              <td className="px-4 py-2.5 text-sm font-medium text-slate-900">{c.enrollments?.students?.full_name ?? '—'}</td>
              <td className="px-4 py-2.5 text-sm text-slate-700 hidden sm:table-cell">{c.enrollments?.courses?.course_name ?? '—'}</td>
              <td className="px-4 py-2.5 text-sm text-slate-600 hidden md:table-cell">{c.certificate_month || '—'}</td>
              <td className="px-4 py-2.5">
                <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-medium', STATUS_COLORS[c.status] ?? '')}>
                  {c.status}
                </span>
              </td>
              <td className="px-4 py-2.5 text-sm text-slate-600 hidden lg:table-cell">{formatDateDMY(c.issue_date)}</td>
            </tr>
          ))}
        </tbody>
      </ReportTable>
      {filtered.length > 0 && <p className="text-xs text-slate-400 text-center">Showing {Math.min(200, filtered.length)} of {filtered.length}</p>}
    </div>
  );
}

// ================================================================
// SHARED TABLE WRAPPER
// ================================================================

function ReportTable({ loading, empty, children }: { loading: boolean; empty: string; children: React.ReactNode }) {
  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
    </div>
  );
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {React.Children.count(children) === 0 ? (
        <div className="flex items-center justify-center py-12 text-sm text-slate-400">{empty}</div>
      ) : (
        <div className="overflow-x-auto">{children}</div>
      )}
    </div>
  );
}

// ================================================================
// MAIN REPORTS PAGE
// ================================================================

import React from 'react';

export default function Reports() {
  const [tab, setTab] = useState('students');

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Reports</h1>
        <p className="text-sm text-slate-500 mt-0.5">Institute-wide reports and analytics</p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-200">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition',
              tab === t.id ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'
            )}>
            <t.icon className="h-4 w-4" />
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {tab === 'students' && <StudentReport />}
      {tab === 'attendance' && <AttendanceReport />}
      {tab === 'fees' && <FeesReport />}
      {tab === 'pending' && <PendingFeesReport />}
      {tab === 'courses' && <CourseReport />}
      {tab === 'enrollments' && <EnrollmentReport />}
      {tab === 'exams' && <ExamReport />}
      {tab === 'certificates' && <CertificateReport />}
    </div>
  );
}
