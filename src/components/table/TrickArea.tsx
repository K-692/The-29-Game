import React, { useEffect, useState, useRef } from 'react';
import { CompletedTrick, PlayedCard, PlayerInfo, PlayerPosition } from '../../engine/types';
import { PlayingCard } from '../card/PlayingCard';
import { soundManager } from '../../common/SoundManager';

interface TrickAreaProps {
  playedCards: PlayedCard[];
  players: PlayerInfo[];
  myPosition: PlayerPosition;
  completedTricks: CompletedTrick[];
  lastCompletedTrick?: CompletedTrick | null;
  dropZoneRef?: React.Ref<HTMLDivElement>;
}

// Fixed slight rotation angles for natural card feel
const CARD_ROTATIONS = [-2, 3, -2, 2];

export const TrickArea: React.FC<TrickAreaProps> = ({
  playedCards,
  players,
  myPosition,
  completedTricks,
  lastCompletedTrick,
  dropZoneRef,
}) => {
  // State for freeze-frame and collection animation
  const [frozenCards, setFrozenCards] = useState<PlayedCard[] | null>(null);
  const [isCollecting, setIsCollecting] = useState<boolean>(false);
  const [collectionVectors, setCollectionVectors] = useState<Record<string, { x: number; y: number }>>({});

  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const lastAnimatedTrickIdRef = useRef<number | null>(null);

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

  // Check if a 4-card trick is present (either currently played 4 cards or freshly completed trick)
  const isFourCards = playedCards.length === 4;

  useEffect(() => {
    // Determine completed trick info
    const latestTrick = lastCompletedTrick || (completedTricks.length > 0 ? completedTricks[completedTricks.length - 1] : null);

    if (isFourCards && latestTrick && lastAnimatedTrickIdRef.current !== latestTrick.trickNumber) {
      lastAnimatedTrickIdRef.current = latestTrick.trickNumber;
      const cardsToAnimate = [...playedCards];
      setFrozenCards(cardsToAnimate);
      setIsCollecting(false);

      const targetRelPos = getRelativePosition(latestTrick.winner);

      // Step 1: Wait exactly 1 second (1000ms) with all 4 cards displayed clearly in center
      const timer1 = setTimeout(() => {
        // Step 2: Calculate destination coordinates using getBoundingClientRect()
        const targetSeatEl = document.querySelector(`[data-seat="${targetRelPos}"]`);
        const targetRect = targetSeatEl?.getBoundingClientRect();

        const vectors: Record<string, { x: number; y: number }> = {};
        cardsToAnimate.forEach((pc) => {
          const key = `${pc.cardId}_${pc.playerIndex}`;
          const cardEl = cardRefs.current[key];
          if (cardEl && targetRect) {
            const cardRect = cardEl.getBoundingClientRect();
            const targetCenterX = targetRect.left + targetRect.width / 2;
            const targetCenterY = targetRect.top + targetRect.height / 2;
            const cardCenterX = cardRect.left + cardRect.width / 2;
            const cardCenterY = cardRect.top + cardRect.height / 2;
            vectors[key] = {
              x: targetCenterX - cardCenterX,
              y: targetCenterY - cardCenterY,
            };
          } else {
            // High-visibility fallback offsets towards winning seat
            switch (targetRelPos) {
              case 'bottom': vectors[key] = { x: 0, y: 340 }; break;
              case 'top': vectors[key] = { x: 0, y: -340 }; break;
              case 'left': vectors[key] = { x: -420, y: 0 }; break;
              case 'right': vectors[key] = { x: 420, y: 0 }; break;
            }
          }
        });

        setCollectionVectors(vectors);
        setIsCollecting(true);
        soundManager.playTrickShove();
      }, 1000);

      // Step 3: At 1550ms, animation completes
      const timer2 = setTimeout(() => {
        setFrozenCards(null);
        setIsCollecting(false);
        setCollectionVectors({});
      }, 1550);

      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
      };
    }
  }, [playedCards.length, isFourCards, lastCompletedTrick, completedTricks.length, myPosition]);

  const cardsToRender = frozenCards || playedCards;

  const getPositionStyles = (relPos: 'bottom' | 'left' | 'top' | 'right') => {
    switch (relPos) {
      case 'bottom':
        return 'bottom-1 left-1/2 -translate-x-1/2';
      case 'top':
        return 'top-1 left-1/2 -translate-x-1/2';
      case 'left':
        return 'left-2 top-1/2 -translate-y-1/2';
      case 'right':
        return 'right-2 top-1/2 -translate-y-1/2';
    }
  };

  return (
    <div
      ref={dropZoneRef}
      className="relative w-80 h-64 sm:w-96 sm:h-72 md:w-[28rem] md:h-80 flex items-center justify-center select-none pointer-events-none"
    >
      {/* Invisible drop target hitbox */}
      <div className="absolute inset-0 pointer-events-auto" />

      {/* Played Cards in Trick (Strictly NO player name text underneath cards) */}
      {cardsToRender.map((pc, idx) => {
        const relPos = getRelativePosition(pc.playerIndex);
        const posClass = getPositionStyles(relPos);
        const rotation = CARD_ROTATIONS[idx % CARD_ROTATIONS.length];
        const key = `${pc.cardId}_${pc.playerIndex}`;

        const vector = collectionVectors[key];
        const isCurrentlyGliding = isCollecting && vector !== undefined;

        return (
          <div
            key={key}
            ref={(el) => { cardRefs.current[key] = el; }}
            style={{
              transform: isCurrentlyGliding
                ? `translate3d(${vector.x}px, ${vector.y}px, 0) scale(0.18)`
                : undefined,
              opacity: isCurrentlyGliding ? 0 : 1,
              transition: isCurrentlyGliding
                ? 'transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.45s ease-in'
                : 'none',
              zIndex: isCurrentlyGliding ? 50 : 10 + idx,
            }}
            className={`absolute ${posClass}`}
          >
            <PlayingCard
              cardId={pc.cardId}
              faceDown={false}
              size="md"
              rotation={rotation}
              className="shadow-2xl rounded-xl ring-1 ring-slate-900/10"
            />
          </div>
        );
      })}
    </div>
  );
};
