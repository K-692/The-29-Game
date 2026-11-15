import React, { useState, useEffect } from 'react';
import { GameRulesConfig, PlayerInfo, PlayerPosition } from '../../engine/types';
import { getLegalBidOptions } from '../../engine/bidding';
import { Clock, XCircle, Loader2 } from 'lucide-react';

interface InTableBiddingProps {
  currentHighestBid: number;
  highestBidder: PlayerPosition | null;
  activeBidder?: PlayerPosition;
  players: PlayerInfo[];
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
  rules,
  isMyTurn,
  myPosition,
  isForcedDealer,
  remainingSeconds = 30,
  onPlaceBid,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset submitting state whenever activeBidder or turn changes
  useEffect(() => {
    setIsSubmitting(false);
  }, [activeBidder, isMyTurn]);

  const legalOptions = getLegalBidOptions(currentHighestBid, rules);

  const activePlayer = players.find(
    (p) => p.position === (activeBidder !== undefined ? activeBidder : myPosition)
  );
  const activeAvatar = activePlayer?.avatar || '🦊';
  const activeName = activePlayer?.name || 'Player';

  const isUrgent = remainingSeconds <= 5;

  const handleBidClick = (val: number | 'PASS') => {
    if (isSubmitting || !isMyTurn) return;
    setIsSubmitting(true);
    onPlaceBid(val);
    setTimeout(() => setIsSubmitting(false), 1500);
  };

  return (
    <div className="w-full max-w-sm sm:max-w-md mx-auto bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl p-3 sm:p-3.5 shadow-2xl space-y-2 sm:space-y-2.5 z-30 select-none text-slate-900 animate-fade-in">
      {/* Element 1: Current bidder and bid information */}
      <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <span className="text-lg sm:text-xl" role="img" aria-label="Bidder Avatar">
            {activeAvatar}
          </span>
          <div>
            <span className="text-xs sm:text-sm font-black text-slate-900 block leading-tight">
              {isMyTurn ? 'Your Turn to Bid' : `${activeName} is bidding`}
            </span>
            <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500">
              Current bid: <strong className="text-amber-700 font-extrabold">{currentHighestBid > 0 ? currentHighestBid : 'None (16 min)'}</strong>
            </span>
          </div>
        </div>

        {/* 30s Countdown Timer */}
        <span
          className={`flex items-center gap-1 font-mono text-[11px] sm:text-xs font-black px-2 py-0.5 rounded-lg shadow-xs ${
            isUrgent
              ? 'bg-rose-500 text-white animate-pulse'
              : 'bg-amber-100 text-amber-950 border border-amber-300'
          }`}
          title="30-Second Bidding Turn Timer"
        >
          <Clock className="w-3 h-3" />
          <span>00:{remainingSeconds.toString().padStart(2, '0')}</span>
        </span>
      </div>

      {isMyTurn ? (
        <div className="space-y-2 pt-0.5">
          {/* Element 2: Grid of all legal bid values (Single-tap immediate submit) */}
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Select Bid to Submit:
            </span>
            <div className="grid grid-cols-5 gap-1 sm:gap-1.5">
              {legalOptions.map((val) => (
                <button
                  key={val}
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleBidClick(val)}
                  className={`py-1.5 sm:py-2 px-0.5 rounded-lg font-mono font-black text-xs sm:text-sm border shadow-xs transition-all flex items-center justify-center ${
                    isSubmitting
                      ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                      : 'bg-amber-50 hover:bg-amber-400 hover:text-slate-950 border-amber-300 text-slate-900 active:scale-95 cursor-pointer'
                  }`}
                  title={`Click to Bid ${val}`}
                >
                  {val}
                </button>
              ))}
            </div>
          </div>

          {/* Element 3: Prominent PASS button (Always visible to active bidder unless dealer is forced to open) */}
          <div className="pt-0.5">
            {!isForcedDealer ? (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleBidClick('PASS')}
                className={`w-full py-2 sm:py-2.5 px-3 rounded-xl font-black text-xs sm:text-sm uppercase tracking-wider border-2 shadow-sm transition-all flex items-center justify-center gap-1.5 ${
                  isSubmitting
                    ? 'bg-slate-100 text-slate-400 border-slate-300 cursor-not-allowed'
                    : 'bg-rose-50 hover:bg-rose-100 active:scale-98 text-rose-700 border-rose-300 cursor-pointer'
                }`}
                title="Pass your bidding turn"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />
                    SUBMITTING...
                  </>
                ) : (
                  <>
                    <XCircle className="w-3.5 h-3.5 text-rose-600" />
                    PASS
                  </>
                )}
              </button>
            ) : (
              <div
                className="w-full py-2 px-3 rounded-xl text-center text-xs font-bold text-amber-900 bg-amber-50 border-2 border-amber-300 shadow-sm flex items-center justify-center gap-1.5"
                title="First 3 players passed: As dealer, you must open with minimum 16"
              >
                <span>⚠️ Dealer Forced Opening (Must bid 16+)</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center py-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 font-medium">
          Waiting for {activeName} to place a bid or pass...
        </div>
      )}
    </div>
  );
};
