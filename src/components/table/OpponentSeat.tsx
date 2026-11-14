import React from 'react';
import { PlayerInfo, PlayerPosition, Team } from '../../engine/types';
import { PlayingCard } from '../card/PlayingCard';
import { Bot, User } from 'lucide-react';

interface OpponentSeatProps {
  player: PlayerInfo;
  cardCount: number;
  isCurrentTurn: boolean;
  isDealer: boolean;
  isBidder: boolean;
  bidAmount?: number;
  positionLabel: 'Partner' | 'Opponent Left' | 'Opponent Right';
}

export const OpponentSeat: React.FC<OpponentSeatProps> = ({
  player,
  cardCount,
  isCurrentTurn,
  isDealer,
  isBidder,
  bidAmount,
  positionLabel,
}) => {
  const isTeamA = player.team === 0;

  return (
    <div className={`flex flex-col items-center gap-2 relative transition-all ${
      isCurrentTurn ? 'scale-105' : 'opacity-95'
    }`}>
      {/* Turn indicator glow */}
      {isCurrentTurn && (
        <div className="absolute -inset-2 bg-amber-400/20 rounded-2xl blur-md animate-pulse pointer-events-none" />
      )}

      {/* Avatar & Badges */}
      <div className="relative">
        <div className={`w-11 h-11 sm:w-13 sm:h-13 rounded-2xl flex items-center justify-center font-black text-sm shadow-xl border-2 transition-all ${
          isCurrentTurn
            ? 'border-amber-400 bg-slate-900 text-amber-400 ring-2 ring-amber-400/50'
            : isTeamA
              ? 'border-emerald-500/80 bg-slate-900 text-emerald-400'
              : 'border-amber-500/80 bg-slate-900 text-amber-400'
        }`}>
          {player.isCpu ? <Bot className="w-6 h-6" /> : <User className="w-6 h-6" />}
        </div>

        {/* Dealer badge */}
        {isDealer && (
          <span className="absolute -top-1.5 -left-1.5 bg-amber-400 text-slate-950 font-black text-[10px] w-5 h-5 rounded-full flex items-center justify-center shadow border border-amber-300">
            D
          </span>
        )}

        {/* Online / Bot indicator */}
        <span className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-slate-950 ${
          player.connected ? 'bg-emerald-500' : 'bg-slate-600'
        }`} />
      </div>

      {/* Name & Position */}
      <div className="text-center">
        <div className="text-xs font-bold text-slate-100 flex items-center justify-center gap-1 max-w-[120px] truncate">
          {player.name}
        </div>
        <div className="text-[10px] text-slate-400 font-medium">
          {positionLabel} {isBidder && bidAmount ? `• Bid ${bidAmount}` : ''}
        </div>
      </div>

      {/* Card Back Stack */}
      {cardCount > 0 && (
        <div className="flex -space-x-8 sm:-space-x-10 mt-1 pointer-events-none">
          {Array.from({ length: Math.min(cardCount, 6) }).map((_, i) => (
            <PlayingCard
              key={i}
              cardId="CARD_BACK"
              faceDown={true}
              size="xs"
              className="transform hover:none shadow-sm"
            />
          ))}
          {cardCount > 6 && (
            <div className="w-10 h-14 bg-slate-900/90 border border-slate-700 rounded-sm text-[10px] font-bold text-slate-300 flex items-center justify-center shadow">
              +{cardCount - 6}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

