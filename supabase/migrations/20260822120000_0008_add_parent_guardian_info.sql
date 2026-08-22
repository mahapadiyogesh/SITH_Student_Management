/*
# Add Parent/Guardian Information to Students

## Overview
Adds three nullable columns to the `students` table to store
parent/guardian contact details. All columns are optional so that
existing rows remain untouched and no data migration is required.

## Changes
- `parent_name` (text) — name of the parent or guardian
- `parent_mobile` (text) — mobile number of the parent or guardian
- `parent_relationship` (text) — one of Father / Mother / Guardian / Other

## Impact
- All columns are nullable → existing data unaffected
- No new tables, no FK changes, no RLS policy changes
- The existing updated_at trigger already covers any future update
*/

-- ============================================================
-- Add parent/guardian columns to students
-- ============================================================
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS parent_name text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS parent_mobile text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS parent_relationship text
  CHECK (parent_relationship IN ('Father', 'Mother', 'Guardian', 'Other'));
