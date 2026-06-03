import { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const push = useCallback((msg, type = 'success') => {
    const id = Date.now();
    setToasts((t) => [...t, { id, msg, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  const colors = {
    success: { bg: '#d0e3c1', border: '#536348', color: '#3c4b32' },
    error:   { bg: '#ffdad6', border: '#ba1a1a', color: '#93000a' },
    info:    { bg: '#d5e3ff', border: '#003365', color: '#001e40' },
  };

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {toasts.map((t) => {
          const c = colors[t.type] || colors.info;
          return (
            <div key={t.id} className="toast" style={{ background: c.bg, border: `2px solid ${c.border}`, color: c.color }}>
              <span style={{ fontSize: 15, fontWeight: 800 }}>{icons[t.type]}</span>
              {t.msg}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
