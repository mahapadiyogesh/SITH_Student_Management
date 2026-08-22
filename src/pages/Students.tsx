import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Eye,
  Pencil,
  Ban,
  RotateCcw,
  Trash2,
  Loader2,
  Users,
  AlertCircle,
  Upload,
  Download,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/utils/cn';
import type { Student } from '@/types/database';
import StudentFormModal from '@/components/StudentFormModal';
import ImportStudentsModal from '@/components/ImportStudentsModal';
import ConfirmDialog from '@/components/ConfirmDialog';
import { exportStudentsToXlsx } from '@/utils/studentImportExport';

type StatusFilter = 'All' | 'Active' | 'Inactive';

type ConfirmState =
  | { type: 'deactivate'; student: Student }
  | { type: 'restore'; student: Student }
  | { type: 'delete'; student: Student }
  | null;

export default function Students() {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');

  const [formOpen, setFormOpen] = useState(false);
  const [editStudent, setEditStudent] = useState<Student | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase.from('students').select('*').order('created_at', { ascending: false });
      if (statusFilter !== 'All') {
        query = query.eq('status', statusFilter);
      }
      const { data, error } = await query;
      if (error) throw error;
      setStudents((data ?? []) as Student[]);
    } catch {
      setError('Failed to load students. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const filtered = students.filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (s.student_id ?? '').toLowerCase().includes(q) ||
      s.full_name.toLowerCase().includes(q) ||
      (s.mobile_number ?? '').toLowerCase().includes(q)
    );
  });

  const handleExport = async () => {
    setExporting(true);
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      exportStudentsToXlsx((data ?? []) as Student[]);
      toast('Student data exported successfully', 'success');
    } catch {
      toast('Failed to export student data', 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleConfirm = async () => {
    if (!confirmState) return;
    setConfirmLoading(true);
    try {
      if (confirmState.type === 'deactivate') {
        const { error } = await supabase
          .from('students')
          .update({ status: 'Inactive' })
          .eq('id', confirmState.student.id);
        if (error) throw error;
        toast('Student deactivated. Historical data is preserved.', 'success');
      } else if (confirmState.type === 'restore') {
        const { error } = await supabase
          .from('students')
          .update({ status: 'Active' })
          .eq('id', confirmState.student.id);
        if (error) throw error;
        toast('Student restored to active status', 'success');
      } else if (confirmState.type === 'delete') {
        const studentId = confirmState.student.id;

        // 1. Fetch enrollment IDs for this student
        const { data: enrollRows, error: enrollFetchErr } = await supabase
          .from('enrollments')
          .select('id')
          .eq('student_id', studentId);
        if (enrollFetchErr) throw enrollFetchErr;
        const enrollmentIds = (enrollRows ?? []).map((e) => e.id);

        // 2. Delete all related records in dependency order
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const deletions: PromiseLike<any>[] = [
          supabase.from('attendance').delete().eq('student_id', studentId),
        ];
        if (enrollmentIds.length > 0) {
          deletions.push(
            supabase.from('fee_payments').delete().in('enrollment_id', enrollmentIds),
            supabase.from('exams').delete().in('enrollment_id', enrollmentIds),
            supabase.from('certificates').delete().in('enrollment_id', enrollmentIds),
          );
        }
        const results = await Promise.all(deletions);
        for (const r of results) {
          if (r.error) throw r.error;
        }

        // 3. Delete enrollments
        if (enrollmentIds.length > 0) {
          const { error } = await supabase
            .from('enrollments')
            .delete()
            .eq('student_id', studentId);
          if (error) throw error;
        }

        // 4. Delete the student
        const { error } = await supabase
          .from('students')
          .delete()
          .eq('id', studentId);
        if (error) throw error;
        toast('Student and all related records permanently deleted', 'success');
      }
      setConfirmState(null);
      fetchStudents();
    } catch {
      toast('Operation failed. Please try again.', 'error');
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleDeleteClick = (student: Student) => {
    setConfirmState({ type: 'delete', student });
  };

  const confirmConfig = (() => {
    if (!confirmState) return null;
    if (confirmState.type === 'delete') {
      return {
        title: 'Delete Student',
        message: 'This will permanently delete this student AND all their records including enrollments, attendance, fee payments, exams, and certificates. This action cannot be undone.',
        confirmLabel: 'Delete Permanently',
        variant: 'danger' as const,
        details: [
          { label: 'Student ID', value: confirmState.student.student_id ?? '—' },
          { label: 'Name', value: confirmState.student.full_name },
        ],
      };
    }
    if (confirmState.type === 'deactivate') {
      return {
        title: 'Deactivate Student',
        message: `Are you sure you want to deactivate ${confirmState.student.full_name}? Historical data including attendance, fees, exams, and certificates will be preserved.`,
        confirmLabel: 'Deactivate',
        variant: 'danger' as const,
        details: [
          { label: 'Student ID', value: confirmState.student.student_id ?? '—' },
          { label: 'Name', value: confirmState.student.full_name },
        ],
      };
    }
    return {
      title: 'Restore Student',
      message: `Are you sure you want to restore ${confirmState.student.full_name} to active status?`,
      confirmLabel: 'Restore',
      variant: 'info' as const,
      details: [
        { label: 'Student ID', value: confirmState.student.student_id ?? '—' },
        { label: 'Name', value: confirmState.student.full_name },
      ],
    };
  })();

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Students</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage student records and profiles</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setImportOpen(true)}
            className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition"
          >
            <Upload className="h-4 w-4" />
            Import
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition disabled:opacity-60"
          >
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Export
          </button>
          <button
            onClick={() => {
              setEditStudent(null);
              setFormOpen(true);
            }}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 transition"
          >
            <Plus className="h-4 w-4" />
            Add Student
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
            placeholder="Search by Student ID, name, or mobile..."
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
              <Users className="h-7 w-7 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-700">No students found</p>
            <p className="text-xs text-slate-400 mt-1">
              {search || statusFilter !== 'All'
                ? 'Try adjusting your search or filters'
                : 'Click "Add Student" to create your first student'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Student ID</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600 hidden md:table-cell">Mobile</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600 hidden lg:table-cell">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600 hidden xl:table-cell">DOB</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600 hidden xl:table-cell">Gender</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600 hidden lg:table-cell">Admission</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                    <td className="px-4 py-3 font-medium text-slate-900">{s.student_id}</td>
                    <td className="px-4 py-3 text-slate-700">{s.full_name}</td>
                    <td className="px-4 py-3 text-slate-600 hidden md:table-cell">{s.mobile_number || '—'}</td>
                    <td className="px-4 py-3 text-slate-600 hidden lg:table-cell">{s.email || '—'}</td>
                    <td className="px-4 py-3 text-slate-600 hidden xl:table-cell">{s.date_of_birth || '—'}</td>
                    <td className="px-4 py-3 text-slate-600 hidden xl:table-cell">{s.gender || '—'}</td>
                    <td className="px-4 py-3 text-slate-600 hidden lg:table-cell">{s.admission_date || '—'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex px-2 py-0.5 rounded-full text-xs font-medium',
                          s.status === 'Active'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-500'
                        )}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => navigate(`/students/${s.id}`)}
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-sky-50 hover:text-sky-600 transition"
                          title="View"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            setEditStudent(s);
                            setFormOpen(true);
                          }}
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-amber-50 hover:text-amber-600 transition"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(s)}
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 transition"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        {s.status === 'Active' ? (
                          <button
                            onClick={() => setConfirmState({ type: 'deactivate', student: s })}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-orange-50 hover:text-orange-600 transition"
                            title="Deactivate"
                          >
                            <Ban className="h-4 w-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => setConfirmState({ type: 'restore', student: s })}
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
          Showing {filtered.length} student{filtered.length !== 1 ? 's' : ''}
        </p>
      )}

      <StudentFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={fetchStudents}
        student={editStudent}
      />

      <ImportStudentsModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onSaved={fetchStudents}
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
