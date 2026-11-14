import React, { useEffect, useState, useRef } from 'react';
import { CompletedTrick, PlayedCard, PlayerInfo, PlayerPosition } from '../../engine/types';
import { PlayingCard } from '../card/PlayingCard';
import { soundManager } from '../../common/SoundManager';

interface TrickAreaProps {
  playedCards: PlayedCard[];
  players: PlayerInfo[];
  myPosition: PlayerPosition;
  completedTricks: CompletedTrick[];
  dropZoneRef?: React.Ref<HTMLDivElement>;
}

// Fixed slight rotation angles for natural card feel
const CARD_ROTATIONS = [-2, 3, -3, 2];

export const TrickArea: React.FC<TrickAreaProps> = ({
  playedCards,
  players,
  myPosition,
  completedTricks,
  dropZoneRef,
}) => {
  // Animation state for 1-second pause & smooth collection towards winning seat
  const [animatingCards, setAnimatingCards] = useState<PlayedCard[] | null>(null);
  const [collectTarget, setCollectTarget] = useState<'bottom' | 'left' | 'top' | 'right' | null>(null);
  const [isCollecting, setIsCollecting] = useState<boolean>(false);

  const prevCompletedCountRef = useRef(completedTricks.length);

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

  // When a trick completes (completedTricks count increases), execute the 1-second pause & collection animation
  useEffect(() => {
    if (completedTricks.length > prevCompletedCountRef.current) {
      const lastTrick = completedTricks[completedTricks.length - 1];
      if (lastTrick && lastTrick.cards && lastTrick.cards.length === 4) {
        // Step 1: Keep all 4 cards visible for exactly 1 second
        setAnimatingCards(lastTrick.cards);
        setIsCollecting(false);
        setCollectTarget(getRelativePosition(lastTrick.winner));

        // Step 2: At 1000ms, start collection animation towards winning player's seat
        const collectTimer = setTimeout(() => {
          setIsCollecting(true);
          soundManager.playCardShove();
        }, 1000);

        // Step 3: At 1500ms, complete the animation and clear trick area
        const endTimer = setTimeout(() => {
          setAnimatingCards(null);
          setIsCollecting(false);
          setCollectTarget(null);
        }, 1550);

        prevCompletedCountRef.current = completedTricks.length;
        return () => {
          clearTimeout(collectTimer);
          clearTimeout(endTimer);
        };
      }
    }
    prevCompletedCountRef.current = completedTricks.length;
  }, [completedTricks.length, myPosition]);

  const cardsToRender = animatingCards || playedCards;

  const getPositionStyles = (relPos: 'bottom' | 'left' | 'top' | 'right') => {
    switch (relPos) {
      case 'bottom':
        return 'bottom-2 left-1/2 -translate-x-1/2';
      case 'top':
        return 'top-2 left-1/2 -translate-x-1/2';
      case 'left':
        return 'left-2 top-1/2 -translate-y-1/2';
      case 'right':
        return 'right-2 top-1/2 -translate-y-1/2';
    }
  };

  const getCollectionTransform = (target: 'bottom' | 'left' | 'top' | 'right') => {
    switch (target) {
      case 'bottom':
        return 'translate3d(0, 260px, 0) scale(0.15) opacity(0)';
      case 'top':
        return 'translate3d(0, -260px, 0) scale(0.15) opacity(0)';
      case 'left':
        return 'translate3d(-320px, 0, 0) scale(0.15) opacity(0)';
      case 'right':
        return 'translate3d(320px, 0, 0) scale(0.15) opacity(0)';
    }
  };

  return (
    <div
      ref={dropZoneRef}
      className="relative w-72 h-56 sm:w-96 sm:h-72 md:w-[28rem] md:h-80 flex items-center justify-center select-none pointer-events-none"
    >
      {/* Invisible drop target hitbox (no visible border, no highlight, no background) */}
      <div className="absolute inset-0 pointer-events-auto" />

      {/* Played Cards in Trick */}
      {cardsToRender.map((pc, idx) => {
        const relPos = getRelativePosition(pc.playerIndex);
        const posClass = getPositionStyles(relPos);
        const rotation = CARD_ROTATIONS[idx % CARD_ROTATIONS.length];

        let collectStyle = '';
        if (isCollecting && collectTarget) {
          collectStyle = getCollectionTransform(collectTarget);
        }

        return (
          <div
            key={`${pc.cardId}_${pc.playerIndex}`}
            style={{
              transform: collectStyle || undefined,
              transition: isCollecting
                ? 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.45s ease-in'
                : 'none',
            }}
            className={`absolute ${posClass} z-10`}
          >
            <PlayingCard
              cardId={pc.cardId}
              faceDown={false}
              size="md"
              rotation={rotation}
              className="shadow-2xl rounded-xl"
            />
          </div>
        );
      })}
    </div>
  );
};
