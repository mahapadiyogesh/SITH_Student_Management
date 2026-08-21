import { Printer, X } from 'lucide-react';
import { formatDateDMY } from '@/utils/date';
import { formatINR } from '@/utils/fees';

export interface ReceiptData {
  receiptNumber: string;
  paymentDate: string;
  studentName: string;
  studentId: string;
  courseName: string;
  batchName: string;
  amount: number;
  paymentMode: string;
  referenceNumber: string | null;
  finalFees: number;
  totalPaidAfter: number;
  remainingBalance: number;
  remarks: string | null;
}

export default function ReceiptModal({ data, onClose }: { data: ReceiptData; onClose: () => void }) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto">
      <div className="fixed inset-0 bg-slate-900/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md my-8 print:shadow-none print:rounded-none print:max-w-none print:w-full">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 print:hidden">
          <h2 className="text-lg font-semibold text-slate-900">Payment Receipt</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition"
              title="Print"
            >
              <Printer className="h-5 w-5" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="p-8 print:p-0">
          {/* Header */}
          <div className="text-center mb-6 pb-4 border-b-2 border-slate-900">
            <div className="flex items-center justify-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center">
                <span className="text-sm font-bold">CC</span>
              </div>
              <h1 className="text-xl font-bold text-slate-900">Computer Class</h1>
            </div>
            <p className="text-xs text-slate-500">Management System</p>
          </div>

          {/* Receipt Number & Date */}
          <div className="flex justify-between items-center mb-6 text-sm">
            <div>
              <p className="text-xs text-slate-400">Receipt No.</p>
              <p className="font-bold text-slate-900">{data.receiptNumber}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400">Date</p>
              <p className="font-medium text-slate-700">{formatDateDMY(data.paymentDate)}</p>
            </div>
          </div>

          {/* Student Details */}
          <div className="space-y-2 mb-6">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Student Details</h3>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Name</span>
              <span className="font-medium text-slate-900">{data.studentName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Student ID</span>
              <span className="font-medium text-slate-900">{data.studentId}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Course</span>
              <span className="font-medium text-slate-900">{data.courseName}</span>
            </div>
            {data.batchName && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Batch</span>
                <span className="font-medium text-slate-900">{data.batchName}</span>
              </div>
            )}
          </div>

          {/* Payment Details */}
          <div className="space-y-2 mb-6 pt-4 border-t border-slate-200">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Payment Details</h3>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Amount Paid</span>
              <span className="font-bold text-lg text-slate-900">{formatINR(data.amount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Payment Mode</span>
              <span className="font-medium text-slate-700">{data.paymentMode}</span>
            </div>
            {data.referenceNumber && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Reference No.</span>
                <span className="font-medium text-slate-700">{data.referenceNumber}</span>
              </div>
            )}
          </div>

          {/* Fee Summary */}
          <div className="space-y-2 mb-6 pt-4 border-t border-slate-200">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Fee Summary</h3>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Final Fees</span>
              <span className="font-medium text-slate-700">{formatINR(data.finalFees)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Total Paid</span>
              <span className="font-medium text-emerald-600">{formatINR(data.totalPaidAfter)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Remaining Balance</span>
              <span className="font-bold text-slate-900">{formatINR(data.remainingBalance)}</span>
            </div>
          </div>

          {/* Remarks */}
          {data.remarks && (
            <div className="mb-6 pt-4 border-t border-slate-200">
              <p className="text-xs text-slate-400 mb-1">Remarks</p>
              <p className="text-sm text-slate-600">{data.remarks}</p>
            </div>
          )}

          {/* Footer */}
          <div className="text-center pt-6 border-t border-slate-200">
            <p className="text-xs text-slate-400">This is a computer-generated receipt.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
