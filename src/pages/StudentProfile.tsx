import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Loader2,
  AlertCircle,
  User,
  Phone,
  Mail,
  Calendar,
  MapPin,
  Hash,
  GraduationCap,
  Pencil,
  Trash2,
  Ban,
  CalendarCheck,
  Award,
  Eye,
  Users,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/utils/cn';
import type { Student, Course, Enrollment, EnrollmentStatus, Certificate, CertificateStatus } from '@/types/database';
import StudentFormModal from '@/components/StudentFormModal';
import EnrollmentFormModal from '@/components/EnrollmentFormModal';
import ConfirmDialog from '@/components/ConfirmDialog';
import { checkEnrollmentRelated } from '@/services/relatedRecords';
import { calcAttendancePercent, formatDateDMY } from '@/utils/date';

interface EnrollmentWithCourse extends Enrollment {
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
  | { type: 'delete'; enrollment: EnrollmentWithCourse }
  | { type: 'inactive'; enrollment: EnrollmentWithCourse }
  | null;

export default function StudentProfile() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [student, setStudent] = useState<Student | null>(null);
  const [enrollments, setEnrollments] = useState<EnrollmentWithCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [deleteChecking, setDeleteChecking] = useState(false);
  const [attendanceSummary, setAttendanceSummary] = useState<{ total: number; present: number; absent: number; percent: number } | null>(null);
  const [certificates, setCertificates] = useState<(Certificate & { courses: { course_name: string } | null })[]>([]);

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const { data: studentData, error: studentErr } = await supabase
        .from('students')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (studentErr) throw studentErr;
      if (!studentData) {
        setError('Student not found.');
        setLoading(false);
        return;
      }
      setStudent(studentData as Student);

      const { data: enrollData, error: enrollErr } = await supabase
        .from('enrollments')
        .select(`
          *,
          courses:course_id ( id, course_name, course_code )
        `)
        .eq('student_id', id)
        .order('created_at', { ascending: false });

      if (enrollErr) throw enrollErr;

      const enrollmentsData = (enrollData ?? []) as Enrollment[];

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

      // Fetch certificates for this student's enrollments
      let certsData: (Certificate & { courses: { course_name: string } | null })[] = [];
      if (enrollmentIds.length > 0) {
        const { data: certsRaw } = await supabase
          .from('certificates')
          .select(`*, enrollments!inner ( courses:course_id ( course_name ) )`)
          .in('enrollment_id', enrollmentIds)
          .order('created_at', { ascending: false });
        if (certsRaw) {
          certsData = (certsRaw as any[]).map((c) => ({
            ...c,
            courses: c.enrollments?.courses ?? null,
          }));
        }
      }
      setCertificates(certsData);

      // Fetch student-wise attendance summary
      let attendanceSummary: { total: number; present: number; absent: number; percent: number } | null = null;
      if (id) {
        const { data: attendance } = await supabase
          .from('attendance')
          .select('status')
          .eq('student_id', id);
        if (attendance && attendance.length > 0) {
          let present = 0, absent = 0;
          attendance.forEach((a) => {
            if (a.status === 'Present') present++;
            else absent++;
          });
          const total = present + absent;
          attendanceSummary = {
            total,
            present,
            absent,
            percent: calcAttendancePercent(present, total),
          };
        }
      }

      const withCourses = enrollmentsData.map((e) => ({
        ...e,
        paid_amount: paymentSums[e.id] ?? 0,
      })) as EnrollmentWithCourse[];

      setAttendanceSummary(attendanceSummary);

