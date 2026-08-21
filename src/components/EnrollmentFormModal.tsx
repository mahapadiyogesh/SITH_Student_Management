import { useEffect, useState, type FormEvent } from 'react';
import { Loader2, GraduationCap } from 'lucide-react';
import Modal from '@/components/Modal';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/useToast';
import type { Student, Course, EnrollmentStatus } from '@/types/database';

interface EnrollmentFormModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  preselectedStudent?: Student | null;
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function formatINR(n: number): string {
  return `₹${n.toLocaleString('en-IN')}`;
}

export default function EnrollmentFormModal({
  open,
  onClose,
  onSaved,
  preselectedStudent,
}: EnrollmentFormModalProps) {
  const { toast } = useToast();

  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [batchName, setBatchName] = useState('');
  const [joiningDate, setJoiningDate] = useState(todayStr());
  const [defaultFeesSnapshot, setDefaultFeesSnapshot] = useState(0);
  const [discount, setDiscount] = useState('');
  const [finalFees, setFinalFees] = useState('');
  const [finalFeesManual, setFinalFeesManual] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setBatchName('');
      setJoiningDate(todayStr());
      setDiscount('');
      setFinalFees('');
      setFinalFeesManual(false);
      setDefaultFeesSnapshot(0);
      setSelectedCourseId('');
      if (preselectedStudent) {
        setSelectedStudentId(preselectedStudent.id);
      } else {
        setSelectedStudentId('');
      }
      loadOptions();
    }
  }, [open, preselectedStudent]);

  async function loadOptions() {
    setDataLoading(true);
    try {
      const [studentsRes, coursesRes] = await Promise.all([
        supabase.from('students').select('*').eq('status', 'Active').order('full_name'),
        supabase.from('courses').select('*').eq('status', 'Active').order('course_name'),
      ]);
      if (studentsRes.data) setStudents(studentsRes.data as Student[]);
      if (coursesRes.data) setCourses(coursesRes.data as Course[]);
    } catch {
      toast('Failed to load students and courses', 'error');
    } finally {
      setDataLoading(false);
    }
  }

  // When course is selected, auto-load default fees
  useEffect(() => {
    if (selectedCourseId) {
      const course = courses.find((c) => c.id === selectedCourseId);
      if (course) {
        setDefaultFeesSnapshot(course.default_fees);
        const disc = Number(discount) || 0;
        setFinalFees(String(course.default_fees - disc));
        setFinalFeesManual(false);
      }
    } else {
      setDefaultFeesSnapshot(0);
      setFinalFees('');
    }
  }, [selectedCourseId, courses]);

  // When discount changes, auto-calculate final fees unless manually overridden
  useEffect(() => {
    if (!finalFeesManual && defaultFeesSnapshot > 0) {
      const disc = Number(discount) || 0;
      setFinalFees(String(defaultFeesSnapshot - disc));
    }
  }, [discount, defaultFeesSnapshot, finalFeesManual]);

  const handleFinalFeesChange = (value: string) => {
    setFinalFees(value);
    setFinalFeesManual(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!selectedStudentId) {
      toast('Please select a student', 'error');
      return;
    }
    if (!selectedCourseId) {
      toast('Please select a course', 'error');
      return;
    }
    if (!batchName.trim()) {
      toast('Batch name is required', 'error');
      return;
    }
    if (!joiningDate) {
      toast('Joining date is required', 'error');
      return;
    }
    const disc = Number(discount) || 0;
    if (disc < 0) {
      toast('Discount must be 0 or greater', 'error');
      return;
    }
    const final = Number(finalFees) || 0;
    if (final < 0) {
      toast('Final fees must be 0 or greater', 'error');
      return;
    }

    setLoading(true);
    try {
      // Check for duplicate active enrollment
      const { data: existing } = await supabase
        .from('enrollments')
        .select('id')
        .eq('student_id', selectedStudentId)
        .eq('course_id', selectedCourseId)
        .eq('status', 'Active')
        .maybeSingle();

      if (existing) {
        toast('Student is already enrolled in this course.', 'error');
        setLoading(false);
        return;
      }

      const { error } = await supabase.from('enrollments').insert({
        student_id: selectedStudentId,
        course_id: selectedCourseId,
        batch_name: batchName.trim(),
        joining_date: joiningDate,
        default_fees_snapshot: defaultFeesSnapshot,
        discount: disc,
        final_fees: final,
        status: 'Active' as EnrollmentStatus,
      });

      if (error) throw error;
      toast('Student enrolled successfully', 'success');
      onSaved();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create enrollment';
      toast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Enroll Student in Course"
      description="Course default fees are loaded automatically"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Student <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              disabled={!!preselectedStudent || dataLoading}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition bg-white disabled:bg-slate-50"
            >
              <option value="">Select student</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.student_id} - {s.full_name}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-400 mt-1">Only active students are shown</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Course <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              disabled={dataLoading}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition bg-white"
            >
              <option value="">Select course</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.course_name} ({c.course_code})
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-400 mt-1">Only active courses are shown</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Batch <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={batchName}
              onChange={(e) => setBatchName(e.target.value)}
              placeholder="Morning / Evening / Afternoon"
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Joining Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={joiningDate}
              onChange={(e) => setJoiningDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition"
            />
          </div>
        </div>

        {/* Fees structure display */}
        <div className="bg-slate-50 rounded-lg border border-slate-200 p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <GraduationCap className="h-4 w-4" />
            Fees Structure
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Course Default Fees (snapshot)
              </label>
              <div className="px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700">
                {defaultFeesSnapshot > 0 ? formatINR(defaultFeesSnapshot) : '—'}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">Auto-loaded from course</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Discount (₹)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={discount}
                onChange={(e) => {
                  setDiscount(e.target.value);
                  setFinalFeesManual(false);
                }}
                placeholder="0"
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Final Fees (₹) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={finalFees}
                onChange={(e) => handleFinalFeesChange(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition"
              />
              <p className="text-xs text-slate-400 mt-0.5">
                {finalFeesManual ? 'Manually adjusted' : 'Auto-calculated'}
              </p>
            </div>
          </div>

          {defaultFeesSnapshot > 0 && (
            <div className="flex items-center justify-between text-sm pt-2 border-t border-slate-200">
              <span className="text-slate-500">
                {formatINR(defaultFeesSnapshot)} − {formatINR(Number(discount) || 0)} ={' '}
                <span className="font-semibold text-slate-700">{formatINR(Number(finalFees) || 0)}</span>
              </span>
              {finalFeesManual && (
                <span className="text-xs text-amber-600 font-medium">
                  Manually overridden
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || dataLoading}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 transition disabled:opacity-60 flex items-center gap-2"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Enroll Student
          </button>
        </div>
      </form>
    </Modal>
  );
}
