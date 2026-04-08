'use client';

// ============================================================
// Shared toast / snackbar system for the Business Dashboard.
// Usage:
//   const { toast } = useToast();
//   toast.success('تم الحفظ بنجاح');
//   toast.error('فشل الحفظ. حاول مرة أخرى.');
// ============================================================

import React, {
  createContext, useCallback, useContext, useState, useRef,
} from 'react';

type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  toast: {
    success: (msg: string) => void;
    error:   (msg: string) => void;
    info:    (msg: string) => void;
  };
}

const ToastContext = createContext<ToastContextValue | null>(null);

const COLORS: Record<ToastType, { bg: string; border: string; icon: string }> = {
  success: { bg: '#D1FAE5', border: '#10B981', icon: '✅' },
  error:   { bg: '#FEE2E2', border: '#EF4444', icon: '❌' },
  info:    { bg: '#EFF6FF', border: '#3B82F6', icon: 'ℹ️'  },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = ++counter.current;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const toast = {
    success: (msg: string) => addToast('success', msg),
    error:   (msg: string) => addToast('error',   msg),
    info:    (msg: string) => addToast('info',     msg),
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}

      {/* Toast container — fixed, bottom-left (RTL: visual left = start) */}
      <div style={{
        position: 'fixed',
        bottom: '24px',
        left: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        zIndex: 9999,
        pointerEvents: 'none',
      }}>
        {toasts.map((t) => {
          const c = COLORS[t.type];
          return (
            <div
              key={t.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                backgroundColor: c.bg,
                border: `1.5px solid ${c.border}`,
                borderRadius: '12px',
                padding: '14px 18px',
                minWidth: '260px',
                maxWidth: '380px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                fontFamily: 'Cairo, sans-serif',
                fontSize: '14px',
                color: '#0F2044',
                direction: 'rtl',
                pointerEvents: 'auto',
                animation: 'slideInToast 0.2s ease',
              }}
            >
              <span style={{ fontSize: '18px', flexShrink: 0 }}>{c.icon}</span>
              <span style={{ flex: 1, lineHeight: 1.5 }}>{t.message}</span>
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes slideInToast {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
