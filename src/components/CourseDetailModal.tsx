import { useEffect, useState } from 'react';
import { Loader2, Pencil, BookOpen, Hash, Wallet, Clock, BarChart3 } from 'lucide-react';
import Modal from '@/components/Modal';
import { supabase } from '@/lib/supabaseClient';
import type { Course } from '@/types/database';

interface CourseDetailModalProps {
  course: Course | null;
  onClose: () => void;
  onEdit: (course: Course) => void;
}

function formatINR(n: number): string {
  return `₹${n.toLocaleString('en-IN')}`;
}

export default function CourseDetailModal({ course, onClose, onEdit }: CourseDetailModalProps) {
  const [enrollmentCount, setEnrollmentCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!course) {
      setEnrollmentCount(null);
      return;
    }
    setLoading(true);
    supabase
      .from('enrollments')
      .select('id', { count: 'exact', head: true })
      .eq('course_id', course.id)
      .then(({ count }) => {
        setEnrollmentCount(count ?? 0);
        setLoading(false);
      });
  }, [course]);

  if (!course) return null;

  const rows = [
    { label: 'Course Code', value: course.course_code ?? '—', icon: Hash },
    { label: 'Course Name', value: course.course_name, icon: BookOpen },
    { label: 'Default Fees', value: formatINR(course.default_fees), icon: Wallet },
    { label: 'Duration', value: course.duration ?? '—', icon: Clock },
    { label: 'Status', value: course.status, icon: BarChart3 },
  ];

  return (
    <Modal open={!!course} onClose={onClose} title="Course Details" size="md">
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center gap-3 py-2.5 border-b border-slate-100 last:border-0">
            <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 flex-shrink-0">
              <row.icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-400">{row.label}</p>
              <p className="text-sm font-medium text-slate-800">{row.value}</p>
            </div>
          </div>
        ))}

        <div className="flex items-center gap-3 py-2.5 border-b border-slate-100 last:border-0">
          <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 flex-shrink-0">
            <BarChart3 className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-400">Total Enrollments</p>
            <p className="text-sm font-medium text-slate-800">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : enrollmentCount}
            </p>
          </div>
        </div>

        <div className="flex justify-end pt-3">
          <button
            onClick={() => onEdit(course)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 transition"
          >
            <Pencil className="h-4 w-4" />
            Edit Course
          </button>
        </div>
      </div>
    </Modal>
  );
}
