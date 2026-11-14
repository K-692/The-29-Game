import React, { useState, useRef } from 'react';
import { PlayingCard } from '../card/PlayingCard';
import { soundManager } from '../../common/SoundManager';
import { Hand } from 'lucide-react';

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
  onPlayCard: (cardId: string) => void;
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
  const [clickHint, setClickHint] = useState<string | null>(null);

  const pointerStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const hasPlayedSlideSoundRef = useRef<boolean>(false);

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
      setClickHint('Wait for your turn to play');
      setTimeout(() => setClickHint(null), 2500);
      return;
    }

    const isPlayable = playableCardIds.includes(cardId);
    if (!isPlayable) {
      setClickHint('You must follow the suit led!');
      setTimeout(() => setClickHint(null), 2500);
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

    if (distance > 6) {
      if (!isActualDrag) {
        setIsActualDrag(true);
        if (!hasPlayedSlideSoundRef.current) {
          soundManager.playSlide();
          hasPlayedSlideSoundRef.current = true;
        }
      }

      setDragOffset({ x: dx, y: dy });

      // Determine if pointer is inside the generous invisible drop hitbox
      let isOver = false;
      if (dropTargetRect) {
        isOver = (
          e.clientX >= dropTargetRect.left &&
          e.clientX <= dropTargetRect.right &&
          e.clientY >= dropTargetRect.top &&
          e.clientY <= dropTargetRect.bottom
        );
      } else {
        // Fallback: dragged upward into table center
        isOver = dy < -100;
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
          e.clientX >= dropTargetRect.left &&
          e.clientX <= dropTargetRect.right &&
          e.clientY >= dropTargetRect.top &&
          e.clientY <= dropTargetRect.bottom
        );
      } else {
        isOver = dragOffset.y < -100;
      }

      if (isOver && playableCardIds.includes(cardId)) {
        soundManager.playCardPlace();
        onPlayCard(cardId);
      } else {
        soundManager.playSlide();
      }
    } else {
      // Single click / tap to play when it's your turn
      if (isMyTurn && playableCardIds.includes(cardId)) {
        soundManager.playCardPlace();
        onPlayCard(cardId);
      } else {
        setClickHint('Drag card onto the table to play');
        setTimeout(() => setClickHint(null), 2500);
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
      {/* Subtle feedback message only when user attempts an illegal click */}
      {clickHint && (
        <div className="mb-1 px-3 py-0.5 rounded-full bg-white/95 border border-slate-200 text-slate-700 font-semibold text-xs shadow-sm z-20 animate-fade-in">
          {clickHint}
        </div>
      )}

      {/* Horizontal Hand of Playing Cards - Generously Spread & Prominent */}
      <div
        className="flex items-end justify-center px-4 pt-12 pb-2 overflow-visible w-full"
        style={{ perspective: '1000px' }}
      >
        {cardIds.map((cardId, index) => {
          const isPlayable = isMyTurn && !disabled && playableCardIds.includes(cardId);
          const isDraggingThis = activeDragCardId === cardId && isActualDrag;
          const isHovered = hoveredCardId === cardId && !isDraggingThis;

          // Compute z-index so hovered/dragged card strictly renders above all others
          let zIndex = index + 10;
          if (isHovered) zIndex = 60;
          if (isDraggingThis) zIndex = 100;

          // Hover moves card upward (-32px) and scales 1.12x without clipping
          let transformStyle = '';
          if (isDraggingThis) {
            transformStyle = `translate3d(${dragOffset.x}px, ${dragOffset.y}px, 0) scale(1.15) rotate(${dragOffset.x * 0.04}deg)`;
          } else if (isHovered) {
            transformStyle = 'translateY(-32px) scale(1.12)';
          }

          const overlapMargin = getOverlapMargin(index);

          return (
            <div
              key={cardId}
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
                transition: isDraggingThis ? 'none' : 'transform 0.18s cubic-bezier(0.2, 0.8, 0.2, 1)',
                touchAction: 'none',
              }}
              className={`
                relative flex-shrink-0 transition-shadow duration-150 ${overlapMargin}
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
                  rounded-xl shadow-xl transition-all
                  ${isPlayable ? 'ring-2 ring-amber-400' : 'ring-1 ring-slate-300'}
                  ${isHovered ? 'shadow-2xl ring-4 ring-amber-400' : ''}
                `}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
