import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Wallet,
  PlusCircle,
  History,
  UserSearch,
  Users,
  AlertCircle,
  Loader2,
  Search,
  Save,
  Eye,
  Ban,
  ArrowLeft,
  TrendingUp,
  CalendarRange,
  BookOpen,
  IndianRupee,
  CheckCircle,
  XCircle,
  ArrowUpDown,
  Download,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/utils/cn';
import { todayStr, formatDateDMY, getMonthName } from '@/utils/date';
import {
  formatINR,
  calcFeeStatus,
  calcBalance,
  PAYMENT_MODES,
  PAYMENT_MODE_COLORS,
  FEE_STATUS_COLORS,
  generateReceiptNumber,
  type FeeStatus,
} from '@/utils/fees';
import type { Student, Course, Enrollment, FeePayment, PaymentMode } from '@/types/database';
import ConfirmDialog from '@/components/ConfirmDialog';
import ReceiptModal, { type ReceiptData } from '@/components/ReceiptModal';
import * as XLSX from 'xlsx';

type Tab = 'collect' | 'history' | 'details' | 'pending' | 'reports';

interface EnrollmentWithCourse extends Enrollment {
  courses: Pick<Course, 'id' | 'course_name' | 'course_code'> | null;
  students: Pick<Student, 'id' | 'student_id' | 'full_name'> | null;
}

interface PaymentWithDetails extends FeePayment {
  enrollments: {
    id: string;
    batch_name: string | null;
    final_fees: number;
    students: Pick<Student, 'id' | 'student_id' | 'full_name'> | null;
    courses: Pick<Course, 'id' | 'course_name' | 'course_code'> | null;
  } | null;
}

export default function Fees() {
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>('collect');
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      // Fetch ALL fee payments with enrollment, student, course details
      const { data: payments, error } = await supabase
        .from('fee_payments')
        .select(`
          *,
          enrollments:enrollment_id (
            id, final_fees,
            students:student_id ( id, student_id, full_name ),
            courses:course_id ( id, course_name, course_code )
          )
        `)
        .order('payment_date', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;

      const allPayments = (payments ?? []) as PaymentWithDetails[];

      // Compute per-enrollment paid totals (non-voided only)
      const paidByEnrollment: Record<string, number> = {};
      allPayments.forEach((p) => {
        if (!p.is_voided) {
          const eid = p.enrollment_id;
          paidByEnrollment[eid] = (paidByEnrollment[eid] ?? 0) + Number(p.amount);
        }
      });

      const headers = [
        'Student ID', 'Student Name', 'Course', 'Course Code', 'Batch',
        'Payment Date', 'Receipt Number', 'Amount', 'Payment Mode',
        'Payment Status', 'Reference Number', 'Remarks',
        'Enrollment Final Fees', 'Total Paid', 'Balance',
      ];

      const rows = allPayments.map((p) => {
        const enroll = p.enrollments;
        const finalFees = Number(enroll?.final_fees) || 0;
        const totalPaid = paidByEnrollment[p.enrollment_id] ?? 0;
        const balance = Math.max(0, finalFees - totalPaid);
        return [
          enroll?.students?.student_id ?? '',
          enroll?.students?.full_name ?? '',
          enroll?.courses?.course_name ?? '',
          enroll?.courses?.course_code ?? '',
          '', // batch not available in this join path
          p.payment_date ?? '',
          p.receipt_number ?? '',
          Number(p.amount),
          p.payment_mode ?? '',
          p.is_voided ? 'Voided' : 'Valid',
          p.reference_number ?? '',
          p.remarks ?? '',
          finalFees,
          totalPaid,
          balance,
        ];
      });

      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      ws['!cols'] = [
        { wch: 12 }, { wch: 25 }, { wch: 25 }, { wch: 12 }, { wch: 15 },
        { wch: 14 }, { wch: 16 }, { wch: 12 }, { wch: 14 }, { wch: 12 },
        { wch: 16 }, { wch: 20 }, { wch: 16 }, { wch: 12 }, { wch: 12 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Fee Payments');
      const today = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `fees_export_${today}.xlsx`);

      toast('Fee payment data exported successfully', 'success');
    } catch {
      toast('Failed to export fee payment data', 'error');
    } finally {
      setExporting(false);
    }
  };

  const tabs = [
    { id: 'collect' as Tab, label: 'Collect Payment', icon: PlusCircle },
    { id: 'history' as Tab, label: 'Payment History', icon: History },
    { id: 'details' as Tab, label: 'Student Fee Details', icon: UserSearch },
    { id: 'pending' as Tab, label: 'Pending Fees', icon: AlertCircle },
    { id: 'reports' as Tab, label: 'Fee Reports', icon: TrendingUp },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Fees Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">Collect payments, track history, and manage fees</p>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition disabled:opacity-60"
        >
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Export Excel
        </button>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-200">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition',
              tab === t.id
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            )}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'collect' && <CollectPayment />}
      {tab === 'history' && <PaymentHistory />}
      {tab === 'details' && <StudentFeeDetails />}
      {tab === 'pending' && <PendingFees />}
      {tab === 'reports' && <FeeReports />}
    </div>
  );
}

