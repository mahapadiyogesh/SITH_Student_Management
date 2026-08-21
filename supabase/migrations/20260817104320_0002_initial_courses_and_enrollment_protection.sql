/*
# Step 2: Initial Courses + Duplicate Enrollment Protection

## Overview
This migration does two things:
1. Inserts the 8 initial courses as real database records (not hardcoded in UI).
2. Adds a partial unique index on enrollments to prevent duplicate ACTIVE
   enrollments for the same student + course combination, while still
   allowing re-enrollment if the previous enrollment is inactive/completed.

## 1. Initial Courses Inserted
- Tally (CRS001)
- Adv-Excel (CRS002)
- MSCIT (CRS003)
- Photo Editing (CRS004)
- Video Editing (CRS005)
- Cor-Excel (CRS006)
- Data Analysis (CRS007)
- Digital Marketing (CRS008)

These are normal database records. Admin can add/edit/deactivate them.
They are NOT hardcoded in the UI — the Courses page reads from the database.

Default fees are set to 0 since the admin will set actual fees per course.
This avoids inserting fake fee data.

## 2. Duplicate Active Enrollment Prevention
A partial unique index ensures that for any given student_id + course_id
pair, there can be at most ONE enrollment with status 'Active'. This
prevents accidental duplicate active enrollments at the database level.

If a previous enrollment is 'Inactive', 'Completed', or 'Exam Pending',
a new active enrollment IS allowed (the partial index only covers
status = 'Active').

## 3. Important Notes
1. Course codes use a CRS### format for uniqueness.
2. The partial index is safe to re-run (IF NOT EXISTS).
3. No student data is inserted.
4. No fee payment data is inserted.
*/

-- ============================================================
-- Insert initial courses (only if they don't already exist)
-- ============================================================
INSERT INTO public.courses (course_code, course_name, default_fees, duration, status)
VALUES
  ('CRS001', 'Tally', 0, '3 Months', 'Active'),
  ('CRS002', 'Adv-Excel', 0, '2 Months', 'Active'),
  ('CRS003', 'MSCIT', 0, '3 Months', 'Active'),
  ('CRS004', 'Photo Editing', 0, '2 Months', 'Active'),
  ('CRS005', 'Video Editing', 0, '3 Months', 'Active'),
  ('CRS006', 'Cor-Excel', 0, '2 Months', 'Active'),
  ('CRS007', 'Data Analysis', 0, '3 Months', 'Active'),
  ('CRS008', 'Digital Marketing', 0, '3 Months', 'Active')
ON CONFLICT (course_code) DO NOTHING;

-- ============================================================
-- Partial unique index: one active enrollment per student+course
-- ============================================================
-- This prevents duplicate ACTIVE enrollments at the DB level.
-- Inactive/Completed/Exam Pending enrollments are excluded, so
-- re-enrollment is allowed after a previous enrollment ends.
CREATE UNIQUE INDEX IF NOT EXISTS enrollments_active_student_course_unique
  ON public.enrollments (student_id, course_id)
  WHERE status = 'Active';
