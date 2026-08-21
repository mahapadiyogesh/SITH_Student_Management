/*
# Step 4: Student-wise Attendance

## Overview
Changes attendance from enrollment-based to student-based.
Previously attendance was linked to enrollment_id (one record per enrollment per date).
Now attendance is linked to student_id (one record per student per date),
so a student enrolled in multiple courses appears only once in daily attendance.

## Changes
1. Add `student_id` column (uuid, nullable initially for migration).
2. Backfill student_id from existing enrollment_id records.
3. Make student_id NOT NULL.
4. Add FK to students table.
5. Add unique constraint on (student_id, attendance_date).
6. Drop the old unique constraint on (enrollment_id, attendance_date).
7. Make enrollment_id nullable (old records keep it, new records use student_id).
8. Add index on student_id for query performance.
9. Add batch_name column to store which batch the student belongs to (for filtering).
*/

-- ============================================================
-- 1. Add student_id column (nullable first for backfill)
-- ============================================================
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS student_id uuid;

-- ============================================================
-- 2. Backfill student_id from enrollment_id
-- ============================================================
UPDATE public.attendance a
  SET student_id = e.student_id
  FROM public.enrollments e
  WHERE a.enrollment_id = e.id
    AND a.student_id IS NULL;

-- ============================================================
-- 3. Make student_id NOT NULL
-- ============================================================
ALTER TABLE public.attendance
  ALTER COLUMN student_id SET NOT NULL;

-- ============================================================
-- 4. Add FK to students table
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'attendance_student_id_fkey'
  ) THEN
    ALTER TABLE public.attendance
      ADD CONSTRAINT attendance_student_id_fkey
      FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================
-- 5. Drop old unique constraint on (enrollment_id, attendance_date)
-- ============================================================
ALTER TABLE public.attendance
  DROP CONSTRAINT IF EXISTS attendance_enrollment_id_attendance_date_key;

-- ============================================================
-- 6. Add new unique constraint on (student_id, attendance_date)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'attendance_student_id_attendance_date_key'
  ) THEN
    ALTER TABLE public.attendance
      ADD CONSTRAINT attendance_student_id_attendance_date_key
      UNIQUE (student_id, attendance_date);
  END IF;
END $$;

-- ============================================================
-- 7. Make enrollment_id nullable (old records keep it, new ones don't need it)
-- ============================================================
ALTER TABLE public.attendance
  ALTER COLUMN enrollment_id DROP NOT NULL;

-- ============================================================
-- 8. Add index on student_id
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_attendance_student_id
  ON public.attendance (student_id);

-- ============================================================
-- 9. Add batch_name column for batch filtering
-- ============================================================
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS batch_name text;

-- ============================================================
-- 10. RLS policies already exist and use USING(true)/WITH CHECK(true)
--     so they work for both anon and authenticated. No changes needed.
-- ============================================================
