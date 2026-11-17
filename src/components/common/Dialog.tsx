import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface DialogProps {
  title: string;
  subtitle?: string;
  onClose?: () => void;
  children: React.ReactNode;
  /** Tailwind max-width class for the panel. */
  width?: string;
}

/** Minimal themed dialog used by every popup outside the game table. */
export const Dialog: React.FC<DialogProps> = ({ title, subtitle, onClose, children, width = 'max-w-sm' }) => {
  useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-felt-950/70 backdrop-blur-sm animate-fade-in"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div role="dialog" aria-modal="true" aria-label={title} className={`panel w-full ${width} p-5 sm:p-6`}>
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h2 className="panel-title text-xl">{title}</h2>
            {subtitle && <p className="text-xs text-cream-300/80 mt-1">{subtitle}</p>}
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 -m-1 rounded-lg text-cream-300/70 hover:text-cream-50 hover:bg-cream-100/10 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
};

/** Inline error message for dialogs. */
export const DialogError: React.FC<{ message: string | null }> = ({ message }) =>
  message ? (
    <div role="alert" className="text-xs text-cream-50 bg-suit-red/25 border border-suit-red/50 rounded-xl px-3 py-2">
      {message}
    </div>
  ) : null;
