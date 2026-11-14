import React from 'react';
import { PlayedCard, PlayerInfo, PlayerPosition } from '../../engine/types';
import { PlayingCard } from '../card/PlayingCard';
import { Target, Sparkles } from 'lucide-react';

interface TrickAreaProps {
  playedCards: PlayedCard[];
  players: PlayerInfo[];
  myPosition: PlayerPosition;
  trickNumber: number;
  isDropTargetActive?: boolean;
  isHoveredOverDropTarget?: boolean;
  dropZoneRef?: React.Ref<HTMLDivElement>;
}

// Fixed slight rotation angles for natural card feel
const CARD_ROTATIONS = [-3, 4, -2, 3];

export const TrickArea: React.FC<TrickAreaProps> = ({
  playedCards,
  players,
  myPosition,
  trickNumber,
  isDropTargetActive = false,
  isHoveredOverDropTarget = false,
  dropZoneRef,
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
        return 'bottom-1 sm:bottom-2 left-1/2 -translate-x-1/2';
      case 'top':
        return 'top-1 sm:top-2 left-1/2 -translate-x-1/2';
      case 'left':
        return 'left-1 sm:left-2 top-1/2 -translate-y-1/2';
      case 'right':
        return 'right-1 sm:right-2 top-1/2 -translate-y-1/2';
    }
  };

  return (
    <div
      ref={dropZoneRef}
      className={`
        relative w-64 h-48 sm:w-80 sm:h-56 md:w-96 md:h-64 rounded-3xl
        flex items-center justify-center transition-all duration-200 select-none
        ${
          isHoveredOverDropTarget
            ? 'ring-4 ring-amber-400 bg-amber-500/20 shadow-2xl scale-105'
            : isDropTargetActive
            ? 'border-2 border-dashed border-amber-400/80 bg-emerald-950/40 shadow-xl'
            : 'border border-emerald-500/20 bg-emerald-950/20'
        }
      `}
    >
      {/* Visual Drop Target Highlight when dragging a card */}
      {isDropTargetActive && (
        <div className="absolute inset-0 rounded-3xl flex flex-col items-center justify-center pointer-events-none z-20 animate-pulse">
          <div className={`p-2.5 rounded-full ${isHoveredOverDropTarget ? 'bg-amber-400 text-slate-950' : 'bg-slate-900/90 text-amber-300 border border-amber-400/50'}`}>
            <Target className="w-6 h-6 animate-spin" />
          </div>
          <span className={`text-xs font-black uppercase tracking-wider mt-1 px-3 py-1 rounded-full shadow ${isHoveredOverDropTarget ? 'bg-amber-400 text-slate-950' : 'bg-slate-900/90 text-amber-300'}`}>
            {isHoveredOverDropTarget ? 'Release to Throw Card!' : 'Drop Card Here'}
          </span>
        </div>
      )}

      {/* Central Watermark (Shown when not dragging) */}
      {!isDropTargetActive && playedCards.length === 0 && (
        <div className="text-center select-none pointer-events-none opacity-40">
          <div className="text-3xl sm:text-4xl font-black text-amber-300/80 font-serif tracking-widest">29</div>
          <div className="text-[10px] tracking-widest text-emerald-100 uppercase font-bold mt-0.5">
            Trick {trickNumber} / 8
          </div>
        </div>
      )}

      {/* Played Cards in Trick */}
      {playedCards.map((pc, idx) => {
        const player = players.find((p) => p.position === pc.playerIndex);
        const relPos = getRelativePosition(pc.playerIndex);
        const posClass = getPositionStyles(relPos);
        const rotation = CARD_ROTATIONS[idx % CARD_ROTATIONS.length];

        return (
          <div
            key={`${pc.cardId}_${pc.playerIndex}`}
            className={`absolute ${posClass} flex flex-col items-center z-10 transition-all duration-300 transform scale-90 sm:scale-95`}
          >
            <PlayingCard
              cardId={pc.cardId}
              rotation={rotation}
              size="md"
              className="shadow-2xl ring-1 ring-slate-900/30"
            />
            <span className="text-[10px] font-bold text-slate-200 bg-slate-950/90 px-2 py-0.5 rounded-full mt-1 border border-slate-700/80 max-w-[90px] truncate shadow">
              {player ? player.name : `P${pc.playerIndex}`}
            </span>
          </div>
        );
      })}
    </div>
  );
};
