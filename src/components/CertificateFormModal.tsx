import { useState, useEffect, useCallback } from 'react';
import { Loader2, AlertCircle, Sparkles } from 'lucide-react';
import Modal from './Modal';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/useToast';
import { todayStr } from '@/utils/date';
import type { Certificate, Student, Enrollment, Course } from '@/types/database';

interface EnrollmentWithCourse extends Enrollment {
  courses: Pick<Course, 'id' | 'course_name' | 'course_code'> | null;
}

interface CertificateFormModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  certificate?: Certificate | null;
}

interface FormData {
  student_id: string;
  enrollment_id: string;
  certificate_number: string;
  certificate_month: string;
  remarks: string;
}

const EMPTY: FormData = {
  student_id: '',
  enrollment_id: '',
  certificate_number: '',
  certificate_month: '',
  remarks: '',
};

async function generateNextCertNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `CERT-${year}-`;
  const { data } = await supabase
    .from('certificates')
    .select('certificate_number')
    .like('certificate_number', `${prefix}%`)
    .order('certificate_number', { ascending: false })
    .limit(1);
  const latest = data?.[0]?.certificate_number;
  if (latest) {
    const seqMatch = latest.match(/^CERT-(\d{4})-(\d+)$/);
    if (seqMatch) {
      const seq = parseInt(seqMatch[2], 10) + 1;
      return `CERT-${year}-${String(seq).padStart(4, '0')}`;
    }
  }
  return `CERT-${year}-0001`;
}

export default function CertificateFormModal({ open, onClose, onSaved, certificate }: CertificateFormModalProps) {
  const { toast } = useToast();
  const isEdit = !!certificate;

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
      .order('full_name')
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) setError('Failed to load students');
        else setStudents((data ?? []) as Student[]);
        setLoading(false);
      });
    return () => { mounted = false; };
  }, [open]);

  // Load enrollments for selected student (include inactive for historical records)
  const loadEnrollments = useCallback(async (studentId: string) => {
    if (!studentId) { setEnrollments([]); return; }
    const { data } = await supabase
      .from('enrollments')
      .select(`*, courses:course_id ( id, course_name, course_code )`)
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });
    setEnrollments((data ?? []) as EnrollmentWithCourse[]);
  }, []);

  // Pre-fill form when editing
  useEffect(() => {
    if (!open || !certificate) return;
    let mounted = true;
    (async () => {
      const { data: enrollment } = await supabase
        .from('enrollments')
        .select('student_id')
        .eq('id', certificate.enrollment_id)
        .single();
      if (!mounted) return;
      if (enrollment) {
        setForm({
          student_id: enrollment.student_id,
          enrollment_id: certificate.enrollment_id,
          certificate_number: certificate.certificate_number || '',
          certificate_month: certificate.certificate_month || '',
          remarks: certificate.remarks || '',
        });
        await loadEnrollments(enrollment.student_id);
      }
    })();
    return () => { mounted = false; };
  }, [open, certificate, loadEnrollments]);

  // Reset form when opening for create
  useEffect(() => {
    if (open && !certificate) {
      const today = new Date();
      const month = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
      (async () => {
        const certNum = await generateNextCertNumber();
        setForm({
          ...EMPTY,
          certificate_number: certNum,
          certificate_month: month,
        });
      })();
      setEnrollments([]);
    }
  }, [open, certificate]);

  const updateField = (field: keyof FormData, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleStudentChange = async (studentId: string) => {
    updateField('student_id', studentId);
    updateField('enrollment_id', '');
    setEnrollments([]);
    if (studentId) await loadEnrollments(studentId);
  };

  const handleGenerateNumber = async () => {
    const num = await generateNextCertNumber();
    updateField('certificate_number', num);
  };

  const selectedEnrollment = enrollments.find(en => en.id === form.enrollment_id);

  const validate = (): string | null => {
    if (!form.student_id) return 'Please select a student.';
    if (!form.enrollment_id) return 'Please select an enrollment.';
    if (!form.certificate_number.trim()) return 'Certificate number is required.';
    if (!form.certificate_month) return 'Certificate month is required.';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) { toast(validationError, 'error'); return; }

    setSaving(true);
    setError('');

    const payload = {
      enrollment_id: form.enrollment_id,
      certificate_number: form.certificate_number.trim(),
      certificate_month: form.certificate_month,
      status: 'Ready' as const,
      remarks: form.remarks || null,
    };

    try {
      if (isEdit && certificate) {
        const { error } = await supabase
          .from('certificates')
          .update({
            enrollment_id: payload.enrollment_id,
            certificate_number: payload.certificate_number,
            certificate_month: payload.certificate_month,
            remarks: payload.remarks,
          })
          .eq('id', certificate.id);
        if (error) throw error;
        toast('Certificate updated successfully', 'success');
      } else {
        const { error } = await supabase.from('certificates').insert([payload]);
        if (error) throw error;
        toast('Certificate created successfully', 'success');
      }
      onSaved();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save certificate';
      if (msg.includes('duplicate') || msg.includes('unique')) {
        toast('Certificate number already exists. Please use a unique number.', 'error');
      } else {
        toast(msg, 'error');
      }
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Certificate' : 'Add Certificate'} size="lg">
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
            {/* Student + Enrollment */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Student <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.student_id}
                  onChange={(e) => handleStudentChange(e.target.value)}
                  disabled={isEdit}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent disabled:bg-slate-50"
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
                  onChange={(e) => updateField('enrollment_id', e.target.value)}
                  disabled={!form.student_id || isEdit}
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

            {/* Certificate Number + Month */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Certificate Number <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={form.certificate_number}
                    onChange={(e) => updateField('certificate_number', e.target.value)}
                    placeholder="e.g. CERT-2026-0001"
                    className="flex-1 px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                    required
                  />
                  {!isEdit && (
                    <button
                      type="button"
                      onClick={handleGenerateNumber}
                      className="px-3 py-2.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 transition"
                      title="Generate next number"
                    >
                      <Sparkles className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Certificate Month <span className="text-red-500">*</span>
                </label>
                <input
                  type="month"
                  value={form.certificate_month}
                  onChange={(e) => updateField('certificate_month', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  required
                />
              </div>
            </div>

            {/* Remarks */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Remarks</label>
              <textarea
                value={form.remarks}
                onChange={(e) => updateField('remarks', e.target.value)}
                rows={3}
                placeholder="Optional notes about this certificate"
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent resize-none"
              />
            </div>
          </>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
          <button type="button" onClick={onClose} disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition disabled:opacity-60">
            Cancel
          </button>
          <button type="submit" disabled={saving || loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 transition disabled:opacity-60">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? 'Update Certificate' : 'Create Certificate'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
