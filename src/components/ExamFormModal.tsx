import { useState, useEffect, useCallback } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import Modal from './Modal';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/useToast';
import { todayStr } from '@/utils/date';
import type { Exam, Student, Enrollment, Course } from '@/types/database';

interface EnrollmentWithCourse extends Enrollment {
  courses: Pick<Course, 'id' | 'course_name' | 'course_code'> | null;
}

interface ExamFormModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  exam?: Exam | null;
}

interface FormData {
  student_id: string;
  enrollment_id: string;
  exam_date: string;
  exam_name: string;
  total_marks: string;
  marks_obtained: string;
  remarks: string;
}

const EMPTY: FormData = {
  student_id: '',
  enrollment_id: '',
  exam_date: todayStr(),
  exam_name: '',
  total_marks: '',
  marks_obtained: '',
  remarks: '',
};

export default function ExamFormModal({ open, onClose, onSaved, exam }: ExamFormModalProps) {
  const { toast } = useToast();
  const isEdit = !!exam;

  const [form, setForm] = useState<FormData>(EMPTY);
  const [students, setStudents] = useState<Student[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentWithCourse[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Load active students when modal opens
  useEffect(() => {
    if (!open) return;
    let mounted = true;
    setLoading(true);
    setError('');
    supabase
      .from('students')
      .select('*')
      .eq('status', 'Active')
      .order('full_name')
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) {
          setError('Failed to load students');
        } else {
          setStudents((data ?? []) as Student[]);
        }
        setLoading(false);
      });
    return () => { mounted = false; };
  }, [open]);

  // Load enrollments for selected student
  const loadEnrollments = useCallback(async (studentId: string) => {
    if (!studentId) {
      setEnrollments([]);
      return;
    }
    const { data } = await supabase
      .from('enrollments')
      .select(`*, courses:course_id ( id, course_name, course_code )`)
      .eq('student_id', studentId)
      .neq('status', 'Inactive')
      .order('created_at', { ascending: false });
    setEnrollments((data ?? []) as EnrollmentWithCourse[]);
  }, []);

  // Pre-fill form when editing
  useEffect(() => {
    if (!open || !exam) return;
    let mounted = true;
    (async () => {
      // Find the enrollment to get student_id
      const { data: enrollment } = await supabase
        .from('enrollments')
        .select('student_id')
        .eq('id', exam.enrollment_id)
        .single();
      if (!mounted) return;
      if (enrollment) {
        setForm({
          student_id: enrollment.student_id,
          enrollment_id: exam.enrollment_id,
          exam_date: exam.exam_date || todayStr(),
          exam_name: exam.exam_name || '',
          total_marks: exam.total_marks != null ? String(exam.total_marks) : '',
          marks_obtained: exam.marks_obtained != null ? String(exam.marks_obtained) : '',
          remarks: exam.remarks || '',
        });
        await loadEnrollments(enrollment.student_id);
      }
    })();
    return () => { mounted = false; };
  }, [open, exam, loadEnrollments]);

  // Reset form when opening for create
  useEffect(() => {
    if (open && !exam) {
      setForm(EMPTY);
      setEnrollments([]);
    }
  }, [open, exam]);

  const updateField = (field: keyof FormData, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleStudentChange = async (studentId: string) => {
    updateField('student_id', studentId);
    updateField('enrollment_id', '');
    setEnrollments([]);
    if (studentId) await loadEnrollments(studentId);
  };

  const handleEnrollmentChange = (enrollmentId: string) => {
    updateField('enrollment_id', enrollmentId);
    // Auto-fill batch name from enrollment if available
  };

  // Compute percentage and result preview
  const totalNum = parseFloat(form.total_marks) || 0;
  const obtainedNum = parseFloat(form.marks_obtained) || 0;
  const hasValidMarks = totalNum > 0 && form.marks_obtained !== '';
  const percentage = hasValidMarks ? Math.round((obtainedNum / totalNum) * 100) : null;
  const resultPreview = !hasValidMarks
    ? 'Pending'
    : percentage! >= 40
      ? 'Pass'
      : 'Fail';

  const resultColor =
    resultPreview === 'Pass'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : resultPreview === 'Fail'
        ? 'bg-red-50 text-red-700 border-red-200'
        : 'bg-amber-50 text-amber-700 border-amber-200';

  const validate = (): string | null => {
    if (!form.student_id) return 'Please select a student.';
    if (!form.enrollment_id) return 'Please select an enrollment.';
    if (!form.exam_date) return 'Please enter an exam date.';
    if (!form.total_marks || totalNum <= 0) return 'Total marks must be greater than 0.';
    if (form.marks_obtained === '') return 'Please enter marks obtained.';
    if (obtainedNum < 0) return 'Marks obtained cannot be negative.';
    if (obtainedNum > totalNum) return 'Marks obtained cannot exceed total marks.';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      toast(validationError, 'error');
      return;
    }
    setSaving(true);
    setError('');

    const payload = {
      enrollment_id: form.enrollment_id,
      exam_date: form.exam_date,
      exam_name: form.exam_name || null,
      total_marks: totalNum,
      marks_obtained: obtainedNum,
      remarks: form.remarks || null,
    };

    try {
      if (isEdit && exam) {
        const { error } = await supabase.from('exams').update(payload).eq('id', exam.id);
        if (error) throw error;
        toast('Exam record updated successfully', 'success');
      } else {
        const { error } = await supabase.from('exams').insert([payload]);
        if (error) throw error;
        toast('Exam record added successfully', 'success');
      }
      onSaved();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save exam';
      toast(msg, 'error');
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const selectedEnrollment = enrollments.find(en => en.id === form.enrollment_id);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Exam Record' : 'Add Exam Record'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : (
          <>
            {/* Student + Enrollment row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Student <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.student_id}
                  onChange={(e) => handleStudentChange(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  required
                >
                  <option value="">Select Student</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.student_id} — {s.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Enrollment / Course <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.enrollment_id}
                  onChange={(e) => handleEnrollmentChange(e.target.value)}
                  disabled={!form.student_id}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-400"
                  required
                >
                  <option value="">Select Enrollment</option>
                  {enrollments.map(en => (
                    <option key={en.id} value={en.id}>
                      {en.courses?.course_name ?? '—'}{en.batch_name ? ` (${en.batch_name})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Enrollment info badge */}
            {selectedEnrollment && (
              <div className="bg-slate-50 rounded-lg border border-slate-200 px-4 py-3 text-sm">
                <div className="flex flex-wrap gap-x-6 gap-y-1">
                  <span className="text-slate-500">
                    Course: <span className="font-medium text-slate-800">{selectedEnrollment.courses?.course_name ?? '—'}</span>
                  </span>
                  <span className="text-slate-500">
                    Batch: <span className="font-medium text-slate-800">{selectedEnrollment.batch_name || '—'}</span>
                  </span>
                  <span className="text-slate-500">
                    Status: <span className="font-medium text-slate-800">{selectedEnrollment.status}</span>
                  </span>
                </div>
              </div>
            )}

            {/* Exam Date + Exam Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Exam Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={form.exam_date}
                  onChange={(e) => updateField('exam_date', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Exam Name
                </label>
                <input
                  type="text"
                  value={form.exam_name}
                  onChange={(e) => updateField('exam_name', e.target.value)}
                  placeholder="e.g. Final Exam, Mid-Term"
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                />
              </div>
            </div>

            {/* Marks */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Total Marks <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={form.total_marks}
                  onChange={(e) => updateField('total_marks', e.target.value)}
                  placeholder="e.g. 100"
                  min="1"
                  step="1"
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Marks Obtained <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={form.marks_obtained}
                  onChange={(e) => updateField('marks_obtained', e.target.value)}
                  placeholder="e.g. 75"
                  min="0"
                  step="1"
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Result (auto-calculated)
                </label>
                <div className={`flex items-center justify-center h-[42px] rounded-lg border text-sm font-semibold ${resultColor}`}>
                  {hasValidMarks ? `${percentage}% — ${resultPreview}` : 'Pending'}
                </div>
              </div>
            </div>

            {/* Remarks */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Remarks</label>
              <textarea
                value={form.remarks}
                onChange={(e) => updateField('remarks', e.target.value)}
                rows={3}
                placeholder="Optional notes about the exam"
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent resize-none"
              />
            </div>
          </>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 transition disabled:opacity-60"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? 'Update Exam' : 'Add Exam'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
