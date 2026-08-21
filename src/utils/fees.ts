import type { PaymentMode } from '@/types/database';

export function formatINR(n: number): string {
  return `₹${n.toLocaleString('en-IN')}`;
}

export type FeeStatus = 'Unpaid' | 'Partial Payment' | 'Paid';

export function calcFeeStatus(totalPaid: number, balance: number): FeeStatus {
  if (totalPaid === 0) return 'Unpaid';
  if (balance > 0) return 'Partial Payment';
  return 'Paid';
}

export function calcBalance(finalFees: number, totalPaid: number): number {
  return Math.max(0, finalFees - totalPaid);
}

export const PAYMENT_MODES: PaymentMode[] = ['Cash', 'UPI', 'Bank Transfer', 'Card', 'Other'];

export const PAYMENT_MODE_COLORS: Record<string, string> = {
  Cash: 'bg-slate-100 text-slate-700',
  UPI: 'bg-violet-50 text-violet-700',
  'Bank Transfer': 'bg-sky-50 text-sky-700',
  Card: 'bg-amber-50 text-amber-700',
  Other: 'bg-slate-100 text-slate-600',
};

export const FEE_STATUS_COLORS: Record<FeeStatus, string> = {
  Unpaid: 'bg-red-50 text-red-700',
  'Partial Payment': 'bg-amber-50 text-amber-700',
  Paid: 'bg-emerald-50 text-emerald-700',
};

export async function generateReceiptNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `REC-${year}-`;
  const { data, error } = await supabaseFetchReceipts(prefix);
  if (error) throw error;
  const existing = (data ?? []) as { receipt_number: string | null }[];
  let maxNum = 0;
  for (const row of existing) {
    if (!row.receipt_number) continue;
    const match = row.receipt_number.match(/^REC-\d{4}-(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }
  const nextNum = maxNum + 1;
  return `${prefix}${String(nextNum).padStart(4, '0')}`;
}

async function supabaseFetchReceipts(prefix: string) {
  const { supabase } = await import('@/lib/supabaseClient');
  return supabase
    .from('fee_payments')
    .select('receipt_number')
    .like('receipt_number', `${prefix}%`);
}
