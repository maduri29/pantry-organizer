import React, { useEffect, useRef } from 'react';

interface ToastProps {
  message: string | null;
  onClear: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, onClear }) => {
  const toastEl = useRef<HTMLElement | null>(null);

  useEffect(() => {
    toastEl.current = document.getElementById('toast');
  }, []);

  useEffect(() => {
    const el = toastEl.current;
    if (!el) return;

    if (message) {
      el.textContent = message;
      el.style.display = 'block';
      const timer = setTimeout(() => {
        el.style.display = 'none';
        onClear();
      }, 4500);
      return () => clearTimeout(timer);
    } else {
      el.style.display = 'none';
    }
  }, [message, onClear]);

  return null;
};
