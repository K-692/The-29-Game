import React from 'react';
import { PlayerInfo } from '../../engine/types';

interface OpponentSeatProps {
  player: PlayerInfo;
  isCurrentTurn: boolean;
  isDealer: boolean;
  isBidder: boolean;
  bidAmount?: number;
  playerPoints: number;
  remainingSeconds?: number;
}

export const OpponentSeat: React.FC<OpponentSeatProps> = ({
  player,
  isCurrentTurn,
  isDealer,
  isBidder,
  bidAmount,
  playerPoints,
  remainingSeconds = 30,
}) => {
  const isTeamA = player.team === 0;
  const avatar = player.avatar || '🦊';
  const isUrgent = remainingSeconds <= 5;

  return (
    <div
      className={`relative flex items-center gap-2 px-3 py-1.5 rounded-2xl transition-all duration-200 select-none shadow-md ${
        isCurrentTurn
          ? 'bg-amber-50 border-2 border-amber-400 ring-4 ring-amber-300/40 scale-105'
          : 'bg-white/95 border border-slate-200/90 text-slate-800'
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

      {/* Avatar Emoji */}
      <span className="text-xl sm:text-2xl leading-none shrink-0" role="img" aria-label="Player Avatar">
        {avatar}
      </span>

      {/* Player Name and Points */}
      <div className="flex items-center gap-1.5 text-xs font-bold leading-tight">
        <span className="text-slate-900 truncate max-w-[100px] sm:max-w-[120px]">
          {player.name}
        </span>
        <span className="text-slate-400 font-normal">·</span>
        <span className="text-amber-700 font-extrabold whitespace-nowrap">
          {playerPoints} pts
        </span>
      </div>

      {/* Active Turn 30s Countdown Pill */}
      {isCurrentTurn && (
        <span
          className={`ml-1 text-[11px] font-mono font-black px-1.5 py-0.5 rounded-md ${
            isUrgent
              ? 'bg-red-500 text-white animate-pulse'
              : 'bg-amber-200 text-amber-950'
          }`}
          title="Turn Timer"
        >
          00:{remainingSeconds.toString().padStart(2, '0')}
        </span>
      )}

      {/* Disconnected dot if disconnected */}
      {!player.connected && (
        <span className="w-2 h-2 rounded-full bg-slate-400" title="Offline" />
      )}
    </div>
  );
};
