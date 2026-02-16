"use client";

import { createContext, useContext, useState, useCallback, ReactNode, ReactElement } from "react";

type ToastType = "success" | "error" | "info" | "warning";

interface ToastData {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  details?: { label: string; value: string }[];
  duration?: number;
}

interface ToastContextType {
  showToast: (toast: Omit<ToastData, "id">) => void;
  hideToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const showToast = useCallback((toast: Omit<ToastData, "id">) => {
    const id = Math.random().toString(36).substring(7);
    const newToast = { ...toast, id };
    setToasts((prev) => [...prev, newToast]);

    // Auto dismiss after duration (default 5s, success 8s for TX)
    const duration = toast.duration ?? (toast.type === "success" ? 8000 : 5000);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const hideToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      <ToastContainer toasts={toasts} onClose={hideToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}

// Toast Container
function ToastContainer({
  toasts,
  onClose,
}: {
  toasts: ToastData[];
  onClose: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-3 max-w-md">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={() => onClose(toast.id)} />
      ))}
    </div>
  );
}

// Individual Toast
function ToastItem({ toast, onClose }: { toast: ToastData; onClose: () => void }) {
  const icons: Record<ToastType, ReactElement> = {
    success: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
    error: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
    warning: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    info: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  };

  const colors: Record<ToastType, { bg: string; border: string; icon: string; text: string }> = {
    success: {
      bg: "bg-[#0f0f0f]",
      border: "border-[#00FFE0]/30",
      icon: "text-[#00FFE0] bg-[#00FFE0]/10",
      text: "text-[#00FFE0]",
    },
    error: {
      bg: "bg-[#0f0f0f]",
      border: "border-red-500/30",
      icon: "text-red-400 bg-red-500/10",
      text: "text-red-400",
    },
    warning: {
      bg: "bg-[#0f0f0f]",
      border: "border-yellow-500/30",
      icon: "text-yellow-400 bg-yellow-500/10",
      text: "text-yellow-400",
    },
    info: {
      bg: "bg-[#0f0f0f]",
      border: "border-blue-500/30",
      icon: "text-blue-400 bg-blue-500/10",
      text: "text-blue-400",
    },
  };

  const style = colors[toast.type];

  return (
    <div
      className={`${style.bg} border ${style.border} rounded-lg shadow-xl backdrop-blur-sm animate-slide-in`}
      style={{
        animation: "slideIn 0.3s ease-out",
      }}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className={`${style.icon} p-2 rounded-lg shrink-0`}>
            {icons[toast.type]}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h4 className={`font-semibold ${style.text}`}>{toast.title}</h4>
            {toast.message && (
              <p className="text-zinc-400 text-sm mt-1">{toast.message}</p>
            )}

            {/* Details */}
            {toast.details && toast.details.length > 0 && (
              <div className="mt-3 space-y-1.5 bg-[#141414] rounded-md p-3 border border-[#1f1f1f]">
                {toast.details.map((detail, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="text-zinc-500">{detail.label}</span>
                    <span className="text-white font-mono text-xs truncate max-w-[200px]">
                      {detail.value}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 transition-colors shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-[#1a1a1a] rounded-b-lg overflow-hidden">
        <div
          className={`h-full ${toast.type === "success" ? "bg-[#00FFE0]" : toast.type === "error" ? "bg-red-500" : toast.type === "warning" ? "bg-yellow-500" : "bg-blue-500"}`}
          style={{
            animation: `shrink ${toast.duration ?? (toast.type === "success" ? 8000 : 5000)}ms linear forwards`,
          }}
        />
      </div>

      <style jsx>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(100%);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes shrink {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
      `}</style>
    </div>
  );
}
