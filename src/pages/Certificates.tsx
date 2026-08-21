import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Plus, Search, Loader2, Award, AlertCircle, Eye, Edit2, Trash2,
  X, Filter, CheckCircle, XCircle, Send,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/utils/cn';
import { formatDateDMY, todayStr } from '@/utils/date';
import type { Certificate, CertificateStatus } from '@/types/database';
import CertificateFormModal from '@/components/CertificateFormModal';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';

// ---------- Types ----------

interface CertWithDetails extends Certificate {
  enrollments: {
    id: string;
    batch_name: string | null;
    joining_date: string | null;
    students: { id: string; student_id: string | null; full_name: string } | null;
    courses: { id: string; course_name: string; course_code: string | null } | null;
  } | null;
}

type StatusFilter = 'All' | CertificateStatus;
type ActionType = 'delete' | 'cancel' | 'issue' | null;
interface ActionState { type: ActionType; cert: CertWithDetails }

// ---------- Constants ----------

const STATUS_COLORS: Record<string, string> = {
  Ready: 'bg-amber-50 text-amber-700',
  Issued: 'bg-emerald-50 text-emerald-700',
  Cancelled: 'bg-red-50 text-red-700',
};

const STATUS_FILTERS: StatusFilter[] = ['All', 'Ready', 'Issued', 'Cancelled'];

// ---------- Component ----------

