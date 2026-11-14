import React, { useState, useEffect } from 'react';
import { BidEntry, GameRulesConfig, PlayerInfo, PlayerPosition } from '../../engine/types';
import { getLegalBidOptions } from '../../engine/bidding';
import { Flame, History, Clock, ArrowUpCircle, Minus, Plus, ShieldAlert } from 'lucide-react';

interface InTableBiddingProps {
  currentHighestBid: number;
  highestBidder: PlayerPosition | null;
  activeBidder?: PlayerPosition;
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
  activeBidder,
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
  const minLegalBid = legalOptions[0] || (currentHighestBid > 0 ? currentHighestBid + 1 : 16);
  const maxLegalBid = 28;

  const [selectedBid, setSelectedBid] = useState<number>(minLegalBid);

  // Synchronize selectedBid whenever highest bid or turn changes to eliminate stale state
  useEffect(() => {
    const options = getLegalBidOptions(currentHighestBid, rules);
    const minBid = options[0] || (currentHighestBid > 0 ? currentHighestBid + 1 : 16);
    setSelectedBid((prev) => (prev < minBid ? minBid : Math.min(prev, maxLegalBid)));
  }, [currentHighestBid, rules, isMyTurn]);

  const highestBidderPlayer = players.find((p) => p.position === highestBidder);
  const currentTurnPlayer = players.find(
    (p) => p.position === (activeBidder !== undefined ? activeBidder : myPosition)
  );

  const isUrgent = remainingSeconds <= 5;

  const handleDecrement = () => {
    setSelectedBid((prev) => Math.max(minLegalBid, prev - 1));
  };

  const handleIncrement = () => {
    setSelectedBid((prev) => Math.min(maxLegalBid, prev + 1));
  };

  return (
    <div className="w-full max-w-xl mx-auto bg-slate-900/95 backdrop-blur-md border-2 border-amber-500/80 rounded-3xl p-4 sm:p-5 shadow-2xl space-y-3.5 z-30 animate-fade-in">
      {/* Header Bar */}
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-black uppercase tracking-wider">
            <Flame className="w-3.5 h-3.5 text-amber-400 animate-pulse" /> Bidding Phase
          </span>
          <span className="text-xs text-slate-300 font-medium">
            Target:{' '}
            <strong className="text-amber-400 font-black">
              {currentHighestBid > 0 ? `${currentHighestBid} pts` : '16 min'}
            </strong>
            {highestBidderPlayer && (
              <span className="text-slate-400 font-normal"> by {highestBidderPlayer.name} ({highestBidderPlayer.team})</span>
            )}
          </span>
        </div>

        {/* 15s Bidding Turn Countdown Badge */}
        <div
          className={`flex items-center gap-1.5 px-3 py-1 rounded-xl font-mono text-xs font-bold transition-all ${
            isUrgent
              ? 'bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse'
              : 'bg-slate-800 text-slate-300 border border-slate-700'
          }`}
          title="Bidding Timer (15s)"
        >
          <Clock className={`w-3.5 h-3.5 ${isUrgent ? 'text-red-400' : 'text-amber-400'}`} />
          <span>00:{remainingSeconds.toString().padStart(2, '0')}</span>
        </div>
      </div>

      {/* Live Bidding History Chips */}
      <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-none">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 shrink-0">
          <History className="w-3 h-3 text-slate-500" /> Bids ({bidsHistory.length}/4):
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
                className={`text-[11px] px-2.5 py-0.5 rounded-md font-bold shrink-0 border ${
                  isPass
                    ? 'bg-slate-950/80 text-slate-400 border-slate-800'
                    : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                }`}
              >
                {player?.name || `P${b.playerIndex + 1}`}: {isPass ? 'PASS' : `${b.bid}`}
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
              <span className="text-[11px] text-amber-300 bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                <ShieldAlert className="w-3 h-3 text-amber-400" /> Forced Dealer Bid (Min 16)
              </span>
            )}
          </div>

          {/* Stepper Controls: [-] [ Selected Amount ] [+] */}
          <div className="flex items-center justify-center gap-3 bg-slate-950/70 p-2.5 rounded-2xl border border-slate-800">
            <button
              type="button"
              onClick={handleDecrement}
              disabled={selectedBid <= minLegalBid}
              aria-label="Decrease bid"
              className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-700 text-slate-100 flex items-center justify-center font-black transition-all active:scale-95"
            >
              <Minus className="w-5 h-5 text-amber-400" />
            </button>

            <div className="flex-1 text-center">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
                Your Bid Value
              </span>
              <span className="text-3xl font-black text-amber-400 tracking-tight font-mono">
                {selectedBid}
              </span>
              <span className="text-[10px] text-slate-500 block">
                (Min: {minLegalBid} • Max: {maxLegalBid})
              </span>
            </div>

            <button
              type="button"
              onClick={handleIncrement}
              disabled={selectedBid >= maxLegalBid}
              aria-label="Increase bid"
              className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-700 text-slate-100 flex items-center justify-center font-black transition-all active:scale-95"
            >
              <Plus className="w-5 h-5 text-amber-400" />
            </button>
          </div>

          {/* Quick preset chips */}
          <div className="flex items-center justify-center gap-1.5 overflow-x-auto py-0.5">
            {legalOptions.slice(0, 5).map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => setSelectedBid(val)}
                className={`py-1 px-2.5 rounded-lg text-xs font-black transition-all ${
                  selectedBid === val
                    ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-300 font-black scale-105'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 border border-slate-700/60'
                }`}
              >
                {val}
              </button>
            ))}
          </div>

          {/* Action Row: PASS & SUBMIT BID */}
          <div className="flex items-center gap-2.5 pt-1">
            {!isForcedDealer ? (
              <button
                type="button"
                onClick={() => onPlaceBid('PASS')}
                className="flex-1 py-2.5 rounded-xl font-bold text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors active:scale-95"
              >
                PASS
              </button>
            ) : (
              <div
                title="All 3 other players passed. As the dealer, you must place the minimum opening bid of 16."
                className="flex-1 py-2.5 rounded-xl font-bold text-[11px] bg-slate-800/50 text-slate-500 border border-slate-800 text-center cursor-not-allowed"
              >
                PASS (Locked for Dealer)
              </div>
            )}

            <button
              type="button"
              onClick={() => onPlaceBid(selectedBid)}
              className="flex-1 py-2.5 rounded-xl font-black text-xs bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-lg shadow-amber-500/20 transition-transform active:scale-95 flex items-center justify-center gap-1.5"
            >
              <ArrowUpCircle className="w-4 h-4 text-slate-950" />
              BID {selectedBid}
            </button>
          </div>
        </div>
      ) : (
        <div className="text-center py-3 bg-slate-950/60 rounded-2xl border border-slate-800 text-xs text-slate-400 space-y-1">
          <div className="flex items-center justify-center gap-2 font-bold text-amber-400">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span>
              {currentTurnPlayer ? `${currentTurnPlayer.name} (${currentTurnPlayer.team})` : 'Player'} is bidding...
            </span>
          </div>
          <p className="text-[11px] text-slate-500">
            One round of bidding in progress (Turn {bidsHistory.length + 1} of 4)
          </p>
        </div>
      )}
    </div>
  );
};
