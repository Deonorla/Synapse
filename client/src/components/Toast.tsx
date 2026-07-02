import { CheckCircle2, X, AlertCircle, Info } from 'lucide-react';
import type React from 'react';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

export type ToastVariant = 'success' | 'error' | 'info';

export type ToastItem = {
  id: string;
  message: string;
  variant: ToastVariant;
  duration?: number; // ms, default 5000
};

type ToastFn = (message: string, duration?: number) => void;

type ToastContextValue = {
  success: ToastFn;
  error: ToastFn;
  info: ToastFn;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((variant: ToastVariant, message: string, duration?: number) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts(prev => [...prev, { id, message, variant, duration }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const value: ToastContextValue = {
    success: (msg, dur) => addToast('success', msg, dur),
    error: (msg, dur) => addToast('error', msg, dur),
    info: (msg, dur) => addToast('info', msg, dur),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

function ToastContainer({
  toasts,
  onRemove,
}: {
  toasts: ToastItem[];
  onRemove: (id: string) => void;
}) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-none">
      {toasts.map(toast => (
        <ToastView key={toast.id} item={toast} onRemove={onRemove} />
      ))}
    </div>
  );
}

function ToastView({
  item,
  onRemove,
}: {
  item: ToastItem;
  onRemove: (id: string) => void;
}) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setLeaving(true);
    }, item.duration ?? 5000);
    return () => clearTimeout(timeout);
  }, [item.id, item.duration]);

  useEffect(() => {
    if (!leaving) return;
    // Wait for exit animation then remove
    const t = setTimeout(() => onRemove(item.id), 300);
    return () => clearTimeout(t);
  }, [leaving, item.id, onRemove]);

  const config = {
    success: {
      icon: CheckCircle2,
      bg: 'bg-[#e1f7e3]',
      border: 'border-[#2e7d32]',
      iconColor: 'text-[#2e7d32]',
      textColor: 'text-[#1a3a1c]',
    },
    error: {
      icon: AlertCircle,
      bg: 'bg-[#fde0e0]',
      border: 'border-[#c62828]',
      iconColor: 'text-[#c62828]',
      textColor: 'text-[#3a1a1a]',
    },
    info: {
      icon: Info,
      bg: 'bg-[#e3f0ff]',
      border: 'border-[#1565c0]',
      iconColor: 'text-[#1565c0]',
      textColor: 'text-[#1a2a3a]',
    },
  }[item.variant];

  const Icon = config.icon;

  return (
    <div
      className={`
        pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg max-w-md w-full
        ${config.bg} ${config.border}
        ${leaving ? 'animate-slide-out opacity-0 translate-x-4' : 'animate-slide-in opacity-100 translate-x-0'}
        transition-all duration-300
      `}
    >
      <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${config.iconColor}`} />
      <p
        className={`flex-1 text-sm font-medium wrap-break-word overflow-wrap-anywhere whitespace-pre-wrap ${config.textColor}`}
      >
        {item.message}
      </p>

      <button
        onClick={() => setLeaving(true)}
        className="shrink-0 rounded-md p-0.5 hover:bg-black/5 transition-colors"
      >
        <X className="h-4 w-4 text-current opacity-60" />
      </button>
    </div>
  );
}

