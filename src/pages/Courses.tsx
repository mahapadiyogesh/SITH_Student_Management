import { useEffect, useState, useCallback } from 'react';
import {
  Plus,
  Search,
  Pencil,
  Eye,
  Ban,
  RotateCcw,
  Trash2,
  Loader2,
  BookOpen,
  AlertCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/utils/cn';
import type { Course } from '@/types/database';
import CourseFormModal from '@/components/CourseFormModal';
import ConfirmDialog from '@/components/ConfirmDialog';
import CourseDetailModal from '@/components/CourseDetailModal';
import { checkCourseRelated } from '@/services/relatedRecords';

type StatusFilter = 'All' | 'Active' | 'Inactive';

type ConfirmState =
  | { type: 'deactivate'; course: Course }
  | { type: 'restore'; course: Course }
  | { type: 'delete'; course: Course }
  | null;

function formatINR(n: number): string {
  return `₹${n.toLocaleString('en-IN')}`;
}

export default function Courses() {
  const { toast } = useToast();

  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');

  const [formOpen, setFormOpen] = useState(false);
  const [editCourse, setEditCourse] = useState<Course | null>(null);
  const [viewCourse, setViewCourse] = useState<Course | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [deleteChecking, setDeleteChecking] = useState(false);

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase.from('courses').select('*').order('course_name', { ascending: true });
      if (statusFilter !== 'All') {
        query = query.eq('status', statusFilter);
      }
      const { data, error } = await query;
      if (error) throw error;
      setCourses((data ?? []) as Course[]);
    } catch {
      setError('Failed to load courses. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  const filtered = courses.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (c.course_code ?? '').toLowerCase().includes(q) ||
      c.course_name.toLowerCase().includes(q)
    );
  });

  const handleConfirm = async () => {
    if (!confirmState) return;
    setConfirmLoading(true);
    try {
      if (confirmState.type === 'deactivate') {
        const { error } = await supabase
          .from('courses')
          .update({ status: 'Inactive' })
          .eq('id', confirmState.course.id);
        if (error) throw error;
        toast('Course deactivated. Existing enrollments are preserved.', 'success');
      } else if (confirmState.type === 'restore') {
        const { error } = await supabase
          .from('courses')
          .update({ status: 'Active' })
          .eq('id', confirmState.course.id);
        if (error) throw error;
        toast('Course restored to active status', 'success');
      } else if (confirmState.type === 'delete') {
        const { error } = await supabase
          .from('courses')
          .delete()
          .eq('id', confirmState.course.id);
        if (error) throw error;
        toast('Course permanently deleted', 'success');
      }
      setConfirmState(null);
      fetchCourses();
    } catch {
      toast('Operation failed. Please try again.', 'error');
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleDeleteClick = async (course: Course) => {
    setDeleteChecking(true);
    const result = await checkCourseRelated(course.id);
    setDeleteChecking(false);
    if (result.hasRelated) {
      toast('This course is being used by student enrollments and cannot be permanently deleted.', 'error');
      return;
    }
    setConfirmState({ type: 'delete', course });
  };

  const confirmConfig = (() => {
    if (!confirmState) return null;
    if (confirmState.type === 'delete') {
      return {
        title: 'Delete Course',
        message: 'This action permanently deletes this record and cannot be undone.',
        confirmLabel: 'Delete Permanently',
        variant: 'danger' as const,
        details: [
          { label: 'Course Code', value: confirmState.course.course_code ?? '—' },
          { label: 'Course Name', value: confirmState.course.course_name },
        ],
      };
    }
    if (confirmState.type === 'deactivate') {
      return {
        title: 'Deactivate Course',
        message: `Are you sure you want to deactivate "${confirmState.course.course_name}"? Existing enrollments will continue showing the original course information.`,
        confirmLabel: 'Deactivate',
        variant: 'danger' as const,
        details: [
          { label: 'Course Code', value: confirmState.course.course_code ?? '—' },
          { label: 'Course Name', value: confirmState.course.course_name },
        ],
      };
    }
    return {
      title: 'Restore Course',
      message: `Are you sure you want to restore "${confirmState.course.course_name}" to active status?`,
      confirmLabel: 'Restore',
      variant: 'info' as const,
      details: [
        { label: 'Course Code', value: confirmState.course.course_code ?? '—' },
        { label: 'Course Name', value: confirmState.course.course_name },
      ],
    };
  })();

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Courses</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage course catalog and default fees</p>
        </div>
        <button
          onClick={() => {
            setEditCourse(null);
            setFormOpen(true);
          }}
          className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 transition"
        >
          <Plus className="h-4 w-4" />
          Add Course
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by course code or name..."
            className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition"
          />
        </div>
        <div className="flex gap-2">
          {(['All', 'Active', 'Inactive'] as StatusFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={cn(
                'px-4 py-2.5 rounded-lg text-sm font-medium transition',
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
              <BookOpen className="h-7 w-7 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-700">No courses found</p>
            <p className="text-xs text-slate-400 mt-1">
              {search || statusFilter !== 'All'
                ? 'Try adjusting your search or filters'
                : 'Click "Add Course" to create your first course'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Course Code</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Course Name</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600 hidden md:table-cell">Default Fees</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600 hidden sm:table-cell">Duration</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                    <td className="px-4 py-3 font-medium text-slate-900">{c.course_code}</td>
                    <td className="px-4 py-3 text-slate-700">{c.course_name}</td>
                    <td className="px-4 py-3 text-slate-600 hidden md:table-cell">
                      {c.default_fees > 0 ? formatINR(c.default_fees) : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600 hidden sm:table-cell">{c.duration || '—'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex px-2 py-0.5 rounded-full text-xs font-medium',
                          c.status === 'Active'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-500'
                        )}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setViewCourse(c)}
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-sky-50 hover:text-sky-600 transition"
                          title="View"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            setEditCourse(c);
                            setFormOpen(true);
                          }}
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-amber-50 hover:text-amber-600 transition"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(c)}
                          disabled={deleteChecking}
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 transition disabled:opacity-50"
                          title="Delete"
                        >
                          {deleteChecking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </button>
                        {c.status === 'Active' ? (
                          <button
                            onClick={() => setConfirmState({ type: 'deactivate', course: c })}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-orange-50 hover:text-orange-600 transition"
                            title="Deactivate"
                          >
                            <Ban className="h-4 w-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => setConfirmState({ type: 'restore', course: c })}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-emerald-50 hover:text-emerald-600 transition"
                            title="Restore"
                          >
                            <RotateCcw className="h-4 w-4" />
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

      {filtered.length > 0 && (
        <p className="text-xs text-slate-400 text-center">
          Showing {filtered.length} course{filtered.length !== 1 ? 's' : ''}
        </p>
      )}

      <CourseFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={fetchCourses}
        course={editCourse}
      />

      <CourseDetailModal
        course={viewCourse}
        onClose={() => setViewCourse(null)}
        onEdit={(c) => {
          setViewCourse(null);
          setEditCourse(c);
          setFormOpen(true);
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
