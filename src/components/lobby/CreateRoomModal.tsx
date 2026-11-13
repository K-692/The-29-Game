import React, { useState } from 'react';
import { DEFAULT_RULES_CONFIG, GameRulesConfig, PlayerPosition } from '../../engine/types';
import { Bot, Check, ShieldCheck, Sliders, Users, X } from 'lucide-react';

interface CreateRoomModalProps {
  initialName: string;
  onClose: () => void;
  onCreate: (hostName: string, rules: GameRulesConfig, cpuSeats: PlayerPosition[]) => void;
}

export const CreateRoomModal: React.FC<CreateRoomModalProps> = ({
  initialName,
  onClose,
  onCreate,
}) => {
  const [name, setName] = useState(initialName || 'Player 1');
  const [mode, setMode] = useState<'friend_vs_bots' | 'four_humans' | 'solo_vs_bots'>('friend_vs_bots');
  const [rules, setRules] = useState<GameRulesConfig>(DEFAULT_RULES_CONFIG);
  const [showAdvancedRules, setShowAdvancedRules] = useState(false);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    let cpuPositions: PlayerPosition[] = [];
    if (mode === 'friend_vs_bots') {
      // P0 = Host, P2 = Open for Friend on same team! P1 & P3 = Bots
      cpuPositions = [1, 3];
    } else if (mode === 'four_humans') {
      // All seats open for humans
      cpuPositions = [];
    } else if (mode === 'solo_vs_bots') {
      // P0 = Host, P1, P2, P3 = Bots
      cpuPositions = [1, 2, 3];
    }

    onCreate(name.trim(), rules, cpuPositions);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div>
            <h2 className="text-xl font-black text-slate-100">Create Private Online Room</h2>
            <p className="text-xs text-slate-400 mt-0.5">Invite your friend with a shareable URL to play on your team</p>
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

          {/* Preset Partnership Mode */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
              Multiplayer Match Setup
            </label>
            <div className="space-y-2">
              {/* Option 1: Friend + 2 Bots (Primary user requirement) */}
              <div
                onClick={() => setMode('friend_vs_bots')}
                className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                  mode === 'friend_vs_bots'
                    ? 'border-amber-400 bg-amber-500/10 shadow-lg'
                    : 'border-slate-800 bg-slate-950 hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Users className="w-5 h-5 text-amber-400" />
                    <div>
                      <span className="font-bold text-sm text-slate-100 block">
                        Play with Friend on Same Team vs 2 Bots
                      </span>
                      <span className="text-xs text-slate-400">
                        You & your friend are Partners (Team A) vs 2 AI Opponents (Team B)
                      </span>
                    </div>
                  </div>
                  {mode === 'friend_vs_bots' && (
                    <span className="w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center text-slate-950 text-[10px] font-black">
                      ✓
                    </span>
                  )}
                </div>
              </div>

              {/* Option 2: 4 Human Players */}
              <div
                onClick={() => setMode('four_humans')}
                className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                  mode === 'four_humans'
                    ? 'border-amber-400 bg-amber-500/10 shadow-lg'
                    : 'border-slate-800 bg-slate-950 hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Users className="w-5 h-5 text-emerald-400" />
                    <div>
                      <span className="font-bold text-sm text-slate-100 block">
                        4 Human Players Online
                      </span>
                      <span className="text-xs text-slate-400">
                        All 4 seats open for friends via invitation link
                      </span>
                    </div>
                  </div>
                  {mode === 'four_humans' && (
                    <span className="w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center text-slate-950 text-[10px] font-black">
                      ✓
                    </span>
                  )}
                </div>
              </div>

              {/* Option 3: Solo vs 3 Bots */}
              <div
                onClick={() => setMode('solo_vs_bots')}
                className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                  mode === 'solo_vs_bots'
                    ? 'border-amber-400 bg-amber-500/10 shadow-lg'
                    : 'border-slate-800 bg-slate-950 hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Bot className="w-5 h-5 text-indigo-400" />
                    <div>
                      <span className="font-bold text-sm text-slate-100 block">
                        Practice Solo vs 3 Computer Bots
                      </span>
                      <span className="text-xs text-slate-400">
                        Immediate offline single-player match
                      </span>
                    </div>
                  </div>
                  {mode === 'solo_vs_bots' && (
                    <span className="w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center text-slate-950 text-[10px] font-black">
                      ✓
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Advanced Rules Collapsible */}
          <div className="pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setShowAdvancedRules(!showAdvancedRules)}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-slate-200 transition-colors"
            >
              <Sliders className="w-3.5 h-3.5" />
              {showAdvancedRules ? 'Hide Rules Settings' : 'Configure House Rules'}
            </button>

            {showAdvancedRules && (
              <div className="grid grid-cols-2 gap-3 mt-3 p-3.5 bg-slate-950 rounded-2xl border border-slate-800 text-xs">
                <div>
                  <label className="text-slate-400 block mb-1">Minimum Bid</label>
                  <select
                    value={rules.minBid}
                    onChange={(e) => setRules({ ...rules, minBid: Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 font-bold text-slate-200"
                  >
                    <option value={14}>14 points</option>
                    <option value={15}>15 points</option>
                    <option value={16}>16 points (Standard)</option>
                    <option value={17}>17 points</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Last Trick Bonus</label>
                  <select
                    value={rules.lastTrickBonus ? 'yes' : 'no'}
                    onChange={(e) => setRules({ ...rules, lastTrickBonus: e.target.value === 'yes' })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 font-bold text-slate-200"
                  >
                    <option value="yes">+1 Point (Total 29)</option>
                    <option value="no">Disabled (Total 28)</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="w-full py-3.5 rounded-xl font-black text-sm bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-xl shadow-amber-500/25 transition-all transform active:scale-95"
          >
            Create Room & Go to Lobby
          </button>
        </form>
      </div>
    </div>
  );
};
