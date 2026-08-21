import { AlertTriangle, Loader2 } from 'lucide-react';
import Modal from './Modal';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  variant?: 'danger' | 'warning' | 'info';
  details?: { label: string; value: string }[];
}

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  loading = false,
  variant = 'warning',
  details,
}: ConfirmDialogProps) {
  const confirmColor =
    variant === 'danger'
      ? 'bg-red-600 hover:bg-red-700'
      : variant === 'warning'
        ? 'bg-amber-600 hover:bg-amber-700'
        : 'bg-slate-900 hover:bg-slate-800';

  const iconColor =
    variant === 'danger'
      ? 'bg-red-50 text-red-600'
      : variant === 'warning'
        ? 'bg-amber-50 text-amber-600'
        : 'bg-sky-50 text-sky-600';

  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <div className="flex gap-4">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${iconColor}`}>
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          {details && details.length > 0 && (
            <div className="mb-3 space-y-1.5">
              {details.map((d) => (
                <div key={d.label} className="flex items-baseline gap-2 text-sm">
                  <span className="text-slate-400 font-medium w-24 flex-shrink-0">{d.label}:</span>
                  <span className="text-slate-700 font-medium">{d.value}</span>
                </div>
              ))}
            </div>
          )}
          <p className="text-sm text-slate-600 leading-relaxed">{message}</p>
        </div>
      </div>
      <div className="flex justify-end gap-3 mt-6">
        <button
          onClick={onClose}
          disabled={loading}
          className="px-4 py-2 rounded-lg text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition disabled:opacity-60"
        >
          {cancelLabel}
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition disabled:opacity-60 flex items-center gap-2 ${confirmColor}`}
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
