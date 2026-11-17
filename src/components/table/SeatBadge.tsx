import React from 'react';
import { PlayerInfo } from '../../engine/types';

export type SeatSide = 'bottom' | 'top' | 'left' | 'right';
export type SeatRelation = 'me' | 'partner' | 'opponent';

interface SeatBadgeProps {
  player: PlayerInfo;
  seatPosition: SeatSide;
  relation: SeatRelation;
  isCurrentTurn: boolean;
  isDealer: boolean;
  /** Contract bid when this player won the auction. */
  contractBid?: number | null;
  /** During bidding: this player's latest call ("18" / "Pass"). */
  bidCall?: string | null;
  /** Their call is the current highest bid. */
  isHighBid?: boolean;
  playerPoints: number;
  isTrickWinner?: boolean;
}

/**
 * One seat at the table. Your side is marked green, opponents red, matching
 * the scoreboard. The bid bubble makes it obvious who you are bidding against.
 */
export const SeatBadge: React.FC<SeatBadgeProps> = ({
  player,
  seatPosition,
  relation,
  isCurrentTurn,
  isDealer,
  contractBid,
  bidCall,
  isHighBid = false,
  playerPoints,
  isTrickWinner = false,
}) => {
  const ownSide = relation !== 'opponent';
  const label = relation === 'me' ? 'You' : relation === 'partner' ? 'Partner' : 'Opponent';
  const isPass = bidCall === 'Pass';

  return (
    <div
      id={`seat-${seatPosition}`}
      data-seat={seatPosition}
      className={`relative flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full bg-cream-100/95 text-felt-800 shadow-soft transition-all duration-300 select-none ${
        isTrickWinner
          ? 'ring-[3px] ring-[#e8c766] shadow-[0_0_28px_rgba(232,199,102,0.75)] scale-105'
          : isCurrentTurn
          ? 'ring-[3px] ring-cream-50 shadow-[0_0_22px_rgba(245,240,225,0.65)] scale-105'
          : ''
      }`}
    >
      {/* Bid bubble (bidding phase) */}
      {bidCall && (
        <span
          className={`absolute left-1/2 -translate-x-1/2 -top-6 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold shadow-soft animate-fade-in ${
            isPass
              ? 'bg-felt-900/90 text-cream-300 border border-cream-100/20'
              : isHighBid
              ? ownSide
                ? 'bg-felt-600 text-cream-50 ring-2 ring-cream-100/70'
                : 'bg-suit-red text-cream-50 ring-2 ring-cream-100/70'
              : 'bg-felt-900/90 text-cream-100 border border-cream-100/20'
          }`}
        >
          {isPass ? 'Pass' : bidCall}
        </span>
      )}

      {/* Won-trick tag */}
      {isTrickWinner && (
        <span className="absolute left-1/2 -translate-x-1/2 -top-5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-[#e8c766] text-felt-900 shadow-soft">
          Won
        </span>
      )}

      {/* Avatar with team ring */}
      <span
        data-avatar={seatPosition}
        className={`relative w-8 h-8 rounded-full flex items-center justify-center text-lg leading-none ring-2 ${
          ownSide ? 'ring-felt-500 bg-felt-500/10' : 'ring-suit-red bg-suit-red/10'
        }`}
        role="img"
        aria-label={`${player.name} avatar`}
      >
        {player.avatar || '🦊'}
        {isDealer && (
          <span
            className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-felt-800 text-cream-100 text-[9px] font-bold flex items-center justify-center"
            title="Dealer"
          >
            D
          </span>
        )}
      </span>

      <div className="leading-tight min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold truncate max-w-[92px] sm:max-w-[120px]">
            {relation === 'me' ? 'You' : player.name}
          </span>
          {player.isCpu && (
            <span className="text-[9px] font-semibold uppercase tracking-wider text-felt-600/80" title="Computer player">
              CPU
            </span>
          )}
          {!player.connected && !player.isCpu && (
            <span className="w-1.5 h-1.5 rounded-full bg-felt-800/40" title="Offline" />
          )}
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-felt-600/80">
          <span className={ownSide ? 'text-felt-500' : 'text-suit-red'}>{label}</span>
          <span>·</span>
          <span className="tabular-nums">{playerPoints} pts</span>
          {contractBid ? (
            <span className="ml-0.5 rounded-full bg-felt-800 text-cream-100 px-1.5 font-semibold" title="Winning bid">
              {contractBid}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
};
