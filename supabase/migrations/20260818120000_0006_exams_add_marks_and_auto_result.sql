/*
# Exams – Add Marks Columns & Auto-Compute Result

## Overview
Extends the existing `exams` table with `total_marks` and `marks_obtained`
columns so that exam scores can be recorded alongside the result.

## Changes
1. Add `total_marks` numeric nullable column (e.g. 100).
2. Add `marks_obtained` numeric nullable column (e.g. 75).
3. Create a BEFORE INSERT OR UPDATE trigger that auto-computes `result`
   based on the percentage:
   - Pending  – when total_marks or marks_obtained is NULL
   - Pass     – when percentage >= 40%
   - Fail     – when percentage < 40%
4. CHECK constraints ensure marks are non-negative and obtained ≤ total.
5. Existing rows are unaffected (new columns default to NULL).
*/

-- Add marks columns
ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS total_marks numeric,
  ADD COLUMN IF NOT EXISTS marks_obtained numeric;

-- Constraints: non-negative, obtained ≤ total
ALTER TABLE public.exams
  ADD CONSTRAINT exams_marks_total_positive CHECK (total_marks IS NULL OR total_marks >= 0),
  ADD CONSTRAINT exams_marks_obtained_positive CHECK (marks_obtained IS NULL OR marks_obtained >= 0),
  ADD CONSTRAINT exams_marks_obtained_lte_total CHECK (
    total_marks IS NULL OR marks_obtained IS NULL OR marks_obtained <= total_marks
  );

-- Auto-compute result trigger function
CREATE OR REPLACE FUNCTION public.compute_exam_result()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.total_marks IS NULL OR NEW.marks_obtained IS NULL OR NEW.total_marks = 0 THEN
    NEW.result := 'Pending';
  ELSIF (NEW.marks_obtained::numeric / NEW.total_marks::numeric) >= 0.4 THEN
    NEW.result := 'Pass';
  ELSE
    NEW.result := 'Fail';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_compute_exam_result ON public.exams;
CREATE TRIGGER trg_compute_exam_result
  BEFORE INSERT OR UPDATE OF total_marks, marks_obtained ON public.exams
  FOR EACH ROW EXECUTE FUNCTION public.compute_exam_result();

-- Backfill existing rows (all currently have NULL marks → result becomes Pending)
UPDATE public.exams SET result = 'Pending'
  WHERE total_marks IS NULL OR marks_obtained IS NULL;
