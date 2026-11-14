import React, { useState } from 'react';
import { DEFAULT_RULES_CONFIG, GameRulesConfig, PlayerPosition } from '../../engine/types';
import { Server, Sliders, Users, X, ShieldCheck } from 'lucide-react';

interface CreateRoomModalProps {
  initialName: string;
  onClose: () => void;
  onCreate: (hostName: string, rules: GameRulesConfig, preferredSeat: PlayerPosition) => void;
}

export const CreateRoomModal: React.FC<CreateRoomModalProps> = ({
  initialName,
  onClose,
  onCreate,
}) => {
  const [name, setName] = useState(initialName || 'Host Player');
  const [preferredSeat, setPreferredSeat] = useState<PlayerPosition>(0); // Default Seat 1 (Bottom, Team A)
  const [rules, setRules] = useState<GameRulesConfig>(DEFAULT_RULES_CONFIG);
  const [showAdvancedRules, setShowAdvancedRules] = useState(false);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate(name.trim(), rules, preferredSeat);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div>
            <h2 className="text-xl font-black text-slate-100 flex items-center gap-2">
              <Server className="w-5 h-5 text-amber-400" /> Create LAN Game Room
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Start a private 29 match on your local network</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleCreate} className="p-6 space-y-5">
          {/* Host Display Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
              Host Display Name
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

          {/* Preferred Seat Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-amber-400" /> Your Initial Table Seat
            </label>
            <select
              value={preferredSeat}
              onChange={(e) => setPreferredSeat(parseInt(e.target.value, 10) as PlayerPosition)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-xs font-bold text-slate-200 outline-none transition-colors"
            >
              <option value={0}>Seat 1: Bottom (Team A - Leader)</option>
              <option value={2}>Seat 3: Top (Team A - Partner)</option>
              <option value={1}>Seat 2: Left (Team B - Opponent)</option>
              <option value={3}>Seat 4: Right (Team B - Opponent)</option>
            </select>
            <span className="text-[10px] text-slate-500 block">
              You can also freely click any empty seat to switch in the lobby before starting.
            </span>
          </div>

          {/* Advanced Rules Toggle */}
          <div className="pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setShowAdvancedRules(!showAdvancedRules)}
              className="flex items-center gap-1.5 text-xs font-bold text-amber-400 hover:text-amber-300 transition-colors"
            >
              <Sliders className="w-3.5 h-3.5" />
              {showAdvancedRules ? 'Hide Rules Customization' : 'Customize 29 Game Rules (Optional)'}
            </button>

            {showAdvancedRules && (
              <div className="mt-3 p-4 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-3 animate-fade-in text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-medium">Minimum Opening Bid:</span>
                  <select
                    value={rules.minBid}
                    onChange={(e) => setRules({ ...rules, minBid: parseInt(e.target.value, 10) })}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-slate-100 font-mono font-bold"
                  >
                    <option value={16}>16 (Standard)</option>
                    <option value={17}>17</option>
                    <option value={18}>18</option>
                  </select>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-medium">Forced Dealer Bid on All-Pass:</span>
                  <input
                    type="checkbox"
                    checked={rules.forcedDealerBid}
                    onChange={(e) => setRules({ ...rules, forcedDealerBid: e.target.checked })}
                    className="w-4 h-4 accent-amber-500 rounded"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-medium">Double Score for High Bids (21+):</span>
                  <input
                    type="checkbox"
                    checked={rules.doubleScoreForHighBid}
                    onChange={(e) => setRules({ ...rules, doubleScoreForHighBid: e.target.checked })}
                    className="w-4 h-4 accent-amber-500 rounded"
                  />
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            className="w-full py-3.5 rounded-xl font-black text-sm bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-xl shadow-amber-500/25 transition-all transform active:scale-95 flex items-center justify-center gap-2"
          >
            Create Room & Open Table
          </button>
        </form>
      </div>
    </div>
  );
};
