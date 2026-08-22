import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Loader2,
  GraduationCap,
  AlertCircle,
  Eye,
  Trash2,
  Ban,
  Download,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/utils/cn';
import type { Enrollment, Student, Course, EnrollmentStatus } from '@/types/database';
import EnrollmentFormModal from '@/components/EnrollmentFormModal';
import ConfirmDialog from '@/components/ConfirmDialog';
import { checkEnrollmentRelated } from '@/services/relatedRecords';
import * as XLSX from 'xlsx';

type StatusFilter = 'All' | 'Active' | 'Exam Pending' | 'Completed' | 'Inactive';

interface EnrollmentWithDetails extends Enrollment {
  students: Pick<Student, 'id' | 'student_id' | 'full_name'> | null;
  courses: Pick<Course, 'id' | 'course_name' | 'course_code'> | null;
  paid_amount: number;
}

function formatINR(n: number): string {
  return `₹${n.toLocaleString('en-IN')}`;
}

const STATUS_COLORS: Record<EnrollmentStatus, string> = {
  Active: 'bg-emerald-50 text-emerald-700',
  'Exam Pending': 'bg-amber-50 text-amber-700',
  Completed: 'bg-sky-50 text-sky-700',
  Inactive: 'bg-slate-100 text-slate-500',
};

type ConfirmState =
  | { type: 'delete'; enrollment: EnrollmentWithDetails }
  | { type: 'inactive'; enrollment: EnrollmentWithDetails }
  | null;

