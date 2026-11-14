import React, { useState } from 'react';
import { BidEntry, GameRulesConfig, PlayerInfo, PlayerPosition } from '../../engine/types';
import { getLegalBidOptions } from '../../engine/bidding';
import { Flame, History, Clock, ArrowUpCircle } from 'lucide-react';

interface InTableBiddingProps {
  currentHighestBid: number;
  highestBidder: PlayerPosition | null;
  players: PlayerInfo[];
  bidsHistory: BidEntry[];
  rules: GameRulesConfig;
  isMyTurn: boolean;
  myPosition: PlayerPosition;
  isForcedDealer: boolean;
  remainingSeconds: number;
  onPlaceBid: (bid: number | 'PASS') => void;
}

export const InTableBidding: React.FC<InTableBiddingProps> = ({
  currentHighestBid,
  highestBidder,
  players,
  bidsHistory,
  rules,
  isMyTurn,
  myPosition,
  isForcedDealer,
  remainingSeconds,
  onPlaceBid,
}) => {
  const legalOptions = getLegalBidOptions(currentHighestBid, rules);
  const [selectedBid, setSelectedBid] = useState<number>(legalOptions[0] || 16);

  const highestBidderPlayer = players.find((p) => p.position === highestBidder);
  const isUrgent = remainingSeconds <= 15;

  return (
    <div className="w-full max-w-xl mx-auto bg-slate-900/95 backdrop-blur-md border-2 border-amber-500/70 rounded-3xl p-4 sm:p-5 shadow-2xl space-y-3.5 z-30 animate-fade-in">
      {/* Header Bar */}
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-black uppercase tracking-wider">
            <Flame className="w-3.5 h-3.5 text-amber-400 animate-pulse" /> Bidding
          </span>
          <span className="text-xs text-slate-300 font-medium">
            Target:{' '}
            <strong className="text-amber-400 font-black">
              {currentHighestBid > 0 ? `${currentHighestBid} pts` : '16 min'}
            </strong>
            {highestBidderPlayer && (
              <span className="text-slate-400 font-normal"> by {highestBidderPlayer.name}</span>
            )}
          </span>
        </div>

        {/* 60s Turn Countdown Badge */}
        <div
          className={`flex items-center gap-1.5 px-3 py-1 rounded-xl font-mono text-xs font-bold transition-all ${
            isUrgent
              ? 'bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse'
              : 'bg-slate-800 text-slate-300 border border-slate-700'
          }`}
          title="Turn Timer"
        >
          <Clock className={`w-3.5 h-3.5 ${isUrgent ? 'text-red-400' : 'text-amber-400'}`} />
          <span>00:{remainingSeconds.toString().padStart(2, '0')}</span>
        </div>
      </div>

      {/* Live Bidding History Chips */}
      <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-none">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 shrink-0">
          <History className="w-3 h-3 text-slate-500" /> Bids:
        </span>
        {bidsHistory.length === 0 ? (
          <span className="text-xs text-slate-500 italic">Waiting for opening bid...</span>
        ) : (
          bidsHistory.map((b, i) => {
            const player = players.find((p) => p.position === b.playerIndex);
            const isPass = b.bid === 'PASS';
            return (
              <span
                key={i}
                className={`text-[11px] px-2 py-0.5 rounded-md font-bold shrink-0 border ${
                  isPass
                    ? 'bg-slate-950/80 text-slate-400 border-slate-800'
                    : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                }`}
              >
                {player?.name || `P${b.playerIndex + 1}`}: {isPass ? 'PASS' : b.bid}
              </span>
            );
          })
        )}
      </div>

      {/* Interactive Controls (Active when my turn) */}
      {isMyTurn ? (
        <div className="space-y-3 pt-1">
          <div className="text-xs font-black text-amber-400 uppercase tracking-wide flex items-center justify-between">
            <span>Your Turn — Raise or Pass</span>
            {isForcedDealer && (
              <span className="text-[11px] text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded font-bold">
                Forced Dealer Bid (Min 16)
              </span>
            )}
          </div>

          {/* Quick Bid Buttons */}
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {legalOptions.slice(0, 5).map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => setSelectedBid(val)}
                className={`py-2 px-1 rounded-xl text-xs font-black transition-all ${
                  selectedBid === val
                    ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-300 shadow-md font-black scale-105'
                    : 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700'
                }`}
              >
                {val} pts
              </button>
            ))}

            {legalOptions.length > 5 && (
              <select
                aria-label="Select custom bid"
                value={selectedBid}
                onChange={(e) => setSelectedBid(parseInt(e.target.value, 10))}
                className="py-1 px-1.5 rounded-xl text-xs font-bold bg-slate-800 text-slate-200 border border-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-400"
              >
                {legalOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Action Row: Pass & Submit Bid */}
          <div className="flex items-center gap-2 pt-1">
            {!isForcedDealer && (
              <button
                type="button"
                onClick={() => onPlaceBid('PASS')}
                className="flex-1 py-2.5 rounded-xl font-bold text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
              >
                PASS
              </button>
            )}

            <button
              type="button"
              onClick={() => onPlaceBid(selectedBid)}
              className="flex-1 py-2.5 rounded-xl font-black text-xs bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-lg shadow-amber-500/20 transition-transform active:scale-95 flex items-center justify-center gap-1.5"
            >
              <ArrowUpCircle className="w-4 h-4 text-slate-950" />
              Place Bid: {selectedBid}
            </button>
          </div>
        </div>
      ) : (
        <div className="text-center py-2.5 bg-slate-950/60 rounded-2xl border border-slate-800 text-xs text-slate-400 flex items-center justify-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          <span>Waiting for other players to place their bids...</span>
        </div>
      )}
    </div>
  );
};
