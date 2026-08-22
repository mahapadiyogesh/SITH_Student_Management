import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  CalendarCheck,
  History,
  CalendarRange,
  CalendarDays,
  Loader2,
  AlertCircle,
  Search,
  CheckCheck,
  XCircle,
  Save,
  Trash2,
  Pencil,
  Users,
  TrendingUp,
  Download,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/utils/cn';
import { formatDateDMY, todayStr, getWeekStart, getWeekDates, getWeekDayNames, getMonthName, getMonthDates, calcAttendancePercent } from '@/utils/date';
import type { Student, Attendance as AttendanceType, AttendanceStatus } from '@/types/database';
import ConfirmDialog from '@/components/ConfirmDialog';
import * as XLSX from 'xlsx';

type Tab = 'take' | 'history' | 'weekly' | 'monthly';

export default function Attendance() {
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>('take');
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const { data, error } = await supabase
        .from('attendance')
        .select(`
          *,
          students:student_id ( id, student_id, full_name )
        `)
        .order('attendance_date', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;

      const allRecords = (data ?? []) as AttendanceWithStudent[];

      const headers = [
        'Student ID', 'Student Name', 'Batch',
        'Attendance Date', 'Status', 'Remarks',
      ];

      const rows = allRecords.map((r) => [
        r.students?.student_id ?? '',
        r.students?.full_name ?? '',
        r.batch_name ?? '',
        r.attendance_date ?? '',
        r.status ?? '',
        r.remarks ?? '',
      ]);

      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      ws['!cols'] = [
        { wch: 12 }, { wch: 25 }, { wch: 15 },
        { wch: 14 }, { wch: 12 }, { wch: 20 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
      const today = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `attendance_export_${today}.xlsx`);

      toast('Attendance data exported successfully', 'success');
    } catch {
      toast('Failed to export attendance data', 'error');
    } finally {
      setExporting(false);
    }
  };

  const tabs = [
    { id: 'take' as Tab, label: 'Take Attendance', icon: CalendarCheck },
    { id: 'history' as Tab, label: 'Attendance History', icon: History },
    { id: 'weekly' as Tab, label: 'Weekly Report', icon: CalendarRange },
    { id: 'monthly' as Tab, label: 'Monthly Report', icon: CalendarDays },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Attendance</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage daily attendance and reports</p>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition disabled:opacity-60"
        >
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Export Excel
        </button>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-200">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition',
              tab === t.id
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            )}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'take' && <TakeAttendance />}
      {tab === 'history' && <AttendanceHistory />}
      {tab === 'weekly' && <WeeklyReport />}
      {tab === 'monthly' && <MonthlyReport />}
    </div>
  );
}

