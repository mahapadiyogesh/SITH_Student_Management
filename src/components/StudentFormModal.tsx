import { useEffect, useState, type FormEvent } from 'react';
import { Loader2, User, Hash, GraduationCap } from 'lucide-react';
import Modal from '@/components/Modal';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/useToast';
import type { Student, StudentStatus, Course } from '@/types/database';

interface StudentFormModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  student?: Student | null;
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function formatINR(n: number): string {
  return `₹${n.toLocaleString('en-IN')}`;
}

export default function StudentFormModal({ open, onClose, onSaved, student }: StudentFormModalProps) {
  const { toast } = useToast();
  const isEdit = !!student;

  const [fullName, setFullName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [email, setEmail] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState('');
  const [address, setAddress] = useState('');
  const [admissionDate, setAdmissionDate] = useState(todayStr());
  const [status, setStatus] = useState<StudentStatus>('Active');
  const [generatedId, setGeneratedId] = useState('');
  const [loading, setLoading] = useState(false);
  const [idLoading, setIdLoading] = useState(false);

  // Optional enrollment fields (new student only)
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollCourseId, setEnrollCourseId] = useState('');
  const [enrollBatch, setEnrollBatch] = useState('');
  const [enrollJoiningDate, setEnrollJoiningDate] = useState(todayStr());
  const [enrollDefaultFees, setEnrollDefaultFees] = useState(0);
  const [enrollDiscount, setEnrollDiscount] = useState('');
  const [enrollFinalFees, setEnrollFinalFees] = useState('');

  useEffect(() => {
    if (open) {
      if (student) {
        setFullName(student.full_name);
        setMobileNumber(student.mobile_number ?? '');
        setEmail(student.email ?? '');
        setDateOfBirth(student.date_of_birth ?? '');
        setGender(student.gender ?? '');
        setAddress(student.address ?? '');
        setAdmissionDate(student.admission_date ?? todayStr());
        setStatus(student.status);
        setGeneratedId(student.student_id ?? '');
      } else {
        setFullName('');
        setMobileNumber('');
        setEmail('');
        setDateOfBirth('');
        setGender('');
        setAddress('');
        setAdmissionDate(todayStr());
        setStatus('Active');
        setGeneratedId('');
        generateStudentId();
        // Reset enrollment fields
        setEnrollCourseId('');
        setEnrollBatch('');
        setEnrollJoiningDate(todayStr());
        setEnrollDefaultFees(0);
        setEnrollDiscount('');
        setEnrollFinalFees('');
        // Load active courses for optional enrollment
        loadCourses();
      }
    }
  }, [open, student]);

  async function loadCourses() {
    try {
      const { data } = await supabase
        .from('courses')
        .select('*')
        .eq('status', 'Active')
        .order('course_name');
      setCourses((data ?? []) as Course[]);
    } catch {
      // Non-critical: enrollment section is optional
    }
  }

  // When course is selected for enrollment, auto-load fees and sync joining date
  useEffect(() => {
    if (enrollCourseId) {
      const course = courses.find((c) => c.id === enrollCourseId);
      if (course) {
        setEnrollDefaultFees(course.default_fees);
        const disc = Number(enrollDiscount) || 0;
        setEnrollFinalFees(String(Math.max(0, course.default_fees - disc)));
      }
    } else {
      setEnrollDefaultFees(0);
      setEnrollFinalFees('');
    }
  }, [enrollCourseId, courses]);

  // Sync joining date with admission date when admission date changes (new student)
  useEffect(() => {
    if (!isEdit && !enrollCourseId) {
      setEnrollJoiningDate(admissionDate);
    }
  }, [admissionDate, isEdit, enrollCourseId]);

  // Auto-calculate final fees when discount changes
  useEffect(() => {
    if (enrollCourseId && enrollDefaultFees > 0) {
      const disc = Number(enrollDiscount) || 0;
      setEnrollFinalFees(String(Math.max(0, enrollDefaultFees - disc)));
    }
  }, [enrollDiscount, enrollDefaultFees, enrollCourseId]);

  async function generateStudentId() {
    setIdLoading(true);
    try {
      const { data, error } = await supabase
        .from('students')
        .select('student_id')
        .order('student_id', { ascending: false })
        .limit(1);

      if (error) throw error;

      let nextNum = 1;
      if (data && data.length > 0 && data[0].student_id) {
        const match = data[0].student_id.match(/^ST(\d+)$/);
        if (match) {
          nextNum = parseInt(match[1], 10) + 1;
        }
      }
      setGeneratedId(`ST${String(nextNum).padStart(3, '0')}`);
    } catch {
      setGeneratedId('ST001');
    } finally {
      setIdLoading(false);
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!fullName.trim()) {
      toast('Student name is required', 'error');
      return;
    }
    if (!mobileNumber.trim()) {
      toast('Mobile number is required', 'error');
      return;
    }
    if (!admissionDate) {
      toast('Admission date is required', 'error');
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast('Please enter a valid email address', 'error');
      return;
    }
    if (dateOfBirth) {
      const dob = new Date(dateOfBirth);
      const today = new Date();
      if (dob > today) {
        toast('Date of birth cannot be in the future', 'error');
        return;
      }
    }

    setLoading(true);
    try {
      const payload = {
        full_name: fullName.trim(),
        mobile_number: mobileNumber.trim() || null,
        email: email.trim() || null,
        date_of_birth: dateOfBirth || null,
        gender: (gender || null) as Student['gender'],
        address: address.trim() || null,
        admission_date: admissionDate,
        status,
      };

      if (isEdit) {
        const { error } = await supabase
          .from('students')
          .update(payload)
          .eq('id', student!.id);
        if (error) throw error;
        toast('Student updated successfully', 'success');
      } else {
        // Insert student and get the new row's id
        const { data: newStudent, error: studentErr } = await supabase
          .from('students')
          .insert({ ...payload, student_id: generatedId })
          .select('id')
          .single();
        if (studentErr) throw studentErr;

        // Optionally create enrollment if a course was selected
        if (enrollCourseId && newStudent) {
          const disc = Number(enrollDiscount) || 0;
          const final = Number(enrollFinalFees) || 0;
          const enrollPayload = {
            student_id: newStudent.id,
            course_id: enrollCourseId,
            batch_name: enrollBatch.trim() || null,
            joining_date: enrollJoiningDate || admissionDate,
            default_fees_snapshot: enrollDefaultFees,
            discount: disc,
            final_fees: final,
            status: 'Active' as const,
          };
          const { error: enrollErr } = await supabase.from('enrollments').insert(enrollPayload);
          if (enrollErr) {
            // Student was created successfully but enrollment failed
            toast(`Student added, but enrollment failed: ${enrollErr.message}`, 'error');
            onSaved();
            onClose();
            return;
          }
          toast('Student added and enrolled in course successfully', 'success');
        } else {
          toast('Student added successfully', 'success');
        }
      }
      onSaved();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save student';
      toast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Student' : 'Add New Student'}
      description={isEdit ? 'Update student information' : 'Student ID is generated automatically'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Auto-generated Student ID (read-only) */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Student ID</label>
          <div className="relative">
            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={generatedId}
              readOnly
              placeholder={idLoading ? 'Generating...' : 'ST001'}
              className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-slate-300 text-sm bg-slate-50 font-medium text-slate-700"
            />
          </div>
          <p className="text-xs text-slate-400 mt-1">Auto-generated — you cannot change this</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Full Name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Rahul Patil"
                className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Mobile Number <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={mobileNumber}
              onChange={(e) => setMobileNumber(e.target.value)}
              placeholder="9876543210"
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="rahul@example.com"
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Date of Birth</label>
            <input
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Gender</label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition bg-white"
            >
              <option value="">Select gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Admission Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={admissionDate}
              onChange={(e) => setAdmissionDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Address</label>
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Enter full address"
            rows={2}
            className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as StudentStatus)}
            className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition bg-white"
          >
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>

        {/* Optional Course Enrollment — only shown for new students */}
        {!isEdit && (
          <div className="border border-slate-200 rounded-xl p-4 space-y-4 bg-slate-50/50">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-slate-500" />
              <h3 className="text-sm font-semibold text-slate-700">Course Enrollment (Optional)</h3>
            </div>
            <p className="text-xs text-slate-400">
              Optionally enroll this student in a course now. Leave blank to skip.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Course</label>
                <select
                  value={enrollCourseId}
                  onChange={(e) => {
                    setEnrollCourseId(e.target.value);
                    // Sync joining date with admission date when a course is first selected
                    if (e.target.value && !enrollJoiningDate) {
                      setEnrollJoiningDate(admissionDate);
                    }
                  }}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition bg-white"
                >
                  <option value="">— Skip enrollment —</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.course_name} ({c.course_code})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-400 mt-1">Only active courses are shown</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Batch Name</label>
                <input
                  type="text"
                  value={enrollBatch}
                  onChange={(e) => setEnrollBatch(e.target.value)}
                  placeholder="Morning / Evening"
                  disabled={!enrollCourseId}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition disabled:bg-slate-100 disabled:text-slate-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Joining Date</label>
                <input
                  type="date"
                  value={enrollJoiningDate}
                  onChange={(e) => setEnrollJoiningDate(e.target.value)}
                  disabled={!enrollCourseId}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition disabled:bg-slate-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Default Fees</label>
                <div className="px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-600">
                  {enrollDefaultFees > 0 ? formatINR(enrollDefaultFees) : '—'}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">Auto from course</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Discount (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={enrollDiscount}
                  onChange={(e) => setEnrollDiscount(e.target.value)}
                  placeholder="0"
                  disabled={!enrollCourseId}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition disabled:bg-slate-100 disabled:text-slate-400"
                />
              </div>
            </div>

            {enrollCourseId && enrollDefaultFees > 0 && (
              <div className="flex items-center justify-between text-sm bg-white rounded-lg border border-slate-200 px-3 py-2">
                <span className="text-slate-500">
                  {formatINR(enrollDefaultFees)} − {formatINR(Number(enrollDiscount) || 0)} ={' '}
                  <span className="font-semibold text-slate-700">{formatINR(Number(enrollFinalFees) || 0)}</span>
                </span>
                <span className="text-xs text-slate-400">Final Fees</span>
              </div>
            )}
          </div>
        )}

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
            disabled={loading || idLoading}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 transition disabled:opacity-60 flex items-center gap-2"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? 'Update Student' : 'Add Student'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
