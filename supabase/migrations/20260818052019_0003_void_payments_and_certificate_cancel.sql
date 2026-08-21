/*
# Step 3: Void Payments + Certificate Cancel Status

## Overview
Adds the ability to void fee payments (instead of deleting them) and to
cancel certificates (instead of deleting issued ones).

## 1. fee_payments table
- Adds `is_voided` boolean column (default false).
- When a payment is voided, `is_voided = true`. The original record is
  preserved for audit history. Voided payments are excluded from the
  Total Paid calculation (Balance = Final Fees - SUM of non-voided payments).

## 2. certificates table
- Extends the `status` CHECK constraint to include 'Cancelled'.
- Statuses are now: Ready / Issued / Cancelled.
- A certificate that is "Ready" (not yet issued) can be deleted or cancelled.
- A certificate that is "Issued" cannot be permanently deleted — it can
  only be cancelled, preserving the history.

## 3. Important Notes
1. No existing data is modified — `is_voided` defaults to false for all
   existing payments.
2. The certificates status constraint is replaced safely using
   ALTER CONSTRAINT (drop + add) which preserves existing rows.
3. No new tables are created.
*/

-- ============================================================
-- fee_payments: add is_voided column
-- ============================================================
ALTER TABLE public.fee_payments
  ADD COLUMN IF NOT EXISTS is_voided boolean NOT NULL DEFAULT false;

-- ============================================================
-- certificates: extend status to include Cancelled
-- ============================================================
ALTER TABLE public.certificates
  DROP CONSTRAINT IF EXISTS certificates_status_check;

ALTER TABLE public.certificates
  ADD CONSTRAINT certificates_status_check
  CHECK (status IN ('Ready', 'Issued', 'Cancelled'));