// ============================================================
// COLLECT PAYMENT
// ============================================================
function CollectPayment({ preselectedStudentId, onDone }: { preselectedStudentId?: string; onDone?: () => void }) {
  const { toast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState(preselectedStudentId ?? '');
  const [enrollments, setEnrollments] = useState<EnrollmentWithCourse[]>([]);
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState('');
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [loadingEnrollments, setLoadingEnrollments] = useState(false);
  const [saving, setSaving] = useState(false);

  const [paymentDate, setPaymentDate] = useState(todayStr());
  const [amount, setAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('Cash');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [remarks, setRemarks] = useState('');

  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);

  useEffect(() => {
    async function loadStudents() {
      setLoadingStudents(true);
      const { data } = await supabase
        .from('students')
        .select('*')
        .eq('status', 'Active')
        .order('full_name');
      setStudents((data ?? []) as Student[]);
      setLoadingStudents(false);
    }
    loadStudents();
  }, []);

  // Load enrollments when student changes
  useEffect(() => {
    if (!selectedStudentId) {
      setEnrollments([]);
      setSelectedEnrollmentId('');
      return;
    }
    setLoadingEnrollments(true);
    supabase
      .from('enrollments')
      .select(`
        *,
        courses:course_id ( id, course_name, course_code ),
        students:student_id ( id, student_id, full_name )
      `)
      .eq('student_id', selectedStudentId)
      .neq('status', 'Inactive')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setEnrollments((data ?? []) as EnrollmentWithCourse[]);
        setSelectedEnrollmentId('');
        setLoadingEnrollments(false);
      });
  }, [selectedStudentId]);

  const selectedEnrollment = enrollments.find((e) => e.id === selectedEnrollmentId);
  const selectedStudent = students.find((s) => s.id === selectedStudentId);

  // Calculate fees
  const finalFees = selectedEnrollment?.final_fees ?? 0;
  const [totalPaid, setTotalPaid] = useState(0);
  const balance = calcBalance(finalFees, totalPaid);
  const feeStatus = calcFeeStatus(totalPaid, balance);

  // Load total paid for selected enrollment
  useEffect(() => {
    if (!selectedEnrollmentId) {
      setTotalPaid(0);
      return;
    }
    supabase
      .from('fee_payments')
      .select('amount')
      .eq('enrollment_id', selectedEnrollmentId)
      .eq('is_voided', false)
      .then(({ data }) => {
        const sum = (data ?? []).reduce((acc, p) => acc + Number(p.amount), 0);
        setTotalPaid(sum);
      });
  }, [selectedEnrollmentId]);

  const handleSave = async () => {
    if (!selectedStudentId || !selectedEnrollmentId) {
      toast('Please select a student and enrollment', 'error');
      return;
    }
    if (!paymentDate) {
      toast('Payment date is required', 'error');
      return;
    }
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      toast('Amount must be greater than 0', 'error');
      return;
    }
    if (amt > balance) {
      toast(`Payment amount cannot exceed the remaining balance of ${formatINR(balance)}`, 'error');
      return;
    }

    setSaving(true);
    try {
      const receiptNumber = await generateReceiptNumber();

      const { data, error } = await supabase
        .from('fee_payments')
        .insert({
          enrollment_id: selectedEnrollmentId,
          payment_date: paymentDate,
          amount: amt,
          payment_mode: paymentMode,
          reference_number: referenceNumber || null,
          remarks: remarks || null,
          receipt_number: receiptNumber,
          is_voided: false,
        })
        .select()
        .single();

      if (error) throw error;

      const newTotalPaid = totalPaid + amt;
      const newBalance = calcBalance(finalFees, newTotalPaid);

      setReceiptData({
        receiptNumber,
        paymentDate,
        studentName: selectedStudent?.full_name ?? '—',
        studentId: selectedStudent?.student_id ?? '—',
        courseName: selectedEnrollment?.courses?.course_name ?? '—',
        batchName: selectedEnrollment?.batch_name ?? '',
        amount: amt,
        paymentMode,
        referenceNumber: referenceNumber || null,
        finalFees,
        totalPaidAfter: newTotalPaid,
        remainingBalance: newBalance,
        remarks: remarks || null,
      });

      toast('Payment collected successfully', 'success');

      // Reset form
      setAmount('');
      setReferenceNumber('');
      setRemarks('');
      setPaymentMode('Cash');
      setTotalPaid(newTotalPaid);

      if (onDone) onDone();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to collect payment';
      toast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="space-y-4">
        {/* Student & Enrollment Selection */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Student *</label>
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                disabled={loadingStudents || !!preselectedStudentId}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition bg-white disabled:bg-slate-50"
              >
                <option value="">Select student</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>{s.student_id} - {s.full_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Course / Enrollment *</label>
              <select
                value={selectedEnrollmentId}
                onChange={(e) => setSelectedEnrollmentId(e.target.value)}
                disabled={!selectedStudentId || loadingEnrollments}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition bg-white disabled:bg-slate-50"
              >
                <option value="">Select enrollment</option>
                {enrollments.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.courses?.course_name ?? '—'}
                    {e.batch_name ? ` (${e.batch_name})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Fees Summary */}
        {selectedEnrollment && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-200 bg-slate-50">
              <h3 className="text-sm font-semibold text-slate-700">Fees Summary</h3>
            </div>
            <div className="p-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <div>
                <p className="text-xs text-slate-400">Default Fees</p>
                <p className="text-lg font-bold text-slate-900 tabular-nums">{formatINR(selectedEnrollment.default_fees_snapshot)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Discount</p>
                <p className="text-lg font-bold text-slate-900 tabular-nums">{selectedEnrollment.discount > 0 ? formatINR(selectedEnrollment.discount) : '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Final Fees</p>
                <p className="text-lg font-bold text-slate-900 tabular-nums">{formatINR(finalFees)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Total Paid</p>
                <p className="text-lg font-bold text-emerald-600 tabular-nums">{formatINR(totalPaid)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Remaining Balance</p>
                <p className="text-lg font-bold text-red-600 tabular-nums">{formatINR(balance)}</p>
              </div>
            </div>
            <div className="px-5 pb-4">
              <span className={cn('inline-flex px-2.5 py-1 rounded-full text-xs font-medium', FEE_STATUS_COLORS[feeStatus])}>
                {feeStatus}
              </span>
            </div>
          </div>
        )}

        {/* Payment Form */}
        {selectedEnrollment && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-700">Payment Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Payment Date *</label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Amount *</label>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0"
                    min="0"
                    step="0.01"
                    className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition tabular-nums"
                  />
                </div>
                {balance > 0 && (
                  <p className="text-xs text-slate-400 mt-1">Max: {formatINR(balance)}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Payment Mode</label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition bg-white"
                >
                  {PAYMENT_MODES.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Reference Number</label>
                <input
                  type="text"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder="Optional"
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Remarks</label>
                <input
                  type="text"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Optional"
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setAmount('');
                  setReferenceNumber('');
                  setRemarks('');
                  setPaymentMode('Cash');
                  setPaymentDate(todayStr());
                }}
                className="px-4 py-2.5 rounded-lg text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || balance <= 0}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 transition disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Collect Payment
              </button>
            </div>
            {balance <= 0 && (
              <p className="text-sm text-amber-600 text-right">This enrollment is fully paid. No further payments can be collected.</p>
            )}
          </div>
        )}

        {!selectedStudentId && !loadingStudents && (
          <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-slate-200">
            <div className="w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
              <Wallet className="h-7 w-7 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-700">Select a student to collect payment</p>
          </div>
        )}
      </div>

      {receiptData && <ReceiptModal data={receiptData} onClose={() => setReceiptData(null)} />}
    </>
  );
}

// ============================================================
// PAYMENT HISTORY
// ============================================================
function PaymentHistory() {
  const { toast } = useToast();
  const [records, setRecords] = useState<PaymentWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCourse, setFilterCourse] = useState('');
  const [filterBatch, setFilterBatch] = useState('');
  const [filterMode, setFilterMode] = useState('');
  const [filterStatus, setFilterStatus] = useState<'All' | 'Valid' | 'Voided'>('All');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [courses, setCourses] = useState<Course[]>([]);
  const [availableBatches, setAvailableBatches] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const [voidRecord, setVoidRecord] = useState<PaymentWithDetails | null>(null);
  const [voidLoading, setVoidLoading] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);

  useEffect(() => {
    supabase.from('courses').select('*').order('course_name').then(({ data }) => {
      setCourses((data ?? []) as Course[]);
    });
    supabase
      .from('enrollments')
      .select('batch_name')
      .not('batch_name', 'is', null)
      .then(({ data }) => {
        const batches = [...new Set((data ?? []).map((d) => d.batch_name).filter(Boolean))] as string[];
        setAvailableBatches(batches.sort());
      });
  }, []);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('fee_payments')
        .select(`
          *,
          enrollments:enrollment_id (
            id, batch_name, final_fees,
            students:student_id ( id, student_id, full_name ),
            courses:course_id ( id, course_name, course_code )
          )
        `)
        .order('payment_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (filterMode) query = query.eq('payment_mode', filterMode);
      if (filterStatus === 'Valid') query = query.eq('is_voided', false);
      if (filterStatus === 'Voided') query = query.eq('is_voided', true);
      if (fromDate) query = query.gte('payment_date', fromDate);
      if (toDate) query = query.lte('payment_date', toDate);

      const { data, error } = await query;
      if (error) throw error;

      let filtered = (data ?? []) as PaymentWithDetails[];

      if (filterCourse) {
        filtered = filtered.filter((r) => r.enrollments?.courses?.id === filterCourse);
      }
      if (filterBatch) {
        filtered = filtered.filter((r) => r.enrollments?.batch_name === filterBatch);
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        filtered = filtered.filter(
          (r) =>
            (r.enrollments?.students?.student_id ?? '').toLowerCase().includes(q) ||
            (r.enrollments?.students?.full_name ?? '').toLowerCase().includes(q) ||
            (r.receipt_number ?? '').toLowerCase().includes(q) ||
            (r.reference_number ?? '').toLowerCase().includes(q)
        );
      }

      setRecords(filtered);
      setPage(0);
    } catch {
      toast('Failed to load payment history', 'error');
    } finally {
      setLoading(false);
    }
  }, [filterMode, filterStatus, fromDate, toDate, filterCourse, filterBatch, search, toast]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const pagedRecords = records.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(records.length / pageSize);

  const handleVoid = async () => {
    if (!voidRecord) return;
    setVoidLoading(true);
    try {
      const { error } = await supabase
        .from('fee_payments')
        .update({ is_voided: true })
        .eq('id', voidRecord.id);
      if (error) throw error;
      toast('Payment voided successfully', 'success');
      setVoidRecord(null);
      fetchRecords();
    } catch {
      toast('Failed to void payment', 'error');
    } finally {
      setVoidLoading(false);
    }
  };

  const showReceipt = (r: PaymentWithDetails) => {
    const finalFees = Number(r.enrollments?.final_fees) || 0;
    // Compute cumulative paid from all non-voided payments for this enrollment
    const cumulativePaid = records
      .filter(p => p.enrollment_id === r.enrollment_id && !p.is_voided)
      .reduce((sum, p) => sum + Number(p.amount), 0);
    setReceiptData({
      receiptNumber: r.receipt_number ?? '—',
      paymentDate: r.payment_date,
      studentName: r.enrollments?.students?.full_name ?? '—',
      studentId: r.enrollments?.students?.student_id ?? '—',
      courseName: r.enrollments?.courses?.course_name ?? '—',
      batchName: r.enrollments?.batch_name ?? '',
      amount: Number(r.amount),
      paymentMode: r.payment_mode ?? '—',
      referenceNumber: r.reference_number,
      finalFees,
      totalPaidAfter: cumulativePaid,
      remainingBalance: Math.max(0, finalFees - cumulativePaid),
      remarks: r.remarks,
    });
  };

  return (
    <>
      <div className="space-y-4">
        {/* Filters */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search Student ID, Name, Receipt No, Reference No..."
                className="w-full pl-10 pr-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition"
              />
            </div>
            <select
              value={filterCourse}
              onChange={(e) => setFilterCourse(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition bg-white"
            >
              <option value="">All Courses</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.course_name}</option>
              ))}
            </select>
            <select
              value={filterBatch}
              onChange={(e) => setFilterBatch(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition bg-white"
            >
              <option value="">All Batches</option>
              {availableBatches.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
            <select
              value={filterMode}
              onChange={(e) => setFilterMode(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition bg-white"
            >
              <option value="">All Modes</option>
              {PAYMENT_MODES.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as 'All' | 'Valid' | 'Voided')}
              className="px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition bg-white"
            >
              <option value="All">All Status</option>
              <option value="Valid">Valid</option>
              <option value="Voided">Voided</option>
            </select>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-500 whitespace-nowrap">From:</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-500 whitespace-nowrap">To:</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition"
              />
            </div>
            {(search || filterCourse || filterBatch || filterMode || filterStatus !== 'All' || fromDate || toDate) && (
              <button
                onClick={() => { setSearch(''); setFilterCourse(''); setFilterBatch(''); setFilterMode(''); setFilterStatus('All'); setFromDate(''); setToDate(''); }}
                className="px-3 py-2 rounded-lg text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : pagedRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div className="w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
                <History className="h-7 w-7 text-slate-400" />
              </div>
              <p className="text-sm font-medium text-slate-700">No payment records found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Date</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Receipt No.</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Student</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600 hidden md:table-cell">Course</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600 hidden lg:table-cell">Batch</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Amount</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600 hidden sm:table-cell">Mode</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600 hidden xl:table-cell">Ref No.</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedRecords.map((r) => (
                    <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDateDMY(r.payment_date)}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">{r.receipt_number ?? '—'}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">{r.enrollments?.students?.full_name ?? '—'}</p>
                        <p className="text-xs text-slate-400">{r.enrollments?.students?.student_id ?? '—'}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600 hidden md:table-cell">{r.enrollments?.courses?.course_name ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-600 hidden lg:table-cell">{r.enrollments?.batch_name ?? '—'}</td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums text-slate-900">{formatINR(Number(r.amount))}</td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        {r.payment_mode && (
                          <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-medium', PAYMENT_MODE_COLORS[r.payment_mode] ?? 'bg-slate-100 text-slate-600')}>
                            {r.payment_mode}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500 hidden xl:table-cell">{r.reference_number || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          'inline-flex px-2 py-0.5 rounded-full text-xs font-medium',
                          r.is_voided ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
                        )}>
                          {r.is_voided ? 'Voided' : 'Valid'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => showReceipt(r)}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-sky-50 hover:text-sky-600 transition"
                            title="View Receipt"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {!r.is_voided && (
                            <button
                              onClick={() => setVoidRecord(r)}
                              className="p-1.5 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 transition"
                              title="Void Payment"
                            >
                              <Ban className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 transition disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm text-slate-500">Page {page + 1} of {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 transition disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}

        {records.length > 0 && (
          <p className="text-xs text-slate-400 text-center">
            Showing {pagedRecords.length} of {records.length} records
          </p>
        )}
      </div>

      <ConfirmDialog
        open={!!voidRecord}
        onClose={() => setVoidRecord(null)}
        onConfirm={handleVoid}
        title="Void Payment"
        message="Are you sure you want to void this payment? The payment record will be kept but excluded from totals."
        confirmLabel="Void Payment"
        loading={voidLoading}
        variant="danger"
        details={[
          { label: 'Student', value: voidRecord?.enrollments?.students?.full_name ?? '—' },
          { label: 'Course', value: voidRecord?.enrollments?.courses?.course_name ?? '—' },
          { label: 'Amount', value: formatINR(Number(voidRecord?.amount ?? 0)) },
          { label: 'Date', value: formatDateDMY(voidRecord?.payment_date) },
          { label: 'Receipt', value: voidRecord?.receipt_number ?? '—' },
        ]}
      />

      {receiptData && <ReceiptModal data={receiptData} onClose={() => setReceiptData(null)} />}
    </>
  );
}

// ============================================================
// STUDENT FEE DETAILS
// ============================================================
function StudentFeeDetails() {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [enrollments, setEnrollments] = useState<EnrollmentWithCourse[]>([]);
  const [paymentSums, setPaymentSums] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from('students').select('*').eq('status', 'Active').order('full_name').then(({ data }) => {
      setStudents((data ?? []) as Student[]);
    });
  }, []);

  const loadData = useCallback(async () => {
    if (!selectedStudentId) {
      setEnrollments([]);
      setPaymentSums({});
      return;
    }
    setLoading(true);
    try {
      const { data: enrollData } = await supabase
        .from('enrollments')
        .select(`
          *,
          courses:course_id ( id, course_name, course_code ),
          students:student_id ( id, student_id, full_name )
        `)
        .eq('student_id', selectedStudentId)
        .neq('status', 'Inactive')
        .order('created_at', { ascending: false });

      const enrollmentsData = (enrollData ?? []) as EnrollmentWithCourse[];
      setEnrollments(enrollmentsData);

      const enrollmentIds = enrollmentsData.map((e) => e.id);
      if (enrollmentIds.length > 0) {
        const { data: payments } = await supabase
          .from('fee_payments')
          .select('enrollment_id, amount')
          .eq('is_voided', false)
          .in('enrollment_id', enrollmentIds);
        const sums: Record<string, number> = {};
        (payments ?? []).forEach((p) => {
          sums[p.enrollment_id] = (sums[p.enrollment_id] ?? 0) + Number(p.amount);
        });
        setPaymentSums(sums);
      } else {
        setPaymentSums({});
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [selectedStudentId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const selectedStudent = students.find((s) => s.id === selectedStudentId);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Select Student</label>
        <select
          value={selectedStudentId}
          onChange={(e) => setSelectedStudentId(e.target.value)}
          className="w-full sm:max-w-md px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition bg-white"
        >
          <option value="">Select student</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>{s.student_id} - {s.full_name}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 bg-white rounded-xl border border-slate-200">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : !selectedStudentId ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-slate-200">
          <div className="w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
            <UserSearch className="h-7 w-7 text-slate-400" />
          </div>
          <p className="text-sm font-medium text-slate-700">Select a student to view fee details</p>
        </div>
      ) : enrollments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-slate-200">
          <div className="w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
            <Wallet className="h-7 w-7 text-slate-400" />
          </div>
          <p className="text-sm font-medium text-slate-700">No active enrollments for this student</p>
        </div>
      ) : (
        <>
          {selectedStudent && (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-sm font-medium text-slate-900">{selectedStudent.full_name}</p>
              <p className="text-xs text-slate-400">{selectedStudent.student_id}</p>
            </div>
          )}
          {enrollments.map((e) => {
            const paid = paymentSums[e.id] ?? 0;
            const balance = calcBalance(e.final_fees, paid);
            const status = calcFeeStatus(paid, balance);
            return (
              <div key={e.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-700">{e.courses?.course_name ?? '—'}</h3>
                    {e.batch_name && <p className="text-xs text-slate-400 mt-0.5">Batch: {e.batch_name}</p>}
                  </div>
                  <span className={cn('inline-flex px-2.5 py-1 rounded-full text-xs font-medium', FEE_STATUS_COLORS[status])}>
                    {status}
                  </span>
                </div>
                <div className="p-5 grid grid-cols-2 sm:grid-cols-5 gap-4">
                  <div>
                    <p className="text-xs text-slate-400">Default Fees</p>
                    <p className="text-lg font-bold text-slate-900 tabular-nums">{formatINR(e.default_fees_snapshot)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Discount</p>
                    <p className="text-lg font-bold text-slate-900 tabular-nums">{e.discount > 0 ? formatINR(e.discount) : '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Final Fees</p>
                    <p className="text-lg font-bold text-slate-900 tabular-nums">{formatINR(e.final_fees)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Total Paid</p>
                    <p className="text-lg font-bold text-emerald-600 tabular-nums">{formatINR(paid)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Balance</p>
                    <p className="text-lg font-bold text-red-600 tabular-nums">{formatINR(balance)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

// ============================================================
// PENDING FEES
// ============================================================
type SortKey = 'balance' | 'name' | 'course';

function PendingFees() {
  const [records, setRecords] = useState<EnrollmentWithCourse[]>([]);
  const [paymentSums, setPaymentSums] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCourse, setFilterCourse] = useState('');
  const [filterBatch, setFilterBatch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'All' | FeeStatus>('All');
  const [courses, setCourses] = useState<Course[]>([]);
  const [availableBatches, setAvailableBatches] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>('balance');

  useEffect(() => {
    supabase.from('courses').select('*').order('course_name').then(({ data }) => {
      setCourses((data ?? []) as Course[]);
    });
    supabase
      .from('enrollments')
      .select('batch_name')
      .not('batch_name', 'is', null)
      .then(({ data }) => {
        const batches = [...new Set((data ?? []).map((d) => d.batch_name).filter(Boolean))] as string[];
        setAvailableBatches(batches.sort());
      });
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: enrollData } = await supabase
        .from('enrollments')
        .select(`
          *,
          courses:course_id ( id, course_name, course_code ),
          students:student_id ( id, student_id, full_name )
        `)
        .neq('status', 'Inactive')
        .order('created_at', { ascending: false });

      const enrollmentsData = (enrollData ?? []) as EnrollmentWithCourse[];
      const enrollmentIds = enrollmentsData.map((e) => e.id);

      let sums: Record<string, number> = {};
      if (enrollmentIds.length > 0) {
        const { data: payments } = await supabase
          .from('fee_payments')
          .select('enrollment_id, amount')
          .eq('is_voided', false)
          .in('enrollment_id', enrollmentIds);
        (payments ?? []).forEach((p) => {
          sums[p.enrollment_id] = (sums[p.enrollment_id] ?? 0) + Number(p.amount);
        });
      }

      setPaymentSums(sums);
      setRecords(enrollmentsData);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredRecords = useMemo(() => {
    let result = records.map((e) => {
      const paid = paymentSums[e.id] ?? 0;
      const balance = calcBalance(e.final_fees, paid);
      return { enrollment: e, paid, balance, status: calcFeeStatus(paid, balance) };
    });

    // Only show enrollments with balance > 0
    result = result.filter((r) => r.balance > 0);

    if (filterCourse) {
      result = result.filter((r) => r.enrollment.courses?.id === filterCourse);
    }
    if (filterBatch) {
      result = result.filter((r) => r.enrollment.batch_name === filterBatch);
    }
    if (filterStatus !== 'All') {
      result = result.filter((r) => r.status === filterStatus);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          (r.enrollment.students?.student_id ?? '').toLowerCase().includes(q) ||
          (r.enrollment.students?.full_name ?? '').toLowerCase().includes(q)
      );
    }

    // Sort
    result.sort((a, b) => {
      if (sortKey === 'balance') return b.balance - a.balance;
      if (sortKey === 'name') return (a.enrollment.students?.full_name ?? '').localeCompare(b.enrollment.students?.full_name ?? '');
      if (sortKey === 'course') return (a.enrollment.courses?.course_name ?? '').localeCompare(b.enrollment.courses?.course_name ?? '');
      return 0;
    });

    return result;
  }, [records, paymentSums, filterCourse, filterBatch, filterStatus, search, sortKey]);

  const totalPending = filteredRecords.reduce((sum, r) => sum + r.balance, 0);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center text-red-600">
              <AlertCircle className="h-4 w-4" />
            </div>
            <p className="text-sm font-medium text-slate-600">Total Pending Amount</p>
          </div>
          <p className="text-2xl font-bold text-red-700 tabular-nums">{formatINR(totalPending)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600">
              <Users className="h-4 w-4" />
            </div>
            <p className="text-sm font-medium text-slate-600">Enrollments with Pending Fees</p>
          </div>
          <p className="text-2xl font-bold text-slate-900 tabular-nums">{filteredRecords.length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Student ID or Name..."
              className="w-full pl-10 pr-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition"
            />
          </div>
          <select
            value={filterCourse}
            onChange={(e) => setFilterCourse(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition bg-white"
          >
            <option value="">All Courses</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.course_name}</option>
            ))}
          </select>
          <select
            value={filterBatch}
            onChange={(e) => setFilterBatch(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition bg-white"
          >
            <option value="">All Batches</option>
            {availableBatches.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as 'All' | FeeStatus)}
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition bg-white"
          >
            <option value="All">All Status</option>
            <option value="Unpaid">Unpaid</option>
            <option value="Partial Payment">Partial Payment</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <ArrowUpDown className="h-4 w-4 text-slate-400" />
          <span className="text-sm text-slate-500">Sort by:</span>
          <button
            onClick={() => setSortKey('balance')}
            className={cn('px-2.5 py-1 rounded-lg text-xs font-medium transition', sortKey === 'balance' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}
          >
            Highest Balance
          </button>
          <button
            onClick={() => setSortKey('name')}
            className={cn('px-2.5 py-1 rounded-lg text-xs font-medium transition', sortKey === 'name' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}
          >
            Student Name
          </button>
          <button
            onClick={() => setSortKey('course')}
            className={cn('px-2.5 py-1 rounded-lg text-xs font-medium transition', sortKey === 'course' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}
          >
            Course
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="w-14 h-14 rounded-xl bg-emerald-50 flex items-center justify-center mb-3">
              <CheckCircle className="h-7 w-7 text-emerald-500" />
            </div>
            <p className="text-sm font-medium text-slate-700">No pending fees. All enrollments are fully paid.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Student ID</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600 hidden md:table-cell">Course</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600 hidden lg:table-cell">Batch</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Final Fees</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Paid</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Balance</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((r) => (
                  <tr key={r.enrollment.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                    <td className="px-4 py-3 font-medium text-slate-900">{r.enrollment.students?.student_id ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-700">{r.enrollment.students?.full_name ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600 hidden md:table-cell">{r.enrollment.courses?.course_name ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600 hidden lg:table-cell">{r.enrollment.batch_name ?? '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-900">{formatINR(r.enrollment.final_fees)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-emerald-600">{formatINR(r.paid)}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium text-red-600">{formatINR(r.balance)}</td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-medium', FEE_STATUS_COLORS[r.status])}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// FEE REPORTS
// ============================================================
type ReportType = 'daily' | 'range' | 'course' | 'pending';

function FeeReports() {
  const [reportType, setReportType] = useState<ReportType>('daily');

  const reportTabs = [
    { id: 'daily' as ReportType, label: 'Daily Collection', icon: CalendarRange },
    { id: 'range' as ReportType, label: 'Date Range', icon: CalendarRange },
    { id: 'course' as ReportType, label: 'Course-wise', icon: BookOpen },
    { id: 'pending' as ReportType, label: 'Pending Summary', icon: AlertCircle },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {reportTabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setReportType(t.id)}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition',
              reportType === t.id
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            )}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {reportType === 'daily' && <DailyCollectionReport />}
      {reportType === 'range' && <DateRangeReport />}
      {reportType === 'course' && <CourseWiseReport />}
      {reportType === 'pending' && <PendingSummaryReport />}
    </div>
  );
}

function DailyCollectionReport() {
  const [date, setDate] = useState(todayStr());
  const [data, setData] = useState<{
    total: number;
    count: number;
    byMode: Record<string, number>;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = useCallback(async () => {
    if (!date) return;
    setLoading(true);
    try {
      const { data: payments } = await supabase
        .from('fee_payments')
        .select('amount, payment_mode')
        .eq('payment_date', date)
        .eq('is_voided', false);

      const pmtList = payments ?? [];
      const total = pmtList.reduce((sum, p) => sum + Number(p.amount), 0);
      const byMode: Record<string, number> = {};
      pmtList.forEach((p) => {
        const mode = p.payment_mode ?? 'Other';
        byMode[mode] = (byMode[mode] ?? 0) + Number(p.amount);
      });

      setData({ total, count: pmtList.length, byMode });
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Select Date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full sm:max-w-xs px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 bg-white rounded-xl border border-slate-200">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : !data || data.count === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-slate-200">
          <div className="w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
            <CalendarRange className="h-7 w-7 text-slate-400" />
          </div>
          <p className="text-sm font-medium text-slate-700">No payments collected on {formatDateDMY(date)}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-900 rounded-xl p-5 text-white">
              <p className="text-xs text-slate-300">Total Collection</p>
              <p className="text-3xl font-bold tabular-nums">{formatINR(data.total)}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <p className="text-xs text-slate-400">Number of Payments</p>
              <p className="text-3xl font-bold text-slate-900 tabular-nums">{data.count}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-200 bg-slate-50">
              <h3 className="text-sm font-semibold text-slate-700">Payment Mode Breakdown</h3>
            </div>
            <div className="p-5 space-y-3">
              {PAYMENT_MODES.map((mode) => (
                <div key={mode} className="flex items-center justify-between">
                  <span className={cn('inline-flex px-2.5 py-1 rounded-full text-xs font-medium', PAYMENT_MODE_COLORS[mode])}>
                    {mode}
                  </span>
                  <span className="text-lg font-bold text-slate-900 tabular-nums">
                    {formatINR(data.byMode[mode] ?? 0)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function DateRangeReport() {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState(todayStr());
  const [data, setData] = useState<{
    total: number;
    count: number;
    byMode: Record<string, number>;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = useCallback(async () => {
    if (!fromDate || !toDate) return;
    setLoading(true);
    try {
      let query = supabase
        .from('fee_payments')
        .select('amount, payment_mode')
        .eq('is_voided', false)
        .gte('payment_date', fromDate)
        .lte('payment_date', toDate);

      const { data: payments } = await query;
      const pmtList = payments ?? [];
      const total = pmtList.reduce((sum, p) => sum + Number(p.amount), 0);
      const byMode: Record<string, number> = {};
      pmtList.forEach((p) => {
        const mode = p.payment_mode ?? 'Other';
        byMode[mode] = (byMode[mode] ?? 0) + Number(p.amount);
      });
      setData({ total, count: pmtList.length, byMode });
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    if (fromDate && toDate) fetchReport();
  }, [fetchReport]);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col sm:flex-row gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">From Date</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-full sm:max-w-xs px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">To Date</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-full sm:max-w-xs px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 bg-white rounded-xl border border-slate-200">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : !data || data.count === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-slate-200">
          <div className="w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
            <CalendarRange className="h-7 w-7 text-slate-400" />
          </div>
          <p className="text-sm font-medium text-slate-700">No payments in this date range</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-900 rounded-xl p-5 text-white">
              <p className="text-xs text-slate-300">Total Collection</p>
              <p className="text-3xl font-bold tabular-nums">{formatINR(data.total)}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <p className="text-xs text-slate-400">Number of Payments</p>
              <p className="text-3xl font-bold text-slate-900 tabular-nums">{data.count}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-200 bg-slate-50">
              <h3 className="text-sm font-semibold text-slate-700">Payment Mode Breakdown</h3>
            </div>
            <div className="p-5 space-y-3">
              {PAYMENT_MODES.map((mode) => (
                <div key={mode} className="flex items-center justify-between">
                  <span className={cn('inline-flex px-2.5 py-1 rounded-full text-xs font-medium', PAYMENT_MODE_COLORS[mode])}>
                    {mode}
                  </span>
                  <span className="text-lg font-bold text-slate-900 tabular-nums">
                    {formatINR(data.byMode[mode] ?? 0)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function CourseWiseReport() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState(todayStr());
  const [data, setData] = useState<{ finalFees: number; paid: number; pending: number } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from('courses').select('*').order('course_name').then(({ data }) => {
      setCourses((data ?? []) as Course[]);
    });
  }, []);

  const fetchReport = useCallback(async () => {
    if (!selectedCourseId) return;
    setLoading(true);
    try {
      let enrollQuery = supabase
        .from('enrollments')
        .select('id, final_fees')
        .eq('course_id', selectedCourseId)
        .neq('status', 'Inactive');

      const { data: enrollments } = await enrollQuery;
      const enrollList = enrollments ?? [];
      const enrollmentIds = enrollList.map((e) => e.id);
      const finalFees = enrollList.reduce((sum, e) => sum + Number(e.final_fees), 0);

      if (enrollmentIds.length === 0) {
        setData({ finalFees: 0, paid: 0, pending: 0 });
        return;
      }

      let payQuery = supabase
        .from('fee_payments')
        .select('amount')
        .eq('is_voided', false)
        .in('enrollment_id', enrollmentIds);

      if (fromDate) payQuery = payQuery.gte('payment_date', fromDate);
      if (toDate) payQuery = payQuery.lte('payment_date', toDate);

      const { data: payments } = await payQuery;
      const paid = (payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
      setData({ finalFees, paid, pending: Math.max(0, finalFees - paid) });
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [selectedCourseId, fromDate, toDate]);

  useEffect(() => {
    if (selectedCourseId) fetchReport();
  }, [fetchReport]);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Course</label>
          <select
            value={selectedCourseId}
            onChange={(e) => setSelectedCourseId(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition bg-white"
          >
            <option value="">Select course</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.course_name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">From Date</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">To Date</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 bg-white rounded-xl border border-slate-200">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : !selectedCourseId ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-slate-200">
          <div className="w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
            <BookOpen className="h-7 w-7 text-slate-400" />
          </div>
          <p className="text-sm font-medium text-slate-700">Select a course to view the report</p>
        </div>
      ) : data ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-xs text-slate-400">Total Final Fees</p>
            <p className="text-2xl font-bold text-slate-900 tabular-nums">{formatINR(data.finalFees)}</p>
          </div>
          <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-5">
            <p className="text-xs text-emerald-600">Total Paid</p>
            <p className="text-2xl font-bold text-emerald-700 tabular-nums">{formatINR(data.paid)}</p>
          </div>
          <div className="bg-red-50 rounded-xl border border-red-200 p-5">
            <p className="text-xs text-red-600">Total Pending</p>
            <p className="text-2xl font-bold text-red-700 tabular-nums">{formatINR(data.pending)}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PendingSummaryReport() {
  const [data, setData] = useState<{ totalPending: number; count: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPending() {
      setLoading(true);
      try {
        const { data: enrollments } = await supabase
          .from('enrollments')
          .select('id, final_fees')
          .neq('status', 'Inactive');

        const enrollList = enrollments ?? [];
        const enrollmentIds = enrollList.map((e) => e.id);

        if (enrollmentIds.length === 0) {
          setData({ totalPending: 0, count: 0 });
          return;
        }

        const { data: payments } = await supabase
          .from('fee_payments')
          .select('enrollment_id, amount')
          .eq('is_voided', false)
          .in('enrollment_id', enrollmentIds);

        const paidByEnrollment: Record<string, number> = {};
        (payments ?? []).forEach((p) => {
          paidByEnrollment[p.enrollment_id] = (paidByEnrollment[p.enrollment_id] ?? 0) + Number(p.amount);
        });

        let totalPending = 0;
        let count = 0;
        for (const e of enrollList) {
          const paid = paidByEnrollment[e.id] ?? 0;
          const balance = Math.max(0, Number(e.final_fees) - paid);
          if (balance > 0) {
            totalPending += balance;
            count++;
          }
        }

        setData({ totalPending, count });
      } catch {
        setData(null);
      } finally {
        setLoading(false);
      }
    }
    fetchPending();
  }, []);

  return (
    <div className="space-y-4">
      {loading ? (
        <div className="flex items-center justify-center py-16 bg-white rounded-xl border border-slate-200">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : data ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-red-50 rounded-xl border border-red-200 p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center text-red-600">
                <IndianRupee className="h-4 w-4" />
              </div>
              <p className="text-sm font-medium text-red-600">Total Pending Amount</p>
            </div>
            <p className="text-3xl font-bold text-red-700 tabular-nums">{formatINR(data.totalPending)}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600">
                <AlertCircle className="h-4 w-4" />
              </div>
              <p className="text-sm font-medium text-slate-600">Enrollments with Pending Fees</p>
            </div>
            <p className="text-3xl font-bold text-slate-900 tabular-nums">{data.count}</p>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center py-16 bg-white rounded-xl border border-slate-200">
          <p className="text-sm text-slate-500">Failed to load pending fees summary.</p>
        </div>
      )}
    </div>
  );
}
