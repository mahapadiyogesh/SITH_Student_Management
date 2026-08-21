import { useEffect, useState, useCallback, type FormEvent } from 'react';
import { Loader2, BookOpen, Hash } from 'lucide-react';
import Modal from '@/components/Modal';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/useToast';
import type { Course, CourseStatus } from '@/types/database';

interface CourseFormModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  course?: Course | null;
}

const DURATIONS = ['1 Month', '2 Months', '3 Months', '6 Months', '1 Year'];

/**
 * Auto-generate a course code from the course name.
 * - Takes first 3 letters of the name, uppercased
 * - Appends a 3-digit sequential number (001, 002, ...)
 * - Queries existing codes with the same prefix to find the next available number
 */
async function generateCourseCode(courseName: string): Promise<string> {
  const cleaned = courseName.replace(/[^a-zA-Z]/g, '');
  if (cleaned.length === 0) return '';
  const prefix = cleaned.substring(0, 3).toUpperCase();

  const { data } = await supabase
    .from('courses')
    .select('course_code')
    .like('course_code', `${prefix}%`)
    .order('course_code', { ascending: false });

  let maxSeq = 0;
  for (const row of data ?? []) {
    const code = row.course_code ?? '';
    const match = code.match(new RegExp(`^${prefix}(\\d{3})$`));
    if (match) {
      const seq = parseInt(match[1], 10);
      if (seq > maxSeq) maxSeq = seq;
    }
  }
  return `${prefix}${String(maxSeq + 1).padStart(3, '0')}`;
}

export default function CourseFormModal({ open, onClose, onSaved, course }: CourseFormModalProps) {
  const { toast } = useToast();
  const isEdit = !!course;

  const [courseCode, setCourseCode] = useState('');
  const [courseName, setCourseName] = useState('');
  const [defaultFees, setDefaultFees] = useState('');
  const [duration, setDuration] = useState('');
  const [status, setStatus] = useState<CourseStatus>('Active');
  const [loading, setLoading] = useState(false);
  const [generatingCode, setGeneratingCode] = useState(false);

  useEffect(() => {
    if (open) {
      if (course) {
        setCourseCode(course.course_code ?? '');
        setCourseName(course.course_name);
        setDefaultFees(course.default_fees > 0 ? String(course.default_fees) : '');
        setDuration(course.duration ?? '');
        setStatus(course.status);
      } else {
        setCourseCode('');
        setCourseName('');
        setDefaultFees('');
        setDuration('');
        setStatus('Active');
      }
    }
  }, [open, course]);

  // Auto-generate course code when name changes (new course only)
  const handleNameChange = useCallback(async (name: string) => {
    setCourseName(name);
    if (isEdit) return; // Don't auto-generate for edits
    if (name.trim().length >= 1) {
      setGeneratingCode(true);
      try {
        const code = await generateCourseCode(name.trim());
        setCourseCode(code);
      } catch {
        // silently fail — code will be empty, user can still see preview
      } finally {
        setGeneratingCode(false);
      }
    } else {
      setCourseCode('');
    }
  }, [isEdit]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!courseName.trim()) {
      toast('Course name is required', 'error');
      return;
    }
    if (!courseCode) {
      toast('Course code could not be generated. Please ensure the course name has at least one letter.', 'error');
      return;
    }
    const fees = Number(defaultFees) || 0;
    if (fees < 0) {
      toast('Default fees must be 0 or greater', 'error');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        course_code: courseCode.trim(),
        course_name: courseName.trim(),
        default_fees: fees,
        duration: duration || null,
        status,
      };

      if (isEdit) {
        const { error } = await supabase.from('courses').update(payload).eq('id', course!.id);
        if (error) throw error;
        toast('Course updated successfully', 'success');
      } else {
        const { error } = await supabase.from('courses').insert(payload);
        if (error) throw error;
        toast('Course added successfully', 'success');
      }
      onSaved();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save course';
      toast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Course' : 'Add New Course'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Course Name <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={courseName}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Web Development"
              className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Course Code
          </label>
          <div className="relative">
            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={courseCode}
              readOnly
              placeholder="Auto-generated from course name"
              className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-slate-200 text-sm bg-slate-50 text-slate-600 cursor-not-allowed"
            />
            {generatingCode && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-slate-400" />
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {isEdit ? 'Course code cannot be changed' : 'Auto-generated from first 3 letters + sequence number'}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Default Fees (₹)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={defaultFees}
              onChange={(e) => setDefaultFees(e.target.value)}
              placeholder="5000"
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition"
            />
            <p className="text-xs text-slate-400 mt-1">Must be 0 or greater</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Duration</label>
            <select
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition bg-white"
            >
              <option value="">Select duration</option>
              {DURATIONS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as CourseStatus)}
            className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition bg-white"
          >
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
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
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 transition disabled:opacity-60 flex items-center gap-2"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? 'Update Course' : 'Add Course'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
