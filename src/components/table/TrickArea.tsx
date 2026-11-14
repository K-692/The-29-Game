import React from 'react';
import { PlayedCard, PlayerInfo, PlayerPosition } from '../../engine/types';
import { PlayingCard } from '../card/PlayingCard';

interface TrickAreaProps {
  playedCards: PlayedCard[];
  players: PlayerInfo[];
  myPosition: PlayerPosition;
  trickNumber: number;
}

// Fixed slight rotation angles for natural card feel
const CARD_ROTATIONS = [-4, 3, -2, 5];

export const TrickArea: React.FC<TrickAreaProps> = ({
  playedCards,
  players,
  myPosition,
  trickNumber,
}) => {
  // Map player absolute position (0..3) to relative table position (bottom, left, top, right)
  const getRelativePosition = (pos: PlayerPosition): 'bottom' | 'left' | 'top' | 'right' => {
    const diff = (pos - myPosition + 4) % 4;
    switch (diff) {
      case 0: return 'bottom';
      case 1: return 'left';
      case 2: return 'top';
      case 3: return 'right';
      default: return 'bottom';
    }
  };

  const getPositionStyles = (relPos: 'bottom' | 'left' | 'top' | 'right') => {
    switch (relPos) {
      case 'bottom':
        return 'bottom-2 sm:bottom-4 left-1/2 -translate-x-1/2';
      case 'top':
        return 'top-2 sm:top-4 left-1/2 -translate-x-1/2';
      case 'left':
        return 'left-2 sm:left-4 top-1/2 -translate-y-1/2';
      case 'right':
        return 'right-2 sm:right-4 top-1/2 -translate-y-1/2';
    }
  };

  return (
    <div className="relative w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 rounded-full border-2 border-emerald-600/30 bg-table-dark/80 backdrop-blur-sm shadow-felt flex items-center justify-center">
      {/* Central Felt Watermark */}
      <div className="text-center select-none pointer-events-none opacity-20">
        <div className="text-4xl sm:text-5xl font-black text-amber-400 font-serif">29</div>
        <div className="text-[10px] tracking-widest text-emerald-200 uppercase font-bold mt-1">
          Trick {trickNumber} / 8
        </div>
      </div>

      {/* Played Cards in Trick */}
      {playedCards.map((pc, idx) => {
        const player = players.find((p) => p.position === pc.playerIndex);
        const relPos = getRelativePosition(pc.playerIndex);
        const posClass = getPositionStyles(relPos);
        const rotation = CARD_ROTATIONS[idx % CARD_ROTATIONS.length];

        return (
          <div
            key={`${pc.cardId}_${pc.playerIndex}`}
            className={`absolute ${posClass} flex flex-col items-center z-10 transition-all duration-300 transform scale-90 sm:scale-100`}
          >
            <PlayingCard
              cardId={pc.cardId}
              rotation={rotation}
              size="md"
              className="shadow-2xl"
            />
            <span className="text-[10px] font-bold text-slate-300 bg-slate-950/80 px-2 py-0.5 rounded-full mt-1 border border-slate-700 max-w-[100px] truncate shadow">
              {player ? player.name : `P${pc.playerIndex}`}
            </span>
          </div>
        );
      })}
    </div>
  );
};

