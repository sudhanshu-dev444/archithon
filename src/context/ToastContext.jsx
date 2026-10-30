// src/context/ToastContext.jsx
import React, { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'success', duration = 3500) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, removeToast }}>
      {children}
      {/* Toast Render Container */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none w-full max-w-sm px-4">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="alert"
            className={`pointer-events-auto rounded-xl px-4 py-3 shadow-xl border flex items-center gap-3 transition-all transform animate-in slide-in-from-top duration-200 ${
              toast.type === 'error'
                ? 'bg-error-container text-on-error-container border-error/30'
                : toast.type === 'warning'
                ? 'bg-[#ffeedd] text-[#884400] border-[#ffa040]'
                : 'bg-primary-container text-on-primary-container border-primary/20 shadow-primary/10'
            }`}
          >
            <span
              className={`material-symbols-outlined text-[22px] shrink-0 ${
                toast.type === 'error'
                  ? 'text-error'
                  : toast.type === 'warning'
                  ? 'text-[#bb5500]'
                  : 'text-primary'
              }`}
            >
              {toast.type === 'error'
                ? 'error'
                : toast.type === 'warning'
                ? 'warning'
                : 'check_circle'}
            </span>
            <p className="text-body-sm font-semibold flex-1 leading-snug">{toast.message}</p>
            <button
              onClick={() => removeToast(toast.id)}
              className="p-1 rounded-lg hover:bg-black/10 text-current opacity-70 hover:opacity-100 transition-opacity"
              aria-label="Dismiss"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};

