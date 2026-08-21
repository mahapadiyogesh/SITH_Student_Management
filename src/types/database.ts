export type StudentStatus = 'Active' | 'Inactive';
export type CourseStatus = 'Active' | 'Inactive';
export type EnrollmentStatus = 'Active' | 'Exam Pending' | 'Completed' | 'Inactive';
export type AttendanceStatus = 'Present' | 'Absent';
export type PaymentMode = 'Cash' | 'UPI' | 'Bank Transfer' | 'Card' | 'Other';
export type ExamResult = 'Pass' | 'Fail' | 'Pending';
export type CertificateStatus = 'Ready' | 'Issued' | 'Cancelled';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface Student {
  id: string;
  student_id: string | null;
  full_name: string;
  mobile_number: string | null;
  email: string | null;
  date_of_birth: string | null;
  gender: 'Male' | 'Female' | 'Other' | null;
  address: string | null;
  admission_date: string | null;
  status: StudentStatus;
  created_at: string;
  updated_at: string;
}

export interface Course {
  id: string;
  course_code: string | null;
  course_name: string;
  default_fees: number;
  duration: string | null;
  status: CourseStatus;
  created_at: string;
  updated_at: string;
}

export interface Enrollment {
  id: string;
  student_id: string;
  course_id: string;
  batch_name: string | null;
  joining_date: string | null;
  default_fees_snapshot: number;
  discount: number;
  final_fees: number;
  status: EnrollmentStatus;
  created_at: string;
  updated_at: string;
}

export interface Attendance {
  id: string;
  enrollment_id: string | null;
  student_id: string;
  attendance_date: string;
  status: AttendanceStatus;
  remarks: string | null;
  batch_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface FeePayment {
  id: string;
  enrollment_id: string;
  payment_date: string;
  receipt_number: string | null;
  amount: number;
  payment_mode: PaymentMode | null;
  reference_number: string | null;
  remarks: string | null;
  is_voided: boolean;
  created_at: string;
}

export interface Exam {
  id: string;
  enrollment_id: string;
  exam_date: string | null;
  exam_name: string | null;
  total_marks: number | null;
  marks_obtained: number | null;
  result: ExamResult | null;
  remarks: string | null;
  created_at: string;
  updated_at: string;
}

export interface Certificate {
  id: string;
  enrollment_id: string;
  certificate_number: string | null;
  certificate_month: string | null;
  status: CertificateStatus;
  issue_date: string | null;
  received_by_student: boolean;
  remarks: string | null;
  created_at: string;
  updated_at: string;
}
