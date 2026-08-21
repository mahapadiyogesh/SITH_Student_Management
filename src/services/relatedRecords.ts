import { supabase } from '@/lib/supabaseClient';

export interface RelatedRecordsResult {
  hasRelated: boolean;
  counts: {
    enrollments: number;
    attendance: number;
    feePayments: number;
    exams: number;
    certificates: number;
  };
}

const EMPTY: RelatedRecordsResult = {
  hasRelated: false,
  counts: { enrollments: 0, attendance: 0, feePayments: 0, exams: 0, certificates: 0 },
};

export async function checkStudentRelated(studentId: string): Promise<RelatedRecordsResult> {
  try {
    const { count: enrollmentCount } = await supabase
      .from('enrollments')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', studentId);

    if ((enrollmentCount ?? 0) === 0) return { ...EMPTY };

    const { data: enrollIds } = await supabase
      .from('enrollments')
      .select('id')
      .eq('student_id', studentId);
    const ids = (enrollIds ?? []).map((e) => e.id);
    if (ids.length === 0) return { ...EMPTY };

    const [
      { count: attendanceCount },
      { count: feeCount },
      { count: examCount },
      { count: certCount },
    ] = await Promise.all([
      supabase.from('attendance').select('id', { count: 'exact', head: true }).eq('student_id', studentId),
      supabase.from('fee_payments').select('id', { count: 'exact', head: true }).in('enrollment_id', ids),
      supabase.from('exams').select('id', { count: 'exact', head: true }).in('enrollment_id', ids),
      supabase.from('certificates').select('id', { count: 'exact', head: true }).in('enrollment_id', ids),
    ]);

    const counts = {
      enrollments: enrollmentCount ?? 0,
      attendance: attendanceCount ?? 0,
      feePayments: feeCount ?? 0,
      exams: examCount ?? 0,
      certificates: certCount ?? 0,
    };

    const hasRelated = Object.values(counts).some((c) => c > 0);
    return { hasRelated, counts };
  } catch {
    return { ...EMPTY };
  }
}

export async function checkCourseRelated(courseId: string): Promise<{ hasRelated: boolean; count: number }> {
  try {
    const { count } = await supabase
      .from('enrollments')
      .select('id', { count: 'exact', head: true })
      .eq('course_id', courseId);
    const safeCount = count ?? 0;
    return { hasRelated: safeCount > 0, count: safeCount };
  } catch {
    return { hasRelated: false, count: 0 };
  }
}

export async function checkEnrollmentRelated(enrollmentId: string): Promise<RelatedRecordsResult> {
  try {
    const [
      { count: feeCount },
      { count: examCount },
      { count: certCount },
    ] = await Promise.all([
      supabase.from('fee_payments').select('id', { count: 'exact', head: true }).eq('enrollment_id', enrollmentId),
      supabase.from('exams').select('id', { count: 'exact', head: true }).eq('enrollment_id', enrollmentId),
      supabase.from('certificates').select('id', { count: 'exact', head: true }).eq('enrollment_id', enrollmentId),
    ]);

    const counts = {
      enrollments: 0,
      attendance: 0,
      feePayments: feeCount ?? 0,
      exams: examCount ?? 0,
      certificates: certCount ?? 0,
    };

    const hasRelated = (counts.feePayments + counts.exams + counts.certificates) > 0;
    return { hasRelated, counts };
  } catch {
    return { ...EMPTY };
  }
}
