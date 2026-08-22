import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Plus,
  Search,
  Loader2,
  FileText,
  AlertCircle,
  Eye,
  Edit2,
  Trash2,
  X,
  Filter,
  Calendar,
  Download,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/utils/cn';
import { formatDateDMY } from '@/utils/date';
import type { Exam, ExamResult } from '@/types/database';
import ExamFormModal from '@/components/ExamFormModal';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import * as XLSX from 'xlsx';

// ---------- Types ----------

interface ExamWithDetails extends Exam {
  enrollments: {
    id: string;
    batch_name: string | null;
    joining_date: string | null;
    students: { id: string; student_id: string | null; full_name: string } | null;
    courses: { id: string; course_name: string; course_code: string | null } | null;
  } | null;
}

type ResultFilter = 'All' | ExamResult;

// ---------- Constants ----------

const RESULT_COLORS: Record<string, string> = {
  Pass: 'bg-emerald-50 text-emerald-700',
  Fail: 'bg-red-50 text-red-700',
  Pending: 'bg-amber-50 text-amber-700',
};

const RESULT_FILTERS: ResultFilter[] = ['All', 'Pass', 'Fail', 'Pending'];

// ---------- Main Component ----------

export default function Exams() {
  const { toast } = useToast();

  const [exams, setExams] = useState<ExamWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [resultFilter, setResultFilter] = useState<ResultFilter>('All');
  const [courseFilter, setCourseFilter] = useState('');
  const [batchFilter, setBatchFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Modal state
  const [formOpen, setFormOpen] = useState(false);
  const [editExam, setEditExam] = useState<Exam | null>(null);
  const [deleteExam, setDeleteExam] = useState<ExamWithDetails | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [viewExam, setViewExam] = useState<ExamWithDetails | null>(null);
  const [exporting, setExporting] = useState(false);

  // ---------- Data ----------

  const fetchExams = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('exams')
        .select(`
          *,
          enrollments!inner (
            id,
            batch_name,
            joining_date,
            students:student_id ( id, student_id, full_name ),
            courses:course_id ( id, course_name, course_code )
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setExams((data ?? []) as ExamWithDetails[]);
    } catch {
      setError('Failed to load exams. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExams();
  }, [fetchExams]);

  // ---------- Derived data for filter dropdowns ----------

  const { courseOptions, batchOptions } = useMemo(() => {
    const courses = new Map<string, string>();
    const batches = new Set<string>();
    for (const exam of exams) {
      const course = exam.enrollments?.courses;
      if (course) courses.set(course.id, course.course_name);
      const batch = exam.enrollments?.batch_name;
      if (batch) batches.add(batch);
    }
    return {
      courseOptions: Array.from(courses.entries()).map(([id, name]) => ({ id, name })),
      batchOptions: Array.from(batches).sort(),
    };
  }, [exams]);

  // ---------- Filtering ----------

  const filtered = useMemo(() => {
    return exams.filter((exam) => {
      // Search
      if (search.trim()) {
        const q = search.toLowerCase();
        const studentName = exam.enrollments?.students?.full_name?.toLowerCase() ?? '';
        const studentId = exam.enrollments?.students?.student_id?.toLowerCase() ?? '';
        const courseName = exam.enrollments?.courses?.course_name?.toLowerCase() ?? '';
        const examName = exam.exam_name?.toLowerCase() ?? '';
        if (
          !studentName.includes(q) &&
          !studentId.includes(q) &&
          !courseName.includes(q) &&
          !examName.includes(q)
        ) return false;
      }

      // Result filter
      if (resultFilter !== 'All' && exam.result !== resultFilter) return false;

      // Course filter
      if (courseFilter && exam.enrollments?.courses?.id !== courseFilter) return false;

      // Batch filter
      if (batchFilter && exam.enrollments?.batch_name !== batchFilter) return false;

      // Date range
      if (dateFrom && exam.exam_date && exam.exam_date < dateFrom) return false;
      if (dateTo && exam.exam_date && exam.exam_date > dateTo) return false;

      return true;
    });
  }, [exams, search, resultFilter, courseFilter, batchFilter, dateFrom, dateTo]);

  // ---------- Actions ----------

  const handleEdit = (exam: ExamWithDetails) => {
    const { enrollments: _enr, ...rest } = exam;
    setEditExam(rest as Exam);
    setFormOpen(true);
  };

  const handleAdd = () => {
    setEditExam(null);
    setFormOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteExam) return;
    setConfirmLoading(true);
    try {
      const { error } = await supabase.from('exams').delete().eq('id', deleteExam.id);
      if (error) throw error;
      toast('Exam record deleted', 'success');
      setDeleteExam(null);
      fetchExams();
    } catch {
      toast('Failed to delete exam record', 'error');
    } finally {
      setConfirmLoading(false);
    }
  };

  const clearFilters = () => {
    setSearch('');
    setResultFilter('All');
    setCourseFilter('');
    setBatchFilter('');
    setDateFrom('');
    setDateTo('');
  };

  const hasActiveFilters =
    search !== '' ||
    resultFilter !== 'All' ||
    courseFilter !== '' ||
    batchFilter !== '' ||
    dateFrom !== '' ||
    dateTo !== '';

  const handleExport = async () => {
    setExporting(true);
    try {
      const { data, error } = await supabase
        .from('exams')
        .select(`
          *,
          enrollments!inner (
            id,
            batch_name,
            joining_date,
            students:student_id ( id, student_id, full_name ),
            courses:course_id ( id, course_name, course_code )
          )
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const allExams = (data ?? []) as ExamWithDetails[];

      const headers = [
        'Student ID', 'Student Name', 'Course', 'Course Code', 'Batch',
        'Exam Name', 'Exam Date', 'Total Marks', 'Marks Obtained',
        'Percentage', 'Result', 'Remarks',
      ];

      const rows = allExams.map((exam) => {
        const student = exam.enrollments?.students;
        const course = exam.enrollments?.courses;
        const total = exam.total_marks ? Number(exam.total_marks) : null;
        const obtained = exam.marks_obtained != null ? Number(exam.marks_obtained) : null;
        const pct = total && obtained != null ? Math.round((obtained / total) * 100) : null;
        return [
          student?.student_id ?? '',
          student?.full_name ?? '',
          course?.course_name ?? '',
          course?.course_code ?? '',
          exam.enrollments?.batch_name ?? '',
          exam.exam_name ?? '',
          exam.exam_date ?? '',
          total ?? '',
          obtained ?? '',
          pct != null ? `${pct}%` : '',
          exam.result ?? '',
          exam.remarks ?? '',
        ];
      });

      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      ws['!cols'] = [
        { wch: 12 }, { wch: 25 }, { wch: 25 }, { wch: 12 }, { wch: 15 },
        { wch: 20 }, { wch: 14 }, { wch: 12 }, { wch: 14 },
        { wch: 12 }, { wch: 12 }, { wch: 20 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Exams');
      const today = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `exams_export_${today}.xlsx`);

      toast('Exam data exported successfully', 'success');
    } catch {
      toast('Failed to export exam data', 'error');
    } finally {
      setExporting(false);
    }
  };

  // ---------- Render ----------

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Exams</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage exam records and results</p>
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
            onClick={handleAdd}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 transition"
          >
            <Plus className="h-4 w-4" />
            Add Exam
          </button>
        </div>
      </div>

      {/* Filters Row 1: Search + Date range */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by student name, ID, course, or exam..."
            className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition"
          />
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-slate-400" />
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-2.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
            title="From date"
          />
          <span className="text-xs text-slate-400">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-2.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
            title="To date"
          />
        </div>
      </div>

      {/* Filters Row 2: Result status pills + Dropdowns */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {RESULT_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setResultFilter(f)}
              className={cn(
                'px-3 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap',
                resultFilter === f
                  ? 'bg-slate-900 text-white'
                  : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50'
              )}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 text-slate-300 mx-1">|</div>

        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-slate-400" />
          <select
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            className="px-2.5 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
          >
            <option value="">All Courses</option>
            {courseOptions.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <select
            value={batchFilter}
            onChange={(e) => setBatchFilter(e.target.value)}
            className="px-2.5 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
          >
            <option value="">All Batches</option>
            {batchOptions.map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 px-2.5 py-2 rounded-lg text-sm font-medium text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 transition"
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
              <FileText className="h-7 w-7 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-700">No exam records found</p>
            <p className="text-xs text-slate-400 mt-1">
              {hasActiveFilters
                ? 'Try adjusting your search or filters'
                : 'Click "Add Exam" to record a student exam'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Student</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600 hidden md:table-cell">Student ID</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Course</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600 hidden md:table-cell">Batch</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600 hidden lg:table-cell">Exam Name</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Date</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Marks</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600 hidden sm:table-cell">%</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Result</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((exam) => {
                  const student = exam.enrollments?.students;
                  const course = exam.enrollments?.courses;
                  const total = exam.total_marks ? Number(exam.total_marks) : null;
                  const obtained = exam.marks_obtained != null ? Number(exam.marks_obtained) : null;
                  const pct = total && obtained != null ? Math.round((obtained / total) * 100) : null;

                  return (
                    <tr key={exam.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {student?.full_name ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-600 hidden md:table-cell">
                        {student?.student_id ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {course?.course_name ?? '—'}
                        {course?.course_code && (
                          <span className="text-xs text-slate-400 ml-1">({course.course_code})</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600 hidden md:table-cell">
                        {exam.enrollments?.batch_name || '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-600 hidden lg:table-cell">
                        {exam.exam_name || '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-600 tabular-nums">
                        {formatDateDMY(exam.exam_date)}
                      </td>
                      <td className="px-4 py-3 text-slate-900 text-right font-medium tabular-nums">
                        {obtained != null && total != null ? `${obtained}/${total}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-right hidden sm:table-cell tabular-nums">
                        {pct != null ? `${pct}%` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          'inline-flex px-2 py-0.5 rounded-full text-xs font-medium',
                          RESULT_COLORS[exam.result ?? 'Pending'] ?? RESULT_COLORS.Pending
                        )}>
                          {exam.result ?? 'Pending'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setViewExam(exam)}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-sky-50 hover:text-sky-600 transition"
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleEdit(exam)}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-amber-50 hover:text-amber-600 transition"
                            title="Edit"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setDeleteExam(exam)}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 transition"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
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
          Showing {filtered.length} exam record{filtered.length !== 1 ? 's' : ''}
        </p>
      )}

      {/* Form Modal */}
      <ExamFormModal
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditExam(null); }}
        onSaved={() => { fetchExams(); toast('Exam list updated', 'info'); }}
        exam={editExam}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteExam}
        onClose={() => setDeleteExam(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Exam Record"
        message="This action permanently deletes this exam record and cannot be undone."
        confirmLabel="Delete Permanently"
        variant="danger"
        details={deleteExam ? [
          { label: 'Student', value: deleteExam.enrollments?.students?.full_name ?? '—' },
          { label: 'Course', value: deleteExam.enrollments?.courses?.course_name ?? '—' },
          { label: 'Exam', value: deleteExam.exam_name ?? formatDateDMY(deleteExam.exam_date) },
          { label: 'Result', value: deleteExam.result ?? 'Pending' },
        ] : []}
        loading={confirmLoading}
      />

      {/* View Details Modal */}
      <Modal
        open={!!viewExam}
        onClose={() => setViewExam(null)}
        title="Exam Details"
        size="md"
      >
        {viewExam && (() => {
          const student = viewExam.enrollments?.students;
          const course = viewExam.enrollments?.courses;
          const total = viewExam.total_marks ? Number(viewExam.total_marks) : null;
          const obtained = viewExam.marks_obtained != null ? Number(viewExam.marks_obtained) : null;
          const pct = total && obtained != null ? Math.round((obtained / total) * 100) : null;

          return (
            <div className="space-y-5">
              {/* Student & Course */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Student</p>
                  <p className="text-sm font-medium text-slate-900">{student?.full_name ?? '—'}</p>
                  <p className="text-xs text-slate-500">{student?.student_id ?? ''}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Course</p>
                  <p className="text-sm font-medium text-slate-900">{course?.course_name ?? '—'}</p>
                  <p className="text-xs text-slate-500">{course?.course_code ?? ''}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Batch</p>
                  <p className="text-sm font-medium text-slate-900">{viewExam.enrollments?.batch_name || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Joining Date</p>
                  <p className="text-sm font-medium text-slate-900">{formatDateDMY(viewExam.enrollments?.joining_date)}</p>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4" />

              {/* Exam Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Exam Name</p>
                  <p className="text-sm font-medium text-slate-900">{viewExam.exam_name || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Exam Date</p>
                  <p className="text-sm font-medium text-slate-900">{formatDateDMY(viewExam.exam_date)}</p>
                </div>
              </div>

              {/* Marks Summary */}
              <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Total Marks</p>
                    <p className="text-lg font-bold text-slate-900 tabular-nums">
                      {total ?? '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Obtained</p>
                    <p className="text-lg font-bold text-slate-900 tabular-nums">
                      {obtained ?? '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Percentage</p>
                    <p className="text-lg font-bold text-slate-900 tabular-nums">
                      {pct != null ? `${pct}%` : '—'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Result Badge */}
              <div className="flex items-center justify-center">
                <span className={cn(
                  'inline-flex px-4 py-1.5 rounded-full text-sm font-semibold',
                  RESULT_COLORS[viewExam.result ?? 'Pending'] ?? RESULT_COLORS.Pending
                )}>
                  {viewExam.result ?? 'Pending'}
                </span>
              </div>

              {/* Remarks */}
              {viewExam.remarks && (
                <div>
                  <p className="text-xs text-slate-400 mb-1">Remarks</p>
                  <p className="text-sm text-slate-700 bg-slate-50 rounded-lg border border-slate-200 px-3 py-2">
                    {viewExam.remarks}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  onClick={() => { handleEdit(viewExam); setViewExam(null); }}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition"
                >
                  <Edit2 className="h-4 w-4" />
                  Edit Exam
                </button>
                <button
                  onClick={() => setViewExam(null)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition"
                >
                  Close
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
