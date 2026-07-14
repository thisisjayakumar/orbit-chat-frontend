'use client';

import { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, X } from 'lucide-react';

let toastIdCounter = 0;

/**
 * A lightweight toast notification system.
 * Usage: import { showToast } from './Toast'; then showToast('Copied!', 'success');
 */
let addToastFn = null;

export function showToast(message, type = 'success', duration = 2500) {
  if (addToastFn) {
    addToastFn({ id: ++toastIdCounter, message, type, duration });
  }
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((toast) => {
    setToasts(prev => [...prev, toast]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Register the global addToast function
  useEffect(() => {
    addToastFn = addToast;
    return () => { addToastFn = null; };
  }, [addToast]);

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col space-y-2 pointer-events-none">
      {toasts.map(toast => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onRemove={removeToast}
        />
      ))}
    </div>
  );
}

function ToastItem({ toast, onRemove }) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Trigger entrance animation on next frame
    requestAnimationFrame(() => setIsVisible(true));

    // Auto-dismiss after duration
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => onRemove(toast.id), 300); // Wait for exit animation
    }, toast.duration);

    return () => clearTimeout(timer);
  }, [toast, onRemove]);

  const isSuccess = toast.type === 'success';
  const isError = toast.type === 'error';

  return (
    <div
      className={`
        pointer-events-auto flex items-center space-x-2 px-4 py-3 rounded-lg shadow-lg
        transition-all duration-300 ease-in-out
        ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-4 opacity-0'}
        ${isSuccess ? 'bg-green-600 text-white' : ''}
        ${isError ? 'bg-red-600 text-white' : ''}
        ${!isSuccess && !isError ? 'bg-gray-800 text-white' : ''}
      `}
    >
      {isSuccess && <CheckCircle className="w-4 h-4 flex-shrink-0" />}
      {isError && <XCircle className="w-4 h-4 flex-shrink-0" />}
      <span className="text-sm font-medium">{toast.message}</span>
      <button
        onClick={() => {
          setIsVisible(false);
          setTimeout(() => onRemove(toast.id), 300);
        }}
        className="ml-2 p-0.5 rounded hover:bg-white hover:bg-opacity-20 transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