      setEnrollments(withCourses);
    } catch {
      setError('Failed to load student profile. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
      fetchData();
    } catch {
      toast('Operation failed. Please try again.', 'error');
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleEnrollmentDeleteClick = async (enrollment: EnrollmentWithCourse) => {
    setDeleteChecking(true);
    const result = await checkEnrollmentRelated(enrollment.id);
    setDeleteChecking(false);
    if (result.hasRelated) {
      toast('This enrollment has historical records and cannot be permanently deleted. You can mark it inactive instead.', 'error');
      return;
    }
    setConfirmState({ type: 'delete', enrollment });
  };

  const confirmConfig = (() => {
    if (!confirmState) return null;
    const e = confirmState.enrollment;
    const courseLabel = e.courses?.course_name ?? '—';
    if (confirmState.type === 'delete') {
      return {
        title: 'Delete Enrollment',
        message: 'This action permanently deletes this enrollment and cannot be undone.',
        confirmLabel: 'Delete Permanently',
        variant: 'danger' as const,
        details: [
          { label: 'Course', value: courseLabel },
          { label: 'Batch', value: e.batch_name ?? '—' },
        ],
      };
    }
    return {
      title: 'Mark Enrollment Inactive',
      message: 'The enrollment will be marked as inactive. All historical data will be preserved.',
      confirmLabel: 'Mark Inactive',
      variant: 'warning' as const,
      details: [
        { label: 'Course', value: courseLabel },
        { label: 'Batch', value: e.batch_name ?? '—' },
      ],
    };
  })();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error || !student) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => navigate('/students')}
          className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Students
        </button>
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <p className="text-sm font-medium">{error || 'Student not found.'}</p>
        </div>
      </div>
    );
  }

  const infoRows = [
    { label: 'Student ID', value: student.student_id, icon: Hash },
    { label: 'Full Name', value: student.full_name, icon: User },
    { label: 'Mobile Number', value: student.mobile_number, icon: Phone },
    { label: 'Email', value: student.email, icon: Mail },
    { label: 'Date of Birth', value: student.date_of_birth, icon: Calendar },
    { label: 'Gender', value: student.gender, icon: User },
    { label: 'Admission Date', value: student.admission_date, icon: Calendar },
    { label: 'Status', value: student.status, icon: User },
    { label: 'Address', value: student.address, icon: MapPin },
    { label: 'Parent/Guardian Name', value: student.parent_name, icon: Users },
    { label: 'Parent/Guardian Mobile', value: student.parent_mobile, icon: Phone },
    { label: 'Relationship', value: student.parent_relationship, icon: Users },
  ];

  const totalFinalFees = enrollments.reduce((sum, e) => sum + e.final_fees, 0);
  const totalPaid = enrollments.reduce((sum, e) => sum + e.paid_amount, 0);
  const totalBalance = totalFinalFees - totalPaid;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => navigate('/students')}
          className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Students
        </button>
        <button
          onClick={() => setEditOpen(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition"
        >
          <Pencil className="h-4 w-4" />
          Edit Student
        </button>
      </div>

      {/* Student Information Card */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-900 text-white flex items-center justify-center font-semibold">
              {student.full_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">{student.full_name}</h1>
              <p className="text-sm text-slate-500">{student.student_id}</p>
            </div>
            <span
              className={cn(
                'ml-auto inline-flex px-2.5 py-1 rounded-full text-xs font-medium',
                student.status === 'Active'
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-slate-100 text-slate-500'
              )}
            >
              {student.status}
            </span>
          </div>
        </div>

        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {infoRows.map((row) => (
            <div key={row.label} className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 flex-shrink-0">
                <row.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-slate-400">{row.label}</p>
                <p className="text-sm font-medium text-slate-800 break-words">{row.value || '—'}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Enrolled Courses Section */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-700">Enrolled Courses</h2>
            <span className="text-xs text-slate-400">({enrollments.length})</span>
          </div>
          <button
            onClick={() => setEnrollOpen(true)}
            disabled={student.status !== 'Active'}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
            title={student.status !== 'Active' ? 'Only active students can be enrolled' : 'Enroll in a course'}
          >
            <Plus className="h-4 w-4" />
            Enroll in Course
          </button>
        </div>

        {enrollments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
              <GraduationCap className="h-6 w-6 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-700">No enrollments yet</p>
            <p className="text-xs text-slate-400 mt-1">
              {student.status === 'Active'
                ? 'Click "Enroll in Course" to add a course for this student'
                : 'Activate this student to enroll them in courses'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Course</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600 hidden md:table-cell">Batch</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600 hidden lg:table-cell">Joining Date</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600 hidden sm:table-cell">Default Fees</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600 hidden sm:table-cell">Discount</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Final Fees</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Paid</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Balance</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {enrollments.map((e) => {
                    const balance = e.final_fees - e.paid_amount;
                    return (
                      <tr key={e.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                        <td className="px-4 py-3 text-slate-900 font-medium">
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
                        <td className="px-4 py-3 text-emerald-600 text-right tabular-nums">
                          {formatINR(e.paid_amount)}
                        </td>
                        <td className={cn('px-4 py-3 text-right tabular-nums font-medium', balance > 0 ? 'text-red-600' : 'text-emerald-600')}>
                          {formatINR(balance)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-medium', STATUS_COLORS[e.status])}>
                            {e.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleEnrollmentDeleteClick(e)}
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
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-700" colSpan={5}>Total</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900 tabular-nums">{formatINR(totalFinalFees)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-600 tabular-nums">{formatINR(totalPaid)}</td>
                    <td className={cn('px-4 py-3 text-right font-semibold tabular-nums', totalBalance > 0 ? 'text-red-600' : 'text-emerald-600')}>
                      {formatINR(totalBalance)}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Attendance Summary Section */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-700">Attendance Summary</h2>
          </div>
        </div>
        {attendanceSummary ? (
          <div className="p-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-xs text-slate-400 mb-1">Total Days</p>
              <p className="text-2xl font-bold text-slate-900 tabular-nums">{attendanceSummary.total}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-emerald-600 mb-1">Present</p>
              <p className="text-2xl font-bold text-emerald-700 tabular-nums">{attendanceSummary.present}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-red-600 mb-1">Absent</p>
              <p className="text-2xl font-bold text-red-700 tabular-nums">{attendanceSummary.absent}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-400 mb-1">Attendance %</p>
              <p className={cn('text-2xl font-bold tabular-nums', attendanceSummary.percent >= 75 ? 'text-emerald-600' : 'text-amber-600')}>
                {attendanceSummary.percent}%
              </p>
            </div>
          </div>
        ) : (
          <div className="px-6 py-8 text-center text-sm text-slate-400">
            No attendance records yet.
          </div>
        )}
      </div>

      {/* Certificates Section */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-700">Certificates</h2>
            <span className="text-xs text-slate-400">({certificates.length})</span>
          </div>
        </div>
        {certificates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
              <Award className="h-6 w-6 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-700">No certificates yet</p>
            <p className="text-xs text-slate-400 mt-1">Certificates will appear here once created</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Certificate #</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Course</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600 hidden md:table-cell">Month</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600 hidden sm:table-cell">Issue Date</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {certificates.map((cert) => (
                  <tr key={cert.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                    <td className="px-4 py-3 font-mono text-xs font-medium text-slate-800">
                      {cert.certificate_number ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{cert.courses?.course_name ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600 hidden md:table-cell">{cert.certificate_month || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'inline-flex px-2 py-0.5 rounded-full text-xs font-medium',
                        cert.status === 'Ready' ? 'bg-amber-50 text-amber-700' :
                        cert.status === 'Issued' ? 'bg-emerald-50 text-emerald-700' :
                        'bg-red-50 text-red-700'
                      )}>
                        {cert.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 hidden sm:table-cell">{formatDateDMY(cert.issue_date)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => navigate('/certificates')}
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-sky-50 hover:text-sky-600 transition"
                          title="Manage in Certificates"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <StudentFormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={fetchData}
        student={student}
      />

      <EnrollmentFormModal
        open={enrollOpen}
        onClose={() => setEnrollOpen(false)}
        onSaved={() => {
          fetchData();
          toast('Enrollment list updated', 'info');
        }}
        preselectedStudent={student}
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
