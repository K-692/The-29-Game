import React, { useState } from 'react';
import { BidEntry, GameRulesConfig, PlayerInfo, PlayerPosition } from '../../engine/types';
import { getLegalBidOptions, isLegalBid } from '../../engine/bidding';
import { Flame, History, X } from 'lucide-react';

interface BiddingModalProps {
  currentHighestBid: number;
  highestBidder: PlayerPosition | null;
  players: PlayerInfo[];
  bidsHistory: BidEntry[];
  rules: GameRulesConfig;
  isMyTurn: boolean;
  myPosition: PlayerPosition;
  isForcedDealer: boolean;
  onPlaceBid: (bid: number | 'PASS') => void;
}

export const BiddingModal: React.FC<BiddingModalProps> = ({
  currentHighestBid,
  highestBidder,
  players,
  bidsHistory,
  rules,
  isMyTurn,
  myPosition,
  isForcedDealer,
  onPlaceBid,
}) => {
  const legalOptions = getLegalBidOptions(currentHighestBid, rules);
  const [selectedBid, setSelectedBid] = useState<number>(legalOptions[0] || 16);

  const highestBidderPlayer = players.find((p) => p.position === highestBidder);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border-2 border-amber-500/80 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-400/30 text-amber-400 text-xs font-black uppercase tracking-wider">
            <Flame className="w-4 h-4 text-amber-500" /> Bidding Phase
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-100">
            {isMyTurn ? 'Place Your Bid' : 'Waiting for Bids...'}
          </h2>
          <p className="text-xs text-slate-400">
            Current Target: <span className="font-bold text-amber-400">{currentHighestBid > 0 ? `${currentHighestBid} pts` : 'No bids yet'}</span>
            {highestBidderPlayer && ` by ${highestBidderPlayer.name}`}
          </p>
        </div>

        {/* Bid History Chips */}
        <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800 space-y-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-bold uppercase tracking-wider">
            <History className="w-3.5 h-3.5" /> Bidding History
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
            {bidsHistory.length === 0 ? (
              <span className="text-xs text-slate-500 italic">No bids placed yet</span>
            ) : (
              bidsHistory.map((b, i) => {
                const player = players.find((p) => p.position === b.playerIndex);
                const isPass = b.bid === 'PASS';
                return (
                  <span
                    key={i}
                    className={`text-[11px] px-2.5 py-1 rounded-lg font-bold border ${
                      isPass
                        ? 'bg-slate-900 text-slate-500 border-slate-800'
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/40'
                    }`}
                  >
                    {player?.name || `P${b.playerIndex}`}: {isPass ? 'PASS' : b.bid}
                  </span>
                );
              })
            )}
          </div>
        </div>

        {/* Interactive Controls (Active only if my turn) */}
        {isMyTurn ? (
          <div className="space-y-4">
            {/* Quick Raise Buttons */}
            <div className="grid grid-cols-3 gap-2">
              {legalOptions.slice(0, 3).map((val) => (
                <button
                  key={val}
                  onClick={() => setSelectedBid(val)}
                  className={`py-2 rounded-xl text-sm font-black transition-all ${
                    selectedBid === val
                      ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-300 shadow-lg'
                      : 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700'
                  }`}
                >
                  Bid {val}
                </button>
              ))}
            </div>

            {/* Custom Bid Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400">Select Specific Bid:</label>
              <select
                value={selectedBid}
                onChange={(e) => setSelectedBid(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-750 text-slate-100 rounded-xl px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-amber-500 outline-none"
              >
                {legalOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    Bid {opt} points
                  </option>
                ))}
              </select>
            </div>

            {/* Actions: Place Bid or PASS */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                disabled={isForcedDealer}
                onClick={() => onPlaceBid('PASS')}
                className={`py-3 rounded-xl font-black text-sm border transition-all ${
                  isForcedDealer
                    ? 'opacity-40 cursor-not-allowed bg-slate-800 text-slate-500 border-slate-700'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 hover:border-slate-600'
                }`}
              >
                PASS
              </button>

              <button
                onClick={() => onPlaceBid(selectedBid)}
                className="py-3 rounded-xl font-black text-sm bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-xl shadow-amber-500/20 transition-all transform active:scale-95"
              >
                Confirm Bid {selectedBid}
              </button>
            </div>

            {isForcedDealer && (
              <p className="text-[11px] text-amber-400 text-center font-medium">
                Everyone passed! As dealer, you are forced to bid minimum 16.
              </p>
            )}
          </div>
        ) : (
          <div className="text-center py-4 text-sm text-slate-400 italic animate-pulse">
            Waiting for other players to bid...
          </div>
        )}
      </div>
    </div>
  );
};

