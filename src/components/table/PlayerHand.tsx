import React, { useState, useRef, useEffect } from 'react';
import { PlayingCard } from '../card/PlayingCard';
import { soundManager } from '../../common/SoundManager';

export interface DragState {
  isDragging: boolean;
  isOverTarget: boolean;
  cardId: string | null;
}

interface PlayerHandProps {
  cardIds: string[];
  playableCardIds: string[];
  isMyTurn: boolean;
  dropTargetRect: DOMRect | null;
  /** `fromRect` is where the card was released, so it can fly from there to the table. */
  onPlayCard: (cardId: string, fromRect?: DOMRect) => void | Promise<{ success: boolean } | void>;
  onDragStateChange?: (state: DragState) => void;
  disabled?: boolean;
}

export const PlayerHand: React.FC<PlayerHandProps> = ({
  cardIds,
  playableCardIds,
  isMyTurn,
  dropTargetRect,
  onPlayCard,
  onDragStateChange,
  disabled = false,
}) => {
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  const [activeDragCardId, setActiveDragCardId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isActualDrag, setIsActualDrag] = useState<boolean>(false);
  const [pendingPlayCardId, setPendingPlayCardId] = useState<string | null>(null);

  const pointerStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const hasPlayedSlideSoundRef = useRef<boolean>(false);

  // Clear pendingPlayCardId once the card is removed from hand
  useEffect(() => {
    if (pendingPlayCardId && !cardIds.includes(pendingPlayCardId)) {
      setPendingPlayCardId(null);
    }
  }, [cardIds, pendingPlayCardId]);

  if (cardIds.length === 0) {
    return null;
  }

  // Calculate generous horizontal spacing with reduced overlap
  const getOverlapMargin = (index: number) => {
    if (index === 0) return 'ml-0';
    if (cardIds.length >= 7) {
      return '-ml-5 sm:-ml-8 md:-ml-10 lg:-ml-12';
    }
    if (cardIds.length >= 5) {
      return '-ml-4 sm:-ml-6 md:-ml-8 lg:-ml-9';
    }
    return '-ml-2 sm:-ml-4 md:-ml-5 lg:ml-2';
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>, cardId: string) => {
    if (disabled || !isMyTurn) {
      return;
    }

    const isPlayable = playableCardIds.includes(cardId);
    if (!isPlayable) {
      return;
    }

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}

    pointerStartRef.current = { x: e.clientX, y: e.clientY };
    setActiveDragCardId(cardId);
    setIsActualDrag(false);
    setDragOffset({ x: 0, y: 0 });
    hasPlayedSlideSoundRef.current = false;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>, cardId: string) => {
    if (activeDragCardId !== cardId) return;

    const dx = e.clientX - pointerStartRef.current.x;
    const dy = e.clientY - pointerStartRef.current.y;
    const distance = Math.hypot(dx, dy);

    // Strict 8px threshold to differentiate deliberate drag gestures from clicks/taps
    const DRAG_THRESHOLD = 8;

    if (distance >= DRAG_THRESHOLD) {
      if (!isActualDrag) {
        setIsActualDrag(true);
      }

      setDragOffset({ x: dx, y: dy });

      // Determine if pointer is inside the generous invisible drop hitbox on the central table felt
      let isOver = false;
      if (dropTargetRect) {
        isOver = (
          e.clientX >= dropTargetRect.left - 50 &&
          e.clientX <= dropTargetRect.right + 50 &&
          e.clientY >= dropTargetRect.top - 50 &&
          e.clientY <= dropTargetRect.bottom + 60
        );
      } else {
        // Fallback: dragged upward into table center
        isOver = dy < -80;
      }

      onDragStateChange?.({
        isDragging: true,
        isOverTarget: isOver,
        cardId,
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>, cardId: string) => {
    if (activeDragCardId !== cardId) return;

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    if (isActualDrag) {
      let isOver = false;
      if (dropTargetRect) {
        isOver = (
          e.clientX >= dropTargetRect.left - 50 &&
          e.clientX <= dropTargetRect.right + 50 &&
          e.clientY >= dropTargetRect.top - 50 &&
          e.clientY <= dropTargetRect.bottom + 60
        );
      } else {
        isOver = dragOffset.y < -80;
      }

      if (isOver && playableCardIds.includes(cardId)) {
        // Suppress snap-back: mark card as pending in-flight so it does not snap back to hand
        const fromRect = e.currentTarget.getBoundingClientRect();
        setPendingPlayCardId(cardId);
        Promise.resolve(onPlayCard(cardId, fromRect)).then((res) => {
          // Server rejected the play: return the card to the hand.
          if (res && res.success === false) {
            setPendingPlayCardId((cur) => (cur === cardId ? null : cur));
          }
        });
      } else {
        soundManager.playSlide();
      }
    }

    setActiveDragCardId(null);
    setIsActualDrag(false);
    setDragOffset({ x: 0, y: 0 });
    onDragStateChange?.({
      isDragging: false,
      isOverTarget: false,
      cardId: null,
    });
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>, cardId: string) => {
    if (activeDragCardId === cardId) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
      setActiveDragCardId(null);
      setIsActualDrag(false);
      setDragOffset({ x: 0, y: 0 });
      onDragStateChange?.({
        isDragging: false,
        isOverTarget: false,
        cardId: null,
      });
    }
  };

  return (
    <div id="player-hand" className="relative flex flex-col items-center w-full max-w-5xl mx-auto select-none overflow-visible">
      {/* Horizontal Hand of Playing Cards - Generously Spread & Prominent */}
      <div
        className="flex items-end justify-center px-4 pt-12 pb-2 overflow-visible w-full"
        style={{ perspective: '1000px' }}
      >
        {cardIds.map((cardId, index) => {
          const isPlayable = isMyTurn && !disabled && playableCardIds.includes(cardId);
          const isDraggingThis = activeDragCardId === cardId && isActualDrag;
          const isHovered = hoveredCardId === cardId && !isDraggingThis;
          const isCardInFlight = cardId === pendingPlayCardId;

          // Compute z-index so playable cards strictly render above unplayable sibling cards
          let zIndex = index + 10;
          if (isPlayable) zIndex = 35 + index;
          if (isHovered) zIndex = 80;
          if (isDraggingThis) zIndex = 100;

          // Visual transformation: playable cards lift up slightly (-12px) during player's turn; hover lifts to -32px
          let transformStyle = '';
          if (isDraggingThis) {
            transformStyle = `translate3d(${dragOffset.x}px, ${dragOffset.y}px, 0) scale(1.15) rotate(${dragOffset.x * 0.04}deg)`;
          } else if (isHovered) {
            transformStyle = 'translateY(-32px) scale(1.12)';
          } else if (isPlayable) {
            transformStyle = 'translateY(-12px)';
          }

          const overlapMargin = getOverlapMargin(index);
          const isUnplayableDuringTurn = isMyTurn && !disabled && !isPlayable;

          return (
            <div
              key={cardId}
              data-card-id={cardId}
              data-card-playable={isPlayable ? 'true' : 'false'}
              onMouseEnter={() => {
                if (!activeDragCardId) {
                  setHoveredCardId(cardId);
                }
              }}
              onMouseLeave={() => {
                if (hoveredCardId === cardId) {
                  setHoveredCardId(null);
                }
              }}
              onPointerDown={(e) => handlePointerDown(e, cardId)}
              onPointerMove={(e) => handlePointerMove(e, cardId)}
              onPointerUp={(e) => handlePointerUp(e, cardId)}
              onPointerCancel={(e) => handlePointerCancel(e, cardId)}
              style={{
                zIndex,
                transform: transformStyle,
                transition: isDraggingThis || isCardInFlight ? 'none' : 'transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.2s ease',
                touchAction: 'none',
                opacity: isCardInFlight ? 0 : isUnplayableDuringTurn ? 0.65 : 1,
                filter: isUnplayableDuringTurn ? 'brightness(0.9)' : 'none',
                pointerEvents: isCardInFlight ? 'none' : 'auto',
              }}
              className={`
                relative flex-shrink-0 transition-all duration-200 ${overlapMargin}
                ${isPlayable ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}
              `}
            >
              <PlayingCard
                cardId={cardId}
                isPlayable={isPlayable}
                isDragging={isDraggingThis}
                disabled={disabled}
                size="md"
                className={`
                  rounded-xl transition-all duration-200
                  ${isPlayable ? 'animate-card-glow shadow-[0_0_18px_rgba(251,191,36,0.9),0_0_32px_rgba(245,158,11,0.6)]' : 'shadow-lg'}
                  ${isHovered ? 'shadow-[0_0_28px_rgba(251,191,36,1),0_0_48px_rgba(245,158,11,0.8)]' : ''}
                `}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
