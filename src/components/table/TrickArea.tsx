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
  flyingCardId?: string | null;
}

const SLOT_ROTATIONS: Record<'bottom' | 'top' | 'left' | 'right', number> = {
  bottom: -2,
  top: 2,
  left: 3,
  right: -3,
};

export const TrickArea: React.FC<TrickAreaProps> = ({
  playedCards,
  players,
  myPosition,
  completedTricks,
  lastCompletedTrick,
  dropZoneRef,
  flyingCardId,
}) => {
  // State for freeze-frame and collection animation
  const [frozenCards, setFrozenCards] = useState<PlayedCard[] | null>(null);
  const [isCollecting, setIsCollecting] = useState<boolean>(false);
  const [collectionVectors, setCollectionVectors] = useState<Record<string, { x: number; y: number }>>({});

  const slotRefs = {
    bottom: useRef<HTMLDivElement>(null),
    top: useRef<HTMLDivElement>(null),
    left: useRef<HTMLDivElement>(null),
    right: useRef<HTMLDivElement>(null),
  };

  const lastAnimatedTrickKeyRef = useRef<string | null>(null);
  const timer1Ref = useRef<NodeJS.Timeout | null>(null);
  const timer2Ref = useRef<NodeJS.Timeout | null>(null);

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

  // Check if a 4-card trick is present
  const isFourCards = playedCards.length === 4;

  useEffect(() => {
    // Only begin the 1000ms freeze-frame when all 4 cards have fully landed (flyingCardId is null)
    if (!isFourCards || flyingCardId) {
      return;
    }

    const latestTrick = lastCompletedTrick || (completedTricks.length > 0 ? completedTricks[completedTricks.length - 1] : null);
    if (!latestTrick) return;

    const trickKey = `trick_${latestTrick.trickNumber}_len${completedTricks.length}_w${latestTrick.winner}`;
    if (lastAnimatedTrickKeyRef.current === trickKey) {
      return;
    }
    lastAnimatedTrickKeyRef.current = trickKey;

    const cardsToAnimate = [...playedCards];
    setFrozenCards(cardsToAnimate);
    setIsCollecting(false);

    const targetRelPos = getRelativePosition(latestTrick.winner);

    if (timer1Ref.current) clearTimeout(timer1Ref.current);
    if (timer2Ref.current) clearTimeout(timer2Ref.current);

    // Step 1: Hold all 4 cards on the table for exactly 1000ms
    timer1Ref.current = setTimeout(() => {
      // Step 2: Calculate vectors towards winning player's seat
      const targetSeatEl = document.querySelector(`[data-seat="${targetRelPos}"]`);
      const targetRect = targetSeatEl?.getBoundingClientRect();

      const vectors: Record<string, { x: number; y: number }> = {};
      cardsToAnimate.forEach((pc) => {
        const key = `${pc.cardId}_${pc.playerIndex}`;
        const pcRelPos = getRelativePosition(pc.playerIndex);
        const slotEl = slotRefs[pcRelPos].current;

        if (slotEl && targetRect) {
          const slotRect = slotEl.getBoundingClientRect();
          const targetCenterX = targetRect.left + targetRect.width / 2;
          const targetCenterY = targetRect.top + targetRect.height / 2;
          const slotCenterX = slotRect.left + slotRect.width / 2;
          const slotCenterY = slotRect.top + slotRect.height / 2;
          vectors[key] = {
            x: targetCenterX - slotCenterX,
            y: targetCenterY - slotCenterY,
          };
        } else {
          // Fallback offsets
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

    // Step 3: At 1450ms (1000ms pause + 450ms glide), collection completes
    timer2Ref.current = setTimeout(() => {
      setFrozenCards(null);
      setIsCollecting(false);
      setCollectionVectors({});
    }, 1450);
  }, [isFourCards, flyingCardId, lastCompletedTrick, completedTricks.length, myPosition]);

  useEffect(() => {
    return () => {
      if (timer1Ref.current) clearTimeout(timer1Ref.current);
      if (timer2Ref.current) clearTimeout(timer2Ref.current);
    };
  }, []);

  // Cards to render: either currently frozen cards (during collection) or played cards
  const cardsToRender = frozenCards || playedCards;

  // Group cards by their relative slot
  const cardsBySlot: Record<'bottom' | 'top' | 'left' | 'right', PlayedCard | null> = {
    bottom: null,
    top: null,
    left: null,
    right: null,
  };

  cardsToRender.forEach((pc) => {
    const relPos = getRelativePosition(pc.playerIndex);
    cardsBySlot[relPos] = pc;
  });

  return (
    <div
      ref={dropZoneRef}
      id="trick-area"
      className="relative w-64 h-52 sm:w-72 sm:h-60 md:w-80 md:h-64 flex items-center justify-center select-none pointer-events-none"
    >
      {/* Invisible drop target hitbox */}
      <div className="absolute inset-0 pointer-events-auto" />

      {/* 4 Dedicated Slots with Fixed Anchors - Compact size='sm' to prevent table seat overlaps */}
      {/* 1. BOTTOM SLOT */}
      <div
        ref={slotRefs.bottom}
        data-trick-slot="bottom"
        className="absolute bottom-2 left-1/2 -translate-x-1/2 w-16 h-[5.6rem] sm:w-18 sm:h-[6.3rem] md:w-20 md:h-[7rem] flex items-center justify-center pointer-events-none"
      >
        {cardsBySlot.bottom && cardsBySlot.bottom.cardId !== flyingCardId && (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{
              transform: isCollecting && collectionVectors[`${cardsBySlot.bottom.cardId}_${cardsBySlot.bottom.playerIndex}`]
                ? `translate3d(${collectionVectors[`${cardsBySlot.bottom.cardId}_${cardsBySlot.bottom.playerIndex}`].x}px, ${collectionVectors[`${cardsBySlot.bottom.cardId}_${cardsBySlot.bottom.playerIndex}`].y}px, 0) scale(0.55)`
                : undefined,
              transition: isCollecting ? 'transform 0.45s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.45s ease-in' : undefined,
              opacity: isCollecting ? 0.3 : 1,
            }}
          >
            <PlayingCard
              cardId={cardsBySlot.bottom.cardId}
              rotation={SLOT_ROTATIONS.bottom}
              size="sm"
              className="rounded-lg shadow-xl border border-slate-200/40"
            />
          </div>
        )}
      </div>

      {/* 2. TOP SLOT */}
      <div
        ref={slotRefs.top}
        data-trick-slot="top"
        className="absolute top-2 left-1/2 -translate-x-1/2 w-16 h-[5.6rem] sm:w-18 sm:h-[6.3rem] md:w-20 md:h-[7rem] flex items-center justify-center pointer-events-none"
      >
        {cardsBySlot.top && cardsBySlot.top.cardId !== flyingCardId && (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{
              transform: isCollecting && collectionVectors[`${cardsBySlot.top.cardId}_${cardsBySlot.top.playerIndex}`]
                ? `translate3d(${collectionVectors[`${cardsBySlot.top.cardId}_${cardsBySlot.top.playerIndex}`].x}px, ${collectionVectors[`${cardsBySlot.top.cardId}_${cardsBySlot.top.playerIndex}`].y}px, 0) scale(0.55)`
                : undefined,
              transition: isCollecting ? 'transform 0.45s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.45s ease-in' : undefined,
              opacity: isCollecting ? 0.3 : 1,
            }}
          >
            <PlayingCard
              cardId={cardsBySlot.top.cardId}
              rotation={SLOT_ROTATIONS.top}
              size="sm"
              className="rounded-lg shadow-xl border border-slate-200/40"
            />
          </div>
        )}
      </div>

      {/* 3. LEFT SLOT */}
      <div
        ref={slotRefs.left}
        data-trick-slot="left"
        className="absolute left-3 top-1/2 -translate-y-1/2 w-16 h-[5.6rem] sm:w-18 sm:h-[6.3rem] md:w-20 md:h-[7rem] flex items-center justify-center pointer-events-none"
      >
        {cardsBySlot.left && cardsBySlot.left.cardId !== flyingCardId && (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{
              transform: isCollecting && collectionVectors[`${cardsBySlot.left.cardId}_${cardsBySlot.left.playerIndex}`]
                ? `translate3d(${collectionVectors[`${cardsBySlot.left.cardId}_${cardsBySlot.left.playerIndex}`].x}px, ${collectionVectors[`${cardsBySlot.left.cardId}_${cardsBySlot.left.playerIndex}`].y}px, 0) scale(0.55)`
                : undefined,
              transition: isCollecting ? 'transform 0.45s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.45s ease-in' : undefined,
              opacity: isCollecting ? 0.3 : 1,
            }}
          >
            <PlayingCard
              cardId={cardsBySlot.left.cardId}
              rotation={SLOT_ROTATIONS.left}
              size="sm"
              className="rounded-lg shadow-xl border border-slate-200/40"
            />
          </div>
        )}
      </div>

      {/* 4. RIGHT SLOT */}
      <div
        ref={slotRefs.right}
        data-trick-slot="right"
        className="absolute right-3 top-1/2 -translate-y-1/2 w-16 h-[5.6rem] sm:w-18 sm:h-[6.3rem] md:w-20 md:h-[7rem] flex items-center justify-center pointer-events-none"
      >
        {cardsBySlot.right && cardsBySlot.right.cardId !== flyingCardId && (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{
              transform: isCollecting && collectionVectors[`${cardsBySlot.right.cardId}_${cardsBySlot.right.playerIndex}`]
                ? `translate3d(${collectionVectors[`${cardsBySlot.right.cardId}_${cardsBySlot.right.playerIndex}`].x}px, ${collectionVectors[`${cardsBySlot.right.cardId}_${cardsBySlot.right.playerIndex}`].y}px, 0) scale(0.55)`
                : undefined,
              transition: isCollecting ? 'transform 0.45s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.45s ease-in' : undefined,
              opacity: isCollecting ? 0.3 : 1,
            }}
          >
            <PlayingCard
              cardId={cardsBySlot.right.cardId}
              rotation={SLOT_ROTATIONS.right}
              size="sm"
              className="rounded-lg shadow-xl border border-slate-200/40"
            />
          </div>
        )}
      </div>
    </div>
  );
};