// ============================================================
// TAKE ATTENDANCE (student-wise)
// ============================================================
function TakeAttendance() {
  const { toast } = useToast();

  const [attendanceDate, setAttendanceDate] = useState(todayStr());
  const [selectedBatch, setSelectedBatch] = useState('');
  const [availableBatches, setAvailableBatches] = useState<string[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [studentBatches, setStudentBatches] = useState<Record<string, string>>({});
  const [attendanceMap, setAttendanceMap] = useState<Record<string, { status: AttendanceStatus; remarks: string }>>({});
  const [existingAttendance, setExistingAttendance] = useState<Record<string, AttendanceType>>({});
  const [loadingBatches, setLoadingBatches] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  // Load available batches from enrollments
  useEffect(() => {
    async function loadBatches() {
      setLoadingBatches(true);
      const { data } = await supabase
        .from('enrollments')
        .select('batch_name')
        .eq('status', 'Active')
        .not('batch_name', 'is', null);
      const batches = [...new Set((data ?? []).map((d) => d.batch_name).filter(Boolean))] as string[];
      setAvailableBatches(batches.sort());
      setLoadingBatches(false);
    }
    loadBatches();
  }, []);

  // Load students + their batches + existing attendance
  const loadData = useCallback(async () => {
    setLoadingStudents(true);
    try {
      // Load all active students
      const { data: studentData, error } = await supabase
        .from('students')
        .select('*')
        .eq('status', 'Active')
        .order('full_name');

      if (error) throw error;
      const allStudents = (studentData ?? []) as Student[];

      // Load enrollments to get batch info per student
      const { data: enrollData } = await supabase
        .from('enrollments')
        .select('student_id, batch_name')
        .eq('status', 'Active');

      const batchByStudent: Record<string, string> = {};
      (enrollData ?? []).forEach((e) => {
        if (e.batch_name && !batchByStudent[e.student_id]) {
          batchByStudent[e.student_id] = e.batch_name;
        }
      });
      setStudentBatches(batchByStudent);

      // Filter by batch if selected
      let filtered = allStudents;
      if (selectedBatch) {
        filtered = allStudents.filter((s) => batchByStudent[s.id] === selectedBatch);
      }
      setStudents(filtered);

      // Check for existing attendance on this date
      const studentIds = filtered.map((s) => s.id);
      let existing: Record<string, AttendanceType> = {};
      if (studentIds.length > 0) {
        const { data: attData } = await supabase
          .from('attendance')
          .select('*')
          .eq('attendance_date', attendanceDate)
          .in('student_id', studentIds);
        if (attData) {
          existing = (attData as AttendanceType[]).reduce((acc, a) => {
            acc[a.student_id] = a;
            return acc;
          }, {} as Record<string, AttendanceType>);
        }
      }
      setExistingAttendance(existing);

      const hasExisting = Object.keys(existing).length > 0;
      setIsEditMode(hasExisting);

      // Initialize attendance map
      const map: Record<string, { status: AttendanceStatus; remarks: string }> = {};
      for (const s of filtered) {
        const ex = existing[s.id];
        map[s.id] = {
          status: (ex?.status as AttendanceStatus) ?? 'Present',
          remarks: ex?.remarks ?? '',
        };
      }
      setAttendanceMap(map);

      if (hasExisting) {
        toast('Attendance for this date already exists. You can update it.', 'info');
      }
    } catch {
      toast('Failed to load students', 'error');
    } finally {
      setLoadingStudents(false);
    }
  }, [attendanceDate, selectedBatch, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const markAll = (status: AttendanceStatus) => {
    const map: Record<string, { status: AttendanceStatus; remarks: string }> = {};
    for (const s of students) {
      map[s.id] = { status, remarks: attendanceMap[s.id]?.remarks ?? '' };
    }
    setAttendanceMap(map);
  };

  const setStatus = (studentId: string, status: AttendanceStatus) => {
    setAttendanceMap((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], status },
    }));
  };

  const setRemarks = (studentId: string, remarks: string) => {
    setAttendanceMap((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], remarks },
    }));
  };

  const handleSave = async () => {
    if (students.length === 0) {
      toast('No students to mark attendance for', 'error');
      return;
    }
    setSaving(true);
    try {
      const records = students.map((s) => {
        const a = attendanceMap[s.id];
        const existing = existingAttendance[s.id];
        return {
          ...(existing ? { id: existing.id } : {}),
          student_id: s.id,
          enrollment_id: null,
          attendance_date: attendanceDate,
          status: a.status,
          remarks: a.remarks || null,
          batch_name: studentBatches[s.id] ?? null,
        };
      });

      const { error } = await supabase
        .from('attendance')
        .upsert(records, { onConflict: 'student_id,attendance_date' });

      if (error) throw error;
      toast(isEditMode ? 'Attendance updated successfully' : 'Attendance saved successfully', 'success');
      await loadData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save attendance';
      toast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const presentCount = Object.values(attendanceMap).filter((a) => a.status === 'Present').length;
  const absentCount = Object.values(attendanceMap).filter((a) => a.status === 'Absent').length;

  return (
    <div className="space-y-4">
      {/* Selectors */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Attendance Date *</label>
            <input
              type="date"
              value={attendanceDate}
              onChange={(e) => setAttendanceDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Batch (Optional)</label>
            <select
              value={selectedBatch}
              onChange={(e) => setSelectedBatch(e.target.value)}
              disabled={loadingBatches}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition bg-white disabled:bg-slate-50"
            >
              <option value="">All Active Students</option>
              {availableBatches.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {isEditMode && (
        <div className="flex items-center gap-2 bg-sky-50 border border-sky-200 rounded-lg px-4 py-2.5 text-sky-700 text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          Attendance for this date already exists. You can update it.
        </div>
      )}

      {/* Attendance table */}
      {loadingStudents ? (
        <div className="flex items-center justify-center py-16 bg-white rounded-xl border border-slate-200">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : students.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-slate-200">
          <div className="w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
            <Users className="h-7 w-7 text-slate-400" />
          </div>
          <p className="text-sm font-medium text-slate-700">
            {selectedBatch ? 'No active students in this batch' : 'No active students found'}
          </p>
        </div>
      ) : (
        <>
          {/* Summary bar */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2 text-sm">
              <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-medium">{presentCount} Present</span>
              <span className="px-2.5 py-1 rounded-full bg-red-50 text-red-700 font-medium">{absentCount} Absent</span>
              <span className="text-slate-400">Date: {formatDateDMY(attendanceDate)}</span>
            </div>
            <div className="flex gap-2 ml-auto">
              <button
                onClick={() => markAll('Present')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition"
              >
                <CheckCheck className="h-4 w-4" />
                Mark All Present
              </button>
              <button
                onClick={() => markAll('Absent')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 transition"
              >
                <XCircle className="h-4 w-4" />
                Mark All Absent
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Student ID</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Student Name</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600 hidden md:table-cell">Batch</th>
                    <th className="text-center px-4 py-3 font-medium text-slate-600">Present</th>
                    <th className="text-center px-4 py-3 font-medium text-slate-600">Absent</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600 hidden md:table-cell">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => {
                    const att = attendanceMap[s.id];
                    return (
                      <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                        <td className="px-4 py-3 font-medium text-slate-900">{s.student_id}</td>
                        <td className="px-4 py-3 text-slate-700">{s.full_name}</td>
                        <td className="px-4 py-3 text-slate-600 hidden md:table-cell">{studentBatches[s.id] ?? '—'}</td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => setStatus(s.id, 'Present')}
                            className={cn(
                              'w-7 h-7 rounded-full border-2 transition flex items-center justify-center',
                              att?.status === 'Present'
                                ? 'bg-emerald-500 border-emerald-500 text-white'
                                : 'border-slate-300 hover:border-emerald-400'
                            )}
                          >
                            {att?.status === 'Present' && <CheckCheck className="h-4 w-4" />}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => setStatus(s.id, 'Absent')}
                            className={cn(
                              'w-7 h-7 rounded-full border-2 transition flex items-center justify-center',
                              att?.status === 'Absent'
                                ? 'bg-red-500 border-red-500 text-white'
                                : 'border-slate-300 hover:border-red-400'
                            )}
                          >
                            {att?.status === 'Absent' && <XCircle className="h-4 w-4" />}
                          </button>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <input
                            type="text"
                            value={att?.remarks ?? ''}
                            onChange={(ev) => setRemarks(s.id, ev.target.value)}
                            placeholder="Optional remarks"
                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 transition disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isEditMode ? 'Update Attendance' : 'Save Attendance'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================
// ATTENDANCE HISTORY (student-wise)
// ============================================================
interface AttendanceWithStudent extends AttendanceType {
  students: Pick<Student, 'id' | 'student_id' | 'full_name'> | null;
}

function AttendanceHistory() {
  const { toast } = useToast();
  const [records, setRecords] = useState<AttendanceWithStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterBatch, setFilterBatch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'All' | 'Present' | 'Absent'>('All');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [availableBatches, setAvailableBatches] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const [editRecord, setEditRecord] = useState<AttendanceWithStudent | null>(null);
  const [editStatus, setEditStatus] = useState<AttendanceStatus>('Present');
  const [editRemarks, setEditRemarks] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  const [deleteRecord, setDeleteRecord] = useState<AttendanceWithStudent | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    supabase
      .from('attendance')
      .select('batch_name')
      .not('batch_name', 'is', null)
      .then(({ data }) => {
        const batches = [...new Set((data ?? []).map((d) => d.batch_name).filter(Boolean))] as string[];
        setAvailableBatches(batches.sort());
      });
  }, []);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('attendance')
        .select(`
          *,
          students:student_id ( id, student_id, full_name )
        `)
        .order('attendance_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (filterStatus !== 'All') {
        query = query.eq('status', filterStatus);
      }
      if (fromDate) query = query.gte('attendance_date', fromDate);
      if (toDate) query = query.lte('attendance_date', toDate);
      if (filterBatch) query = query.eq('batch_name', filterBatch);

      const { data, error } = await query;
      if (error) throw error;

      let filtered = (data ?? []) as AttendanceWithStudent[];

      if (search.trim()) {
        const q = search.toLowerCase();
        filtered = filtered.filter(
          (r) =>
            (r.students?.student_id ?? '').toLowerCase().includes(q) ||
            (r.students?.full_name ?? '').toLowerCase().includes(q)
        );
      }

      setRecords(filtered);
      setPage(0);
    } catch {
      toast('Failed to load attendance history', 'error');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, fromDate, toDate, filterBatch, search, toast]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const pagedRecords = records.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(records.length / pageSize);

  const handleEdit = (record: AttendanceWithStudent) => {
    setEditRecord(record);
    setEditStatus(record.status as AttendanceStatus);
    setEditRemarks(record.remarks ?? '');
    setEditOpen(true);
  };

  const handleEditSave = async () => {
    if (!editRecord) return;
    setEditSaving(true);
    try {
      const { error } = await supabase
        .from('attendance')
        .update({ status: editStatus, remarks: editRemarks || null })
        .eq('id', editRecord.id);
      if (error) throw error;
      toast('Attendance updated successfully', 'success');
      setEditOpen(false);
      fetchRecords();
    } catch {
      toast('Failed to update attendance', 'error');
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteRecord) return;
    setDeleteLoading(true);
    try {
      const { error } = await supabase.from('attendance').delete().eq('id', deleteRecord.id);
      if (error) throw error;
      toast('Attendance record deleted', 'success');
      setDeleteRecord(null);
      fetchRecords();
    } catch {
      toast('Failed to delete attendance', 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Student ID or Name..."
              className="w-full pl-10 pr-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition"
            />
          </div>
          <select
            value={filterBatch}
            onChange={(e) => setFilterBatch(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition bg-white"
          >
            <option value="">All Batches</option>
            {availableBatches.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as 'All' | 'Present' | 'Absent')}
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition bg-white"
          >
            <option value="All">All Status</option>
            <option value="Present">Present</option>
            <option value="Absent">Absent</option>
          </select>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-500 whitespace-nowrap">From:</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-500 whitespace-nowrap">To:</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition"
            />
          </div>
          {(search || filterBatch || filterStatus !== 'All' || fromDate || toDate) && (
            <button
              onClick={() => { setSearch(''); setFilterBatch(''); setFilterStatus('All'); setFromDate(''); setToDate(''); }}
              className="px-3 py-2 rounded-lg text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : pagedRecords.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
              <History className="h-7 w-7 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-700">No attendance records found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Student ID</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600 hidden md:table-cell">Batch</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600 hidden xl:table-cell">Remarks</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedRecords.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDateDMY(r.attendance_date)}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{r.students?.student_id ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-700">{r.students?.full_name ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600 hidden md:table-cell">{r.batch_name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'inline-flex px-2 py-0.5 rounded-full text-xs font-medium',
                        r.status === 'Present' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                      )}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 hidden xl:table-cell max-w-[150px] truncate">{r.remarks || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleEdit(r)}
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-amber-50 hover:text-amber-600 transition"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteRecord(r)}
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 transition"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
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

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 transition disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-slate-500">Page {page + 1} of {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 transition disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}

      {records.length > 0 && (
        <p className="text-xs text-slate-400 text-center">
          Showing {pagedRecords.length} of {records.length} records
        </p>
      )}

      {/* Edit Modal */}
      {editOpen && editRecord && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto">
          <div className="fixed inset-0 bg-slate-900/50" onClick={() => setEditOpen(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md my-8">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">Edit Attendance</h2>
              <p className="text-sm text-slate-500 mt-0.5">
                {editRecord.students?.full_name} — {formatDateDMY(editRecord.attendance_date)}
              </p>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Status</label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setEditStatus('Present')}
                    className={cn(
                      'flex-1 py-2.5 rounded-lg text-sm font-medium transition',
                      editStatus === 'Present' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    )}
                  >
                    Present
                  </button>
                  <button
                    onClick={() => setEditStatus('Absent')}
                    className={cn(
                      'flex-1 py-2.5 rounded-lg text-sm font-medium transition',
                      editStatus === 'Absent' ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    )}
                  >
                    Absent
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Remarks</label>
                <input
                  type="text"
                  value={editRemarks}
                  onChange={(e) => setEditRemarks(e.target.value)}
                  placeholder="Optional remarks"
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
              <button
                onClick={() => setEditOpen(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleEditSave}
                disabled={editSaving}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 transition disabled:opacity-60 flex items-center gap-2"
              >
                {editSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                Update
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteRecord}
        onClose={() => setDeleteRecord(null)}
        onConfirm={handleDelete}
        title="Delete Attendance"
        message={`Are you sure you want to delete attendance for ${deleteRecord?.students?.full_name ?? 'this student'} on ${formatDateDMY(deleteRecord?.attendance_date)}? This will only remove the attendance record.`}
        confirmLabel="Delete"
        loading={deleteLoading}
        variant="danger"
      />
    </div>
  );
}

// ============================================================
// WEEKLY REPORT (student-wise, no course)
// ============================================================
function WeeklyReport() {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [weekStart, setWeekStart] = useState(getWeekStart(todayStr()));
  const [report, setReport] = useState<{ dayName: string; date: string; status: string | null }[] | null>(null);
  const [studentBatch, setStudentBatch] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from('students').select('*').eq('status', 'Active').order('full_name').then(({ data }) => {
      setStudents((data ?? []) as Student[]);
    });
  }, []);

  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);
  const dayNames = getWeekDayNames();

  const generateReport = useCallback(async () => {
    if (!selectedStudentId) return;
    setLoading(true);
    try {
      // Get student's batch from enrollments
      const { data: enrollments } = await supabase
        .from('enrollments')
        .select('batch_name')
        .eq('student_id', selectedStudentId)
        .eq('status', 'Active')
        .not('batch_name', 'is', null)
        .limit(1);
      setStudentBatch(enrollments?.[0]?.batch_name ?? '');

      const { data: attendance } = await supabase
        .from('attendance')
        .select('attendance_date, status')
        .eq('student_id', selectedStudentId)
        .gte('attendance_date', weekDates[0])
        .lte('attendance_date', weekDates[6]);

      const attMap: Record<string, string> = {};
      (attendance ?? []).forEach((a) => {
        attMap[a.attendance_date] = a.status;
      });

      const result = weekDates.map((date, i) => ({
        dayName: dayNames[i],
        date,
        status: attMap[date] ?? null,
      }));
      setReport(result);
    } catch {
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [selectedStudentId, weekDates, dayNames]);

  useEffect(() => {
    if (selectedStudentId) {
      generateReport();
    } else {
      setReport(null);
      setStudentBatch('');
    }
  }, [selectedStudentId, weekStart, generateReport]);

  const presentCount = report?.filter((d) => d.status === 'Present').length ?? 0;
  const absentCount = report?.filter((d) => d.status === 'Absent').length ?? 0;
  const totalDays = report?.filter((d) => d.status !== null).length ?? 0;
  const percentage = calcAttendancePercent(presentCount, totalDays);

  const selectedStudent = students.find((s) => s.id === selectedStudentId);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Student</label>
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition bg-white"
            >
              <option value="">Select student</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>{s.student_id} - {s.full_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Week Starting</label>
            <input
              type="date"
              value={weekStart}
              onChange={(e) => setWeekStart(getWeekStart(e.target.value))}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={() => setWeekStart(getWeekStart(todayStr()))}
              className="px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition w-full"
            >
              Current Week
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 bg-white rounded-xl border border-slate-200">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : !selectedStudentId ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-slate-200">
          <div className="w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
            <CalendarRange className="h-7 w-7 text-slate-400" />
          </div>
          <p className="text-sm font-medium text-slate-700">Select a student to view weekly report</p>
        </div>
      ) : !report || totalDays === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-slate-200">
          <div className="w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
            <CalendarRange className="h-7 w-7 text-slate-400" />
          </div>
          <p className="text-sm font-medium text-slate-700">No attendance records for this week</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-400">Total Days</p>
              <p className="text-2xl font-bold text-slate-900 tabular-nums">{totalDays}</p>
            </div>
            <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4">
              <p className="text-xs text-emerald-600">Present</p>
              <p className="text-2xl font-bold text-emerald-700 tabular-nums">{presentCount}</p>
            </div>
            <div className="bg-red-50 rounded-xl border border-red-200 p-4">
              <p className="text-xs text-red-600">Absent</p>
              <p className="text-2xl font-bold text-red-700 tabular-nums">{absentCount}</p>
            </div>
            <div className="bg-slate-900 rounded-xl p-4 text-white">
              <p className="text-xs text-slate-300">Attendance %</p>
              <p className="text-2xl font-bold tabular-nums">{percentage}%</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-sm text-slate-500 mb-3">
              <span className="font-medium text-slate-700">{selectedStudent?.full_name}</span>
              {studentBatch && <span className="ml-2 text-slate-400">Batch: {studentBatch}</span>}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Day</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Date</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {report.map((d) => (
                    <tr key={d.date} className="border-b border-slate-100 hover:bg-slate-50 transition">
                      <td className="px-4 py-3 font-medium text-slate-900">{d.dayName}</td>
                      <td className="px-4 py-3 text-slate-600">{formatDateDMY(d.date)}</td>
                      <td className="px-4 py-3">
                        {d.status ? (
                          <span className={cn(
                            'inline-flex px-2 py-0.5 rounded-full text-xs font-medium',
                            d.status === 'Present' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                          )}>
                            {d.status}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">No record</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================
// MONTHLY REPORT (student-wise, no course)
// ============================================================
function MonthlyReport() {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [report, setReport] = useState<{ date: string; status: string }[] | null>(null);
  const [studentBatch, setStudentBatch] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from('students').select('*').eq('status', 'Active').order('full_name').then(({ data }) => {
      setStudents((data ?? []) as Student[]);
    });
  }, []);

  const monthDates = useMemo(() => getMonthDates(year, month), [year, month]);

  const generateReport = useCallback(async () => {
    if (!selectedStudentId) return;
    setLoading(true);
    try {
      const { data: enrollments } = await supabase
        .from('enrollments')
        .select('batch_name')
        .eq('student_id', selectedStudentId)
        .eq('status', 'Active')
        .not('batch_name', 'is', null)
        .limit(1);
      setStudentBatch(enrollments?.[0]?.batch_name ?? '');

      const { data: attendance } = await supabase
        .from('attendance')
        .select('attendance_date, status')
        .eq('student_id', selectedStudentId)
        .gte('attendance_date', monthDates[0])
        .lte('attendance_date', monthDates[monthDates.length - 1]);

      const attMap: Record<string, string> = {};
      (attendance ?? []).forEach((a) => {
        attMap[a.attendance_date] = a.status;
      });

      const result = monthDates
        .filter((date) => attMap[date])
        .map((date) => ({ date, status: attMap[date] }));
      setReport(result);
    } catch {
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [selectedStudentId, monthDates]);

  useEffect(() => {
    if (selectedStudentId) {
      generateReport();
    } else {
      setReport(null);
      setStudentBatch('');
    }
  }, [selectedStudentId, month, year, generateReport]);

  const presentCount = report?.filter((d) => d.status === 'Present').length ?? 0;
  const absentCount = report?.filter((d) => d.status === 'Absent').length ?? 0;
  const totalDays = report?.length ?? 0;
  const percentage = calcAttendancePercent(presentCount, totalDays);

  const selectedStudent = students.find((s) => s.id === selectedStudentId);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Student</label>
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition bg-white"
            >
              <option value="">Select student</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>{s.student_id} - {s.full_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Month</label>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition bg-white"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>{getMonthName(m)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Year</label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 bg-white rounded-xl border border-slate-200">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : !selectedStudentId ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-slate-200">
          <div className="w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
            <CalendarDays className="h-7 w-7 text-slate-400" />
          </div>
          <p className="text-sm font-medium text-slate-700">Select a student to view monthly report</p>
        </div>
      ) : !report || totalDays === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-slate-200">
          <div className="w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
            <CalendarDays className="h-7 w-7 text-slate-400" />
          </div>
          <p className="text-sm font-medium text-slate-700">No attendance records for {getMonthName(month)} {year}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-400">Total Days</p>
              <p className="text-2xl font-bold text-slate-900 tabular-nums">{totalDays}</p>
            </div>
            <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4">
              <p className="text-xs text-emerald-600">Present</p>
              <p className="text-2xl font-bold text-emerald-700 tabular-nums">{presentCount}</p>
            </div>
            <div className="bg-red-50 rounded-xl border border-red-200 p-4">
              <p className="text-xs text-red-600">Absent</p>
              <p className="text-2xl font-bold text-red-700 tabular-nums">{absentCount}</p>
            </div>
            <div className="bg-slate-900 rounded-xl p-4 text-white">
              <p className="text-xs text-slate-300">Attendance %</p>
              <p className="text-2xl font-bold tabular-nums">{percentage}%</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-sm text-slate-500">
              <span className="font-medium text-slate-700">{selectedStudent?.full_name}</span>
              {studentBatch && <span className="ml-2 text-slate-400">Batch: {studentBatch}</span>}
              <span className="ml-2 text-slate-400">{getMonthName(month)} {year}</span>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Date</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {report.map((d) => (
                    <tr key={d.date} className="border-b border-slate-100 hover:bg-slate-50 transition">
                      <td className="px-4 py-3 text-slate-600">{formatDateDMY(d.date)}</td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          'inline-flex px-2 py-0.5 rounded-full text-xs font-medium',
                          d.status === 'Present' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                        )}>
                          {d.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
