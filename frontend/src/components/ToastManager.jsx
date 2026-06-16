import React, { useState, useEffect } from 'react';
import { X, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function ToastManager({ toast }) {
  const [visibleToasts, setVisibleToasts] = useState([]);

  useEffect(() => {
    if (toast) {
      const id = Date.now();
      const newToast = { id, ...toast };
      setVisibleToasts(prev => [...prev, newToast]);

      const timer = setTimeout(() => {
        setVisibleToasts(prev => prev.filter(t => t.id !== id));
      }, 4000);

      return () => clearTimeout(timer);
    }
  }, [toast]);

  const removeToast = (id) => {
    setVisibleToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <div className="toast-container">
      {visibleToasts.map(t => (
        <div key={t.id} className={`toast-item ${t.type || 'info'}`}>
          <div className="toast-content">
            {t.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
            <span>{t.message}</span>
          </div>
          <button onClick={() => removeToast(t.id)} className="toast-close">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
