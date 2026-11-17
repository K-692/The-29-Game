import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { RulesContent } from '../common/RulesContent';

interface RulesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Non-blocking rules panel on the right; the game keeps running behind it. */
export const RulesDrawer: React.FC<RulesDrawerProps> = ({ isOpen, onClose }) => {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-sm bg-felt-900/97 border-l border-cream-100/15 shadow-soft backdrop-blur-xl flex flex-col animate-fade-in text-cream-100">
      <div className="flex items-center justify-between px-5 py-4 border-b border-cream-100/10">
        <h2 className="panel-title text-xl">Rules</h2>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-cream-300/70 hover:text-cream-50 hover:bg-cream-100/10"
          aria-label="Close rules"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <RulesContent />
      </div>
    </aside>
  );
};
