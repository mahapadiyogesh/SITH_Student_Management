/*
# Step 4: Complete Fees Payment Management

## Changes
1. Add `reference_number` column to fee_payments.
2. Add unique constraint on receipt_number (NULLs allowed, existing rows have NULL).
3. Update payment_mode CHECK to include 'Card' and 'Bank Transfer'.
4. Add index on payment_date for report queries.
*/

-- 1. Add reference_number column
ALTER TABLE public.fee_payments
  ADD COLUMN IF NOT EXISTS reference_number text;

-- 2. Drop old payment_mode check and add new one with Card + Bank Transfer
ALTER TABLE public.fee_payments
  DROP CONSTRAINT IF EXISTS fee_payments_payment_mode_check;

ALTER TABLE public.fee_payments
  ADD CONSTRAINT fee_payments_payment_mode_check
  CHECK (payment_mode = ANY (ARRAY['Cash'::text, 'UPI'::text, 'Bank Transfer'::text, 'Card'::text, 'Other'::text]));

-- 3. Add unique constraint on receipt_number (partial - only non-null)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fee_payments_receipt_number_key'
  ) THEN
    CREATE UNIQUE INDEX fee_payments_receipt_number_key
      ON public.fee_payments (receipt_number)
      WHERE receipt_number IS NOT NULL;
  END IF;
END $$;

-- 4. Add index on payment_date for report queries
CREATE INDEX IF NOT EXISTS idx_fee_payments_payment_date
  ON public.fee_payments (payment_date);
