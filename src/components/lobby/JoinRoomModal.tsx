import React, { useState } from 'react';
import { LogIn, X, Server, Wifi, Users } from 'lucide-react';
import { PlayerPosition } from '../../engine/types';
import { lanClient } from '../../services/lanClient';

interface JoinRoomModalProps {
  initialRoomCode?: string;
  initialName: string;
  onClose: () => void;
  onJoin: (roomCode: string, playerName: string, hostAddress: string, preferredSeat?: PlayerPosition) => Promise<string | null>;
}

export const JoinRoomModal: React.FC<JoinRoomModalProps> = ({
  initialRoomCode = '',
  initialName,
  onClose,
  onJoin,
}) => {
  const [code, setCode] = useState(initialRoomCode.toUpperCase());
  const [name, setName] = useState(initialName || 'Player');
  const [hostAddress, setHostAddress] = useState(() => lanClient.getDefaultHostUrl());
  const [preferredSeat, setPreferredSeat] = useState<PlayerPosition>(2); // Default to Seat 3 (Partner)

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim() || busy) return;
    setBusy(true);
    setError(null);
    const err = await onJoin(code.trim().toUpperCase(), name.trim(), hostAddress.trim(), preferredSeat);
    if (err) {
      setError(err);
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div>
            <h2 className="text-xl font-black text-slate-100 flex items-center gap-2">
              <Wifi className="w-5 h-5 text-emerald-400" /> Join LAN Game
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Connect to a host running on your local Wi-Fi / network</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Room Code */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
              6-Digit Room Code
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. TN8492"
              maxLength={8}
              required
              className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-2.5 text-base font-mono font-bold tracking-widest text-amber-400 outline-none uppercase transition-colors"
            />
          </div>

          {/* Player Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
              Your Player Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              maxLength={20}
              required
              className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 outline-none transition-colors"
            />
          </div>

          {/* Preferred Seat */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-amber-400" /> Preferred Seat
            </label>
            <select
              value={preferredSeat}
              onChange={(e) => setPreferredSeat(parseInt(e.target.value, 10) as PlayerPosition)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-xs font-bold text-slate-200 outline-none transition-colors"
            >
              <option value={2}>Seat 3: Top (Team A - Partner to Host)</option>
              <option value={1}>Seat 2: Left (Team B - Opponent)</option>
              <option value={3}>Seat 4: Right (Team B - Opponent)</option>
              <option value={0}>Seat 1: Bottom (Team A)</option>
            </select>
          </div>

          {/* Host LAN Server Address */}
          <div className="space-y-1.5 pt-1">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-slate-500" /> Host LAN Server Address
            </label>
            <input
              type="text"
              value={hostAddress}
              onChange={(e) => setHostAddress(e.target.value)}
              placeholder="192.168.1.x (port 3000 is assumed)"
              className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-2 text-xs font-mono text-slate-300 outline-none transition-colors"
            />
            <span className="text-[10px] text-slate-500 block">
              Pre-filled with the address this page was opened from. Change it only if the host is a different computer.
            </span>
          </div>

          {error && (
            <div role="alert" className="text-xs font-semibold text-rose-200 bg-rose-950/60 border border-rose-500/50 rounded-xl px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full py-3.5 rounded-xl font-black text-sm bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-xl shadow-amber-500/25 transition-all transform active:scale-95 disabled:opacity-60 disabled:cursor-wait flex items-center justify-center gap-2 mt-2"
          >
            {busy ? 'Connecting…' : (<><LogIn className="w-4 h-4" /> Join Room on LAN</>)}
          </button>
        </form>
      </div>
    </div>
  );
};