export default function Certificates() {
  const { toast } = useToast();

  const [certs, setCerts] = useState<CertWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [courseFilter, setCourseFilter] = useState('');
  const [batchFilter, setBatchFilter] = useState('');

  // Modal state
  const [formOpen, setFormOpen] = useState(false);
  const [editCert, setEditCert] = useState<Certificate | null>(null);
  const [viewCert, setViewCert] = useState<CertWithDetails | null>(null);
  const [action, setAction] = useState<ActionState | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [issueDate, setIssueDate] = useState(todayStr());

  // ---------- Data ----------

  const fetchCerts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('certificates')
        .select(`
          *,
          enrollments!inner (
            id, batch_name, joining_date,
            students:student_id ( id, student_id, full_name ),
            courses:course_id ( id, course_name, course_code )
          )
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setCerts((data ?? []) as CertWithDetails[]);
    } catch {
      setError('Failed to load certificates. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCerts(); }, [fetchCerts]);

  // Filter options
  const { courseOptions, batchOptions } = useMemo(() => {
    const courses = new Map<string, string>();
    const batches = new Set<string>();
    for (const cert of certs) {
      const c = cert.enrollments?.courses;
      if (c) courses.set(c.id, c.course_name);
      const b = cert.enrollments?.batch_name;
      if (b) batches.add(b);
    }
    return {
      courseOptions: Array.from(courses.entries()).map(([id, name]) => ({ id, name })),
      batchOptions: Array.from(batches).sort(),
    };
  }, [certs]);

  // Filtering
  const filtered = useMemo(() => {
    return certs.filter((cert) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        const certNum = (cert.certificate_number ?? '').toLowerCase();
        const studentName = cert.enrollments?.students?.full_name?.toLowerCase() ?? '';
        const studentId = cert.enrollments?.students?.student_id?.toLowerCase() ?? '';
        if (!certNum.includes(q) && !studentName.includes(q) && !studentId.includes(q)) return false;
      }
      if (statusFilter !== 'All' && cert.status !== statusFilter) return false;
      if (courseFilter && cert.enrollments?.courses?.id !== courseFilter) return false;
      if (batchFilter && cert.enrollments?.batch_name !== batchFilter) return false;
      return true;
    });
  }, [certs, search, statusFilter, courseFilter, batchFilter]);

  // ---------- Actions ----------

  const handleEdit = (cert: CertWithDetails) => {
    const { enrollments: _enr, ...rest } = cert;
    setEditCert(rest as Certificate);
    setFormOpen(true);
  };

  const handleIssueClick = (cert: CertWithDetails) => {
    setIssueDate(todayStr());
    setAction({ type: 'issue', cert });
  };

  const handleConfirmAction = async () => {
    if (!action) return;
    setConfirmLoading(true);
    try {
      if (action.type === 'delete') {
        const { error } = await supabase.from('certificates').delete().eq('id', action.cert.id);
        if (error) throw error;
        toast('Certificate deleted permanently', 'success');
      } else if (action.type === 'cancel') {
        const { error } = await supabase.from('certificates').update({ status: 'Cancelled' }).eq('id', action.cert.id);
        if (error) throw error;
        toast('Certificate cancelled. Record preserved in history.', 'success');
      } else if (action.type === 'issue') {
        const { error } = await supabase
          .from('certificates')
          .update({ status: 'Issued', issue_date: issueDate })
          .eq('id', action.cert.id);
        if (error) throw error;
        toast('Certificate issued successfully', 'success');
      }
      setAction(null);
      fetchCerts();
    } catch {
      toast('Operation failed. Please try again.', 'error');
    } finally {
      setConfirmLoading(false);
    }
  };

  const clearFilters = () => {
    setSearch(''); setStatusFilter('All'); setCourseFilter(''); setBatchFilter('');
  };

  const hasActiveFilters = search !== '' || statusFilter !== 'All' || courseFilter !== '' || batchFilter !== '';

  // ---------- Render ----------

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Certificates</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage student course certificates</p>
        </div>
        <button onClick={() => { setEditCert(null); setFormOpen(true); }}
          className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 transition">
          <Plus className="h-4 w-4" /> Add Certificate
        </button>
      </div>

      {/* Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by certificate number, student name, or ID..."
            className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition" />
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((f) => (
            <button key={f} onClick={() => setStatusFilter(f)}
              className={cn(
                'px-3 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap',
                statusFilter === f ? 'bg-slate-900 text-white' : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50'
              )}>
              {f}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 text-slate-300 mx-1">|</div>
        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-slate-400" />
          <select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)}
            className="px-2.5 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent">
            <option value="">All Courses</option>
            {courseOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={batchFilter} onChange={(e) => setBatchFilter(e.target.value)}
            className="px-2.5 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent">
            <option value="">All Batches</option>
            {batchOptions.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          {hasActiveFilters && (
            <button onClick={clearFilters}
              className="flex items-center gap-1 px-2.5 py-2 rounded-lg text-sm font-medium text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 transition">
              <X className="h-3.5 w-3.5" /> Clear
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
              <Award className="h-7 w-7 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-700">No certificates found</p>
            <p className="text-xs text-slate-400 mt-1">
              {hasActiveFilters ? 'Try adjusting your search or filters' : 'Click "Add Certificate" to create one'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Certificate #</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Student</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600 hidden md:table-cell">Student ID</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Course</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600 hidden md:table-cell">Batch</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600 hidden lg:table-cell">Month</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600 hidden sm:table-cell">Issue Date</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((cert) => {
                  const student = cert.enrollments?.students;
                  const course = cert.enrollments?.courses;
                  return (
                    <tr key={cert.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                      <td className="px-4 py-3 font-mono text-xs font-medium text-slate-800">
                        {cert.certificate_number ?? '—'}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">{student?.full_name ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-600 hidden md:table-cell">{student?.student_id ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-700">
                        {course?.course_name ?? '—'}
                        {course?.course_code && <span className="text-xs text-slate-400 ml-1">({course.course_code})</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-600 hidden md:table-cell">{cert.enrollments?.batch_name || '—'}</td>
                      <td className="px-4 py-3 text-slate-600 hidden lg:table-cell">{cert.certificate_month || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-medium', STATUS_COLORS[cert.status] ?? STATUS_COLORS.Ready)}>
                          {cert.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 hidden sm:table-cell">{formatDateDMY(cert.issue_date)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setViewCert(cert)}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-sky-50 hover:text-sky-600 transition" title="View">
                            <Eye className="h-4 w-4" />
                          </button>
                          {cert.status === 'Ready' && (
                            <>
                              <button onClick={() => handleEdit(cert)}
                                className="p-1.5 rounded-lg text-slate-500 hover:bg-amber-50 hover:text-amber-600 transition" title="Edit">
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button onClick={() => handleIssueClick(cert)}
                                className="p-1.5 rounded-lg text-slate-500 hover:bg-emerald-50 hover:text-emerald-600 transition" title="Issue">
                                <Send className="h-4 w-4" />
                              </button>
                            </>
                          )}
                          {cert.status !== 'Cancelled' && (
                            <button onClick={() => setAction({ type: 'cancel', cert })}
                              className="p-1.5 rounded-lg text-slate-500 hover:bg-orange-50 hover:text-orange-600 transition" title="Cancel">
                              <XCircle className="h-4 w-4" />
                            </button>
                          )}
                          {cert.status === 'Ready' && (
                            <button onClick={() => setAction({ type: 'delete', cert })}
                              className="p-1.5 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 transition" title="Delete">
                              <Trash2 className="h-4 w-4" />
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
          Showing {filtered.length} certificate{filtered.length !== 1 ? 's' : ''}
        </p>
      )}

      {/* Form Modal */}
      <CertificateFormModal
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditCert(null); }}
        onSaved={() => { fetchCerts(); toast('Certificate list updated', 'info'); }}
        certificate={editCert}
      />

      {/* View Details Modal */}
      <Modal open={!!viewCert} onClose={() => setViewCert(null)} title="Certificate Details" size="md">
        {viewCert && (() => {
          const student = viewCert.enrollments?.students;
          const course = viewCert.enrollments?.courses;
          return (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Certificate Number</p>
                  <p className="text-sm font-mono font-medium text-slate-900">{viewCert.certificate_number ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Status</p>
                  <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-medium', STATUS_COLORS[viewCert.status] ?? STATUS_COLORS.Ready)}>
                    {viewCert.status}
                  </span>
                </div>
              </div>
              <div className="border-t border-slate-200 pt-4 grid grid-cols-2 gap-4">
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
                  <p className="text-sm font-medium text-slate-900">{viewCert.enrollments?.batch_name || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Certificate Month</p>
                  <p className="text-sm font-medium text-slate-900">{viewCert.certificate_month || '—'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Issue Date</p>
                  <p className="text-sm font-medium text-slate-900">{formatDateDMY(viewCert.issue_date)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Created</p>
                  <p className="text-sm font-medium text-slate-900">{formatDateDMY(viewCert.created_at)}</p>
                </div>
              </div>
              {viewCert.remarks && (
                <div>
                  <p className="text-xs text-slate-400 mb-1">Remarks</p>
                  <p className="text-sm text-slate-700 bg-slate-50 rounded-lg border border-slate-200 px-3 py-2">{viewCert.remarks}</p>
                </div>
              )}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                {viewCert.status === 'Ready' && (
                  <button onClick={() => { handleEdit(viewCert); setViewCert(null); }}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition">
                    <Edit2 className="h-4 w-4" /> Edit
                  </button>
                )}
                {viewCert.status === 'Ready' && (
                  <button onClick={() => { handleIssueClick(viewCert); setViewCert(null); }}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition">
                    <Send className="h-4 w-4" /> Issue
                  </button>
                )}
                <button onClick={() => setViewCert(null)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition">
                  Close
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Action Confirmation Dialogs */}
      {action?.type === 'issue' && (
        <Modal open={true} onClose={() => setAction(null)} title="Issue Certificate" size="sm">
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-lg border border-slate-200 p-4 space-y-2">
              <div className="flex items-baseline gap-2 text-sm">
                <span className="text-slate-400 font-medium w-28 flex-shrink-0">Certificate:</span>
                <span className="font-mono font-medium text-slate-900">{action.cert.certificate_number}</span>
              </div>
              <div className="flex items-baseline gap-2 text-sm">
                <span className="text-slate-400 font-medium w-28 flex-shrink-0">Student:</span>
                <span className="text-slate-900 font-medium">{action.cert.enrollments?.students?.full_name ?? '—'}</span>
              </div>
              <div className="flex items-baseline gap-2 text-sm">
                <span className="text-slate-400 font-medium w-28 flex-shrink-0">Course:</span>
                <span className="text-slate-900 font-medium">{action.cert.enrollments?.courses?.course_name ?? '—'}</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Issue Date <span className="text-red-500">*</span>
              </label>
              <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent" />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setAction(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition">
                Cancel
              </button>
              <button onClick={handleConfirmAction} disabled={confirmLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 transition disabled:opacity-60">
                {confirmLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                <CheckCircle className="h-4 w-4" /> Issue Certificate
              </button>
            </div>
          </div>
        </Modal>
      )}

      {action?.type === 'delete' && (
        <ConfirmDialog
          open={true}
          onClose={() => setAction(null)}
          onConfirm={handleConfirmAction}
          title="Delete Certificate"
          message="This action permanently deletes this certificate record and cannot be undone."
          confirmLabel="Delete Permanently"
          variant="danger"
          details={[
            { label: 'Certificate', value: action.cert.certificate_number ?? '—' },
            { label: 'Student', value: action.cert.enrollments?.students?.full_name ?? '—' },
            { label: 'Student ID', value: action.cert.enrollments?.students?.student_id ?? '—' },
          ]}
          loading={confirmLoading}
        />
      )}

      {action?.type === 'cancel' && (
        <ConfirmDialog
          open={true}
          onClose={() => setAction(null)}
          onConfirm={handleConfirmAction}
          title="Cancel Certificate"
          message="Are you sure you want to cancel this certificate? The record will be preserved in history."
          confirmLabel="Cancel Certificate"
          variant="warning"
          details={[
            { label: 'Certificate', value: action.cert.certificate_number ?? '—' },
            { label: 'Student', value: action.cert.enrollments?.students?.full_name ?? '—' },
            { label: 'Course', value: action.cert.enrollments?.courses?.course_name ?? '—' },
          ]}
          loading={confirmLoading}
        />
      )}
    </div>
  );
}
