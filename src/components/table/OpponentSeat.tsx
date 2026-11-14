import React from 'react';
import { PlayerInfo } from '../../engine/types';

interface OpponentSeatProps {
  player: PlayerInfo;
  isCurrentTurn: boolean;
  isDealer: boolean;
  isBidder: boolean;
  bidAmount?: number;
  playerPoints: number;
  seatPosition: 'top' | 'left' | 'right';
}

export const OpponentSeat: React.FC<OpponentSeatProps> = ({
  player,
  isCurrentTurn,
  isDealer,
  isBidder,
  bidAmount,
  playerPoints,
  seatPosition,
}) => {
  // Partnership 1 (Seats 1 & 3): Soft Blue; Partnership 2 (Seats 2 & 4): Soft Coral
  const isPartnership1 = player.team === 0;
  const avatar = player.avatar || '🦊';

  return (
    <div
      id={`seat-${seatPosition}`}
      data-seat={seatPosition}
      className={`relative flex items-center gap-2 px-3 py-1.5 rounded-2xl transition-all duration-200 select-none shadow-md ${
        isCurrentTurn
          ? isPartnership1
            ? 'bg-sky-50/95 border-2 border-sky-400 ring-2 ring-sky-300/60 shadow-[0_0_16px_rgba(56,189,248,0.45)] text-slate-900'
            : 'bg-rose-50/95 border-2 border-rose-400 ring-2 ring-rose-300/60 shadow-[0_0_16px_rgba(251,113,133,0.45)] text-slate-900'
          : isPartnership1
          ? 'bg-white/95 border border-sky-200/90 text-slate-800'
          : 'bg-white/95 border border-rose-200/90 text-slate-800'
      }`}
    >
      {/* Dealer Badge */}
      {isDealer && (
        <span
          className="absolute -top-2 -left-2 bg-amber-400 text-slate-950 font-black text-[10px] w-5 h-5 rounded-full flex items-center justify-center shadow-md border border-amber-300 z-10"
          title="Dealer"
        >
          D
        </span>
      )}

      {/* Bidder Badge */}
      {isBidder && bidAmount && (
        <span
          className="absolute -top-2 -right-2 bg-emerald-600 text-white font-black text-[10px] px-1.5 py-0.5 rounded-full shadow-md z-10"
          title={`Winning Bidder: ${bidAmount}`}
        >
          {bidAmount}
        </span>
      )}

      {/* Turn Indicator Tag */}
      {isCurrentTurn && (
        <span
          className={`absolute -bottom-2 left-1/2 -translate-x-1/2 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider text-white shadow-xs z-10 ${
            isPartnership1 ? 'bg-sky-500' : 'bg-rose-500'
          }`}
        >
          TURN
        </span>
      )}

      {/* Partnership Colour Identifier Dot */}
      <span
        className={`w-2 h-2 rounded-full shrink-0 ${isPartnership1 ? 'bg-sky-500' : 'bg-rose-500'}`}
        title={isPartnership1 ? 'Partnership 1' : 'Partnership 2'}
      />

      {/* Avatar Emoji */}
      <span className="text-xl sm:text-2xl leading-none shrink-0" role="img" aria-label="Player Avatar">
        {avatar}
      </span>

      {/* Player Name and Points */}
      <div className="flex items-center gap-1.5 text-xs font-bold leading-tight">
        <span className="text-slate-900 truncate max-w-[95px] sm:max-w-[120px]">
          {player.name}
        </span>
        <span className="text-slate-400 font-normal">·</span>
        <span className="text-amber-700 font-black whitespace-nowrap">
          {playerPoints} pts
        </span>
      </div>

      {/* Disconnected indicator */}
      {!player.connected && (
        <span className="w-2 h-2 rounded-full bg-slate-400" title="Offline" />
      )}
    </div>
  );
};
