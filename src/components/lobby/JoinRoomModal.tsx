import React, { useState } from 'react';
import { LogIn, X } from 'lucide-react';

interface JoinRoomModalProps {
  initialRoomCode?: string;
  initialName: string;
  onClose: () => void;
  onJoin: (roomCode: string, playerName: string) => void;
}

export const JoinRoomModal: React.FC<JoinRoomModalProps> = ({
  initialRoomCode = '',
  initialName,
  onClose,
  onJoin,
}) => {
  const [code, setCode] = useState(initialRoomCode.toUpperCase());
  const [name, setName] = useState(initialName || 'Player 2');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) return;
    onJoin(code.trim().toUpperCase(), name.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div>
            <h2 className="text-xl font-black text-slate-100">Join Online Room</h2>
            <p className="text-xs text-slate-400 mt-0.5">Enter the 6-character room code or join via invite link</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
              Room Code
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. TN8492"
              maxLength={10}
              required
              className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-2.5 text-base font-mono font-bold tracking-widest text-amber-400 outline-none uppercase transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
              Your Display Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              maxLength={24}
              required
              className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 outline-none transition-colors"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3.5 rounded-xl font-black text-sm bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-xl shadow-amber-500/25 transition-all transform active:scale-95 flex items-center justify-center gap-2 mt-2"
          >
            <LogIn className="w-4 h-4" /> Join Room
          </button>
        </form>
      </div>
    </div>
  );
};
