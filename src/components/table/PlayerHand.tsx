import React from 'react';
import { CARD_MANIFEST } from '../../assets/cardManifest';
import { PlayingCard } from '../card/PlayingCard';
import { Sparkles } from 'lucide-react';

interface PlayerHandProps {
  cardIds: string[];
  playableCardIds: string[];
  isMyTurn: boolean;
  onPlayCard: (cardId: string) => void;
  disabled?: boolean;
}

export const PlayerHand: React.FC<PlayerHandProps> = ({
  cardIds,
  playableCardIds,
  isMyTurn,
  onPlayCard,
  disabled = false,
}) => {
  if (cardIds.length === 0) {
    return null;
  }

  // Calculate dynamic card overlap based on hand size
  // More cards = tighter overlap on smaller screens
  const overlapClass = cardIds.length > 6 
    ? '-space-x-10 sm:-space-x-12 md:-space-x-14' 
    : '-space-x-8 sm:-space-x-10 md:-space-x-12';

  return (
    <div className="relative flex flex-col items-center">
      {/* Turn reminder banner */}
      {isMyTurn && !disabled && (
        <div className="mb-2 px-3 py-1 bg-amber-500 text-slate-950 font-black text-xs rounded-full shadow-lg flex items-center gap-1.5 animate-bounce">
          <Sparkles className="w-3.5 h-3.5" /> Your Turn - Choose a Card to Play
        </div>
      )}

      {/* Cards Fan Container */}
      <div className={`flex items-end justify-center ${overlapClass} px-6 pt-6 pb-2 overflow-visible`}>
        {cardIds.map((cardId, index) => {
          const isPlayable = isMyTurn && !disabled && playableCardIds.includes(cardId);
          const isDimmed = isMyTurn && !disabled && !playableCardIds.includes(cardId);

          return (
            <div
              key={cardId}
              style={{
                zIndex: index + 1,
              }}
              className={`transition-all duration-200 transform ${
                isDimmed ? 'opacity-40 filter grayscale brightness-75' : ''
              }`}
            >
              <PlayingCard
                cardId={cardId}
                isPlayable={isPlayable}
                disabled={disabled || !isPlayable}
                onClick={() => {
                  if (isPlayable) {
                    onPlayCard(cardId);
                  }
                }}
                size="md"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
