import React from 'react';
import { GameRulesConfig, PlayerInfo, PlayerPosition } from '../../engine/types';
import { getLegalBidOptions } from '../../engine/bidding';

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
  const legalOptions = getLegalBidOptions(currentHighestBid, rules);

  const activePlayer = players.find(
    (p) => p.position === (activeBidder !== undefined ? activeBidder : myPosition)
  );
  const activeAvatar = activePlayer?.avatar || '🦊';
  const activeName = activePlayer?.name || 'Player';

  const isUrgent = remainingSeconds <= 5;

  return (
    <div className="w-full max-w-sm sm:max-w-md mx-auto bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-3xl p-4 sm:p-5 shadow-2xl space-y-3.5 z-30 select-none text-slate-900 animate-fade-in">
      {/* Element 1: Current bidder and bid information */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <span className="text-xl sm:text-2xl" role="img" aria-label="Bidder Avatar">
            {activeAvatar}
          </span>
          <div>
            <span className="text-xs sm:text-sm font-black text-slate-900 block leading-tight">
              {isMyTurn ? 'You are bidding' : `${activeName} is bidding`}
            </span>
            <span className="text-[11px] font-semibold text-slate-500">
              Current bid: <strong className="text-amber-700 font-extrabold">{currentHighestBid > 0 ? currentHighestBid : 'None (16 min)'}</strong>
            </span>
          </div>
        </div>

        {/* Minimal 30s Countdown Timer */}
        <span
          className={`font-mono text-xs font-black px-2 py-1 rounded-lg ${
            isUrgent
              ? 'bg-red-500 text-white animate-pulse'
              : 'bg-amber-100 text-amber-950 border border-amber-300/60'
          }`}
          title="30-Second Turn Timer"
        >
          00:{remainingSeconds.toString().padStart(2, '0')}
        </span>
      </div>

      {isMyTurn ? (
        <div className="space-y-3">
          {/* Element 2: Grid of all legal bid values (Immediate submit on click) */}
          <div>
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5 sm:gap-2">
              {legalOptions.map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => onPlaceBid(val)}
                  className="py-2.5 sm:py-3 px-1 rounded-xl font-mono font-black text-sm sm:text-base bg-amber-50 hover:bg-amber-400 hover:text-slate-950 border border-amber-300 text-slate-900 shadow-sm transition-all active:scale-95 flex items-center justify-center cursor-pointer"
                  title={`Bid ${val}`}
                >
                  {val}
                </button>
              ))}
            </div>
          </div>

          {/* Element 3: Pass button */}
          {!isForcedDealer ? (
            <button
              type="button"
              onClick={() => onPlaceBid('PASS')}
              className="w-full py-2.5 rounded-xl font-black text-xs uppercase tracking-wider bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 shadow-sm transition-colors cursor-pointer active:scale-98"
            >
              PASS
            </button>
          ) : (
            <div
              className="w-full py-2 rounded-xl text-center text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200"
              title="First 3 passed: Dealer must open with minimum 16"
            >
              Forced Dealer Bid (Must select 16+)
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-600">
          Waiting for {activeName} to place a bid...
        </div>
      )}
    </div>
  );
};
