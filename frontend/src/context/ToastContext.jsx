import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { CheckCircleIcon, ExclamationTriangleIcon, BoltIcon } from "@heroicons/react/24/solid";




const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message, type = "info", duration = 3500) => {
    const id = Date.now() + Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  // Override window.alert globally so native browser alert prompts are never shown
  useEffect(() => {
    const originalAlert = window.alert;
    window.alert = (msg) => {
      if (!msg) return;
      const strMsg = String(msg);
      let type = "info";
      if (strMsg.includes("Success") || strMsg.includes("") || strMsg.includes("copied") || strMsg.includes("joined")) {
        type = "success";
      } else if (strMsg.includes("Failed") || strMsg.includes("Error") || strMsg.includes("error") || strMsg.includes("Invalid")) {
        type = "error";
      }
      showToast(strMsg, type);
    };

    return () => {
      window.alert = originalAlert;
    };
  }, [showToast]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="top-toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`top-toast-banner ${t.type}`} onClick={() => removeToast(t.id)}>
            <div className="toast-icon">
              {t.type === "success" && ""}
              {t.type === "error" && "️"}
              {t.type === "warning" && ""}
              {t.type === "info" && "ℹ️"}
            </div>
            <div className="toast-message">{t.message}</div>
            <button className="toast-close" onClick={(e) => { e.stopPropagation(); removeToast(t.id); }}></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      showToast: (msg, type) => {
        window.alert(msg);
      }
    };
  }
  return ctx;
}