export default function Enrollments() {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [enrollments, setEnrollments] = useState<EnrollmentWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [formOpen, setFormOpen] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [deleteChecking, setDeleteChecking] = useState(false);
  const [exporting, setExporting] = useState(false);

  const fetchEnrollments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('enrollments')
        .select(`
          *,
          students:student_id ( id, student_id, full_name ),
          courses:course_id ( id, course_name, course_code )
        `)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'All') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      const enrollmentsData = (data ?? []) as Enrollment[];

      const enrollmentIds = enrollmentsData.map((e) => e.id);
      let paymentSums: Record<string, number> = {};
      if (enrollmentIds.length > 0) {
        const { data: payments } = await supabase
          .from('fee_payments')
          .select('enrollment_id, amount')
          .eq('is_voided', false)
          .in('enrollment_id', enrollmentIds);
        if (payments) {
          paymentSums = payments.reduce((acc, p) => {
            acc[p.enrollment_id] = (acc[p.enrollment_id] ?? 0) + p.amount;
            return acc;
          }, {} as Record<string, number>);
        }
      }

      const withDetails = enrollmentsData.map((e) => ({
        ...e,
        paid_amount: paymentSums[e.id] ?? 0,
      })) as EnrollmentWithDetails[];

      setEnrollments(withDetails);
    } catch {
      setError('Failed to load enrollments. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchEnrollments();
  }, [fetchEnrollments]);

  const filtered = enrollments.filter((e) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (e.students?.student_id ?? '').toLowerCase().includes(q) ||
      (e.students?.full_name ?? '').toLowerCase().includes(q) ||
      (e.courses?.course_name ?? '').toLowerCase().includes(q) ||
      (e.courses?.course_code ?? '').toLowerCase().includes(q) ||
      (e.batch_name ?? '').toLowerCase().includes(q)
    );
  });

  const statusFilters: StatusFilter[] = ['All', 'Active', 'Exam Pending', 'Completed', 'Inactive'];

  const handleExport = async () => {
    setExporting(true);
    try {
      // Fetch ALL enrollments with student/course data (no filter)
      const { data, error } = await supabase
        .from('enrollments')
        .select(`
          *,
          students:student_id ( id, student_id, full_name ),
          courses:course_id ( id, course_name, course_code )
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const allEnrollments = (data ?? []) as Enrollment[];

      // Compute paid amounts
      const enrollmentIds = allEnrollments.map((e) => e.id);
      let paymentSums: Record<string, number> = {};
      if (enrollmentIds.length > 0) {
        const { data: payments } = await supabase
          .from('fee_payments')
          .select('enrollment_id, amount')
          .eq('is_voided', false)
          .in('enrollment_id', enrollmentIds);
        if (payments) {
          paymentSums = payments.reduce((acc, p) => {
            acc[p.enrollment_id] = (acc[p.enrollment_id] ?? 0) + p.amount;
            return acc;
          }, {} as Record<string, number>);
        }
      }

      const headers = [
        'Student ID', 'Student Name', 'Course', 'Course Code',
        'Batch', 'Joining Date', 'Default Fees', 'Discount',
        'Final Fees', 'Paid Amount', 'Balance', 'Status',
      ];

      const rows = allEnrollments.map((e) => {
        const paid = paymentSums[e.id] ?? 0;
        const balance = Number(e.final_fees) - paid;
        const student = (e as unknown as EnrollmentWithDetails).students;
        const course = (e as unknown as EnrollmentWithDetails).courses;
        return [
          student?.student_id ?? '',
          student?.full_name ?? '',
          course?.course_name ?? '',
          course?.course_code ?? '',
          e.batch_name ?? '',
          e.joining_date ?? '',
          Number(e.default_fees_snapshot),
          Number(e.discount),
          Number(e.final_fees),
          paid,
          balance,
          e.status,
        ];
      });

      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      ws['!cols'] = [
        { wch: 12 }, { wch: 25 }, { wch: 25 }, { wch: 12 },
        { wch: 15 }, { wch: 14 }, { wch: 14 }, { wch: 12 },
        { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Enrollments');
      const today = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `enrollments_export_${today}.xlsx`);

      toast('Enrollment data exported successfully', 'success');
    } catch {
      toast('Failed to export enrollment data', 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleConfirm = async () => {
    if (!confirmState) return;
    setConfirmLoading(true);
    try {
      if (confirmState.type === 'delete') {
        const { error } = await supabase
          .from('enrollments')
          .delete()
          .eq('id', confirmState.enrollment.id);
        if (error) throw error;
        toast('Enrollment permanently deleted', 'success');
      } else if (confirmState.type === 'inactive') {
        const { error } = await supabase
          .from('enrollments')
          .update({ status: 'Inactive' })
          .eq('id', confirmState.enrollment.id);
        if (error) throw error;
        toast('Enrollment marked as inactive. Historical data is preserved.', 'success');
      }
      setConfirmState(null);
      fetchEnrollments();
    } catch {
      toast('Operation failed. Please try again.', 'error');
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleDeleteClick = async (enrollment: EnrollmentWithDetails) => {
    setDeleteChecking(true);
    const result = await checkEnrollmentRelated(enrollment.id);
    setDeleteChecking(false);
    if (result.hasRelated) {
      toast('This enrollment has historical records (attendance, payments, exams, or certificates) and cannot be permanently deleted. You can mark it inactive instead.', 'error');
      return;
    }
    setConfirmState({ type: 'delete', enrollment });
  };

  const confirmConfig = (() => {
    if (!confirmState) return null;
    const e = confirmState.enrollment;
    const studentLabel = e.students ? `${e.students.student_id} - ${e.students.full_name}` : '—';
    const courseLabel = e.courses?.course_name ?? '—';
    if (confirmState.type === 'delete') {
      return {
        title: 'Delete Enrollment',
        message: 'This action permanently deletes this enrollment and cannot be undone.',
        confirmLabel: 'Delete Permanently',
        variant: 'danger' as const,
        details: [
          { label: 'Student', value: studentLabel },
          { label: 'Course', value: courseLabel },
          { label: 'Batch', value: e.batch_name ?? '—' },
        ],
      };
    }
    return {
      title: 'Mark Enrollment Inactive',
      message: 'The enrollment will be marked as inactive. All historical data including attendance, payments, exams, and certificates will be preserved.',
      confirmLabel: 'Mark Inactive',
      variant: 'warning' as const,
      details: [
        { label: 'Student', value: studentLabel },
        { label: 'Course', value: courseLabel },
        { label: 'Batch', value: e.batch_name ?? '—' },
      ],
    };
  })();

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Enrollments</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage student course enrollments and fees</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition disabled:opacity-60"
          >
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Export Excel
          </button>
          <button
            onClick={() => setFormOpen(true)}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 transition"
          >
            <Plus className="h-4 w-4" />
            New Enrollment
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by student, course, or batch..."
            className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {statusFilters.map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={cn(
                'px-3 py-2.5 rounded-lg text-sm font-medium transition whitespace-nowrap',
                statusFilter === f
                  ? 'bg-slate-900 text-white'
                  : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50'
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
              <GraduationCap className="h-7 w-7 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-700">No enrollments found</p>
            <p className="text-xs text-slate-400 mt-1">
              {search || statusFilter !== 'All'
                ? 'Try adjusting your search or filters'
                : 'Click "New Enrollment" to enroll a student in a course'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Student</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Course</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600 hidden md:table-cell">Batch</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600 hidden lg:table-cell">Joining Date</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600 hidden sm:table-cell">Default Fees</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600 hidden sm:table-cell">Discount</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Final Fees</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600 hidden md:table-cell">Paid</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600 hidden md:table-cell">Balance</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => {
                  const balance = e.final_fees - e.paid_amount;
                  return (
                    <tr key={e.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                      <td className="px-4 py-3">
                        {e.students ? (
                          <button
                            onClick={() => navigate(`/students/${e.students!.id}`)}
                            className="font-medium text-slate-900 hover:text-sky-600 transition text-left"
                          >
                            {e.students.student_id} - {e.students.full_name}
                          </button>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {e.courses?.course_name ?? '—'}
                        {e.courses?.course_code && (
                          <span className="text-xs text-slate-400 ml-1">({e.courses.course_code})</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600 hidden md:table-cell">{e.batch_name || '—'}</td>
                      <td className="px-4 py-3 text-slate-600 hidden lg:table-cell">{e.joining_date || '—'}</td>
                      <td className="px-4 py-3 text-slate-600 text-right hidden sm:table-cell tabular-nums">
                        {formatINR(e.default_fees_snapshot)}
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-right hidden sm:table-cell tabular-nums">
                        {e.discount > 0 ? formatINR(e.discount) : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-900 font-medium text-right tabular-nums">
                        {formatINR(e.final_fees)}
                      </td>
                      <td className="px-4 py-3 text-emerald-600 text-right hidden md:table-cell tabular-nums">
                        {formatINR(e.paid_amount)}
                      </td>
                      <td className={cn('px-4 py-3 text-right hidden md:table-cell tabular-nums font-medium', balance > 0 ? 'text-red-600' : 'text-emerald-600')}>
                        {formatINR(balance)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-medium', STATUS_COLORS[e.status])}>
                          {e.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {e.students && (
                            <button
                              onClick={() => navigate(`/students/${e.students!.id}`)}
                              className="p-1.5 rounded-lg text-slate-500 hover:bg-sky-50 hover:text-sky-600 transition"
                              title="View Student"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteClick(e)}
                            disabled={deleteChecking}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 transition disabled:opacity-50"
                            title="Delete"
                          >
                            {deleteChecking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          </button>
                          {e.status !== 'Inactive' && (
                            <button
                              onClick={() => setConfirmState({ type: 'inactive', enrollment: e })}
                              className="p-1.5 rounded-lg text-slate-500 hover:bg-orange-50 hover:text-orange-600 transition"
                              title="Mark Inactive"
                            >
                              <Ban className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {filtered.length > 0 && (
        <p className="text-xs text-slate-400 text-center">
          Showing {filtered.length} enrollment{filtered.length !== 1 ? 's' : ''}
        </p>
      )}

      <EnrollmentFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          fetchEnrollments();
          toast('Enrollment list updated', 'info');
        }}
      />

      <ConfirmDialog
        open={!!confirmState}
        onClose={() => setConfirmState(null)}
        onConfirm={handleConfirm}
        title={confirmConfig?.title ?? ''}
        message={confirmConfig?.message ?? ''}
        confirmLabel={confirmConfig?.confirmLabel}
        variant={confirmConfig?.variant}
        details={confirmConfig?.details}
        loading={confirmLoading}
      />
    </div>
  );
}
