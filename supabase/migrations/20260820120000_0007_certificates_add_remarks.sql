/*
# Certificates – Add Remarks Column

## Overview
Extends the existing `certificates` table with an optional `remarks` text column
for storing notes about a certificate (e.g. reason for cancellation, special
instructions).

## Changes
1. Add `remarks` text nullable column.
2. Existing rows are unaffected (NULL by default).
*/

ALTER TABLE public.certificates
  ADD COLUMN IF NOT EXISTS remarks text;
