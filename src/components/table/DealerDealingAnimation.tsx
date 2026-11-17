import React, { useEffect, useState, useRef } from 'react';
import { asset } from '../../common/asset';
import { PlayerPosition } from '../../engine/types';
import { soundManager } from '../../common/SoundManager';

interface DealerDealingAnimationProps {
  dealerIndex: PlayerPosition;
  myPosition: PlayerPosition;
  onDealingComplete: () => void;
}

interface FlyingCard {
  id: number;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  progress: number; // 0 to 1
}

interface Point2D {
  x: number;
  y: number;
}

export const DealerDealingAnimation: React.FC<DealerDealingAnimationProps> = ({
  dealerIndex,
  myPosition,
  onDealingComplete,
}) => {
  const [activeFlyingCards, setActiveFlyingCards] = useState<FlyingCard[]>([]);
  const [dealIndex, setDealIndex] = useState<number>(0);
  const [rhombusPoints, setRhombusPoints] = useState<Record<'top' | 'bottom' | 'left' | 'right', Point2D> | null>(null);

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

  const dealerRel = getRelativePosition(dealerIndex);
  const onDealingCompleteRef = useRef(onDealingComplete);
  onDealingCompleteRef.current = onDealingComplete;

  useEffect(() => {
    // 1. Calculate 4 Rhombus points near each player, perfectly centered
    const w = window.innerWidth;
    const h = window.innerHeight;
    const cx = w / 2;
    const cy = h / 2;

    const topEl = document.querySelector('[data-seat="top"]');
    const bottomEl = document.querySelector('#player-hand') || document.querySelector('[data-seat="bottom"]');
    const leftEl = document.querySelector('[data-seat="left"]');
    const rightEl = document.querySelector('[data-seat="right"]');

    const topRect = topEl?.getBoundingClientRect();
    const bottomRect = bottomEl?.getBoundingClientRect();
    const leftRect = leftEl?.getBoundingClientRect();
    const rightRect = rightEl?.getBoundingClientRect();

    const points: Record<'top' | 'bottom' | 'left' | 'right', Point2D> = {
      top: {
        x: cx,
        y: topRect ? topRect.bottom + 25 : cy - 140,
      },
      bottom: {
        x: cx,
        y: bottomRect ? bottomRect.top - 25 : cy + 140,
      },
      left: {
        x: leftRect ? leftRect.right + 25 : cx - 180,
        y: cy,
      },
      right: {
        x: rightRect ? rightRect.left - 25 : cx + 180,
        y: cy,
      },
    };

    setRhombusPoints(points);

    // 2. Sequential distribution from dealer's point to each player point (1 time for each of 4 players)
    const TOTAL_PLAYERS = 4;
    const INTERVAL_MS = 200;
    const FLIGHT_DURATION_MS = 180;

    const dealerPoint = points[dealerRel];
    const startX = dealerPoint.x;
    const startY = dealerPoint.y;

    let currentStep = 0;
    let completeTimer: ReturnType<typeof setTimeout> | null = null;
    const interval = setInterval(() => {
      if (currentStep >= TOTAL_PLAYERS) {
        clearInterval(interval);
        completeTimer = setTimeout(() => {
          onDealingCompleteRef.current();
        }, FLIGHT_DURATION_MS + 80);
        return;
      }

      // Clockwise distribution to the 4 points: start with player to dealer's left
      const recipientAbs = ((dealerIndex + 1 + currentStep) % 4) as PlayerPosition;
      const recipientRel = getRelativePosition(recipientAbs);
      const targetPoint = points[recipientRel];

      const cardId = currentStep;
      soundManager.playDeal();

      setActiveFlyingCards((prev) => [
        ...prev,
        { id: cardId, startX, startY, targetX: targetPoint.x, targetY: targetPoint.y, progress: 0 },
      ]);

      requestAnimationFrame(() => {
        setTimeout(() => {
          setActiveFlyingCards((prev) =>
            prev.map((c) => (c.id === cardId ? { ...c, progress: 1 } : c))
          );
        }, 20);
      });

      // Remove after landing
      setTimeout(() => {
        setActiveFlyingCards((prev) => prev.filter((c) => c.id !== cardId));
      }, FLIGHT_DURATION_MS + 10);

      currentStep++;
      setDealIndex(currentStep);
    }, INTERVAL_MS);

    return () => {
      clearInterval(interval);
      if (completeTimer) clearTimeout(completeTimer);
    };
  }, [dealerIndex, myPosition, dealerRel]);

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {/* Rhombus 4 Centered Anchor Points */}
      {rhombusPoints &&
        Object.entries(rhombusPoints).map(([pos, pt]) => (
          <div
            key={pos}
            className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none"
            style={{ left: pt.x, top: pt.y }}
          >
            <span className="w-3 h-3 rounded-full bg-cream-100 shadow-[0_0_12px_rgba(245,240,225,0.8)] animate-ping" />
            <span className="absolute w-2 h-2 rounded-full bg-cream-100" />
          </div>
        ))}

      {/* Dealing Progress Pill in Center */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-felt-900/90 border border-cream-100/15 text-cream-100 px-4 py-1.5 shadow-soft text-xs animate-fade-in">
        <span>Dealing… {dealIndex}/4</span>
      </div>

      {/* Flying Card Backs */}
      {activeFlyingCards.map((card) => {
        const currentX = card.startX + (card.targetX - card.startX) * card.progress;
        const currentY = card.startY + (card.targetY - card.startY) * card.progress;
        const rotation = (card.targetX - card.startX) * 0.05;

        return (
          <div
            key={card.id}
            style={{
              position: 'absolute',
              left: `${currentX}px`,
              top: `${currentY}px`,
              transform: `translate(-50%, -50%) rotate(${rotation}deg) scale(${card.progress === 1 ? 0.8 : 1})`,
              transition: 'left 0.18s cubic-bezier(0.2, 0.8, 0.2, 1), top 0.18s cubic-bezier(0.2, 0.8, 0.2, 1), transform 0.18s ease-out',
            }}
            className="w-12 h-16 sm:w-16 sm:h-22 rounded-lg overflow-hidden shadow-2xl border border-felt-900/40 bg-cream-50"
          >
            <img
              src={asset('/assets/cards/card_back.svg')}
              alt="Dealing Card"
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = asset('/assets/cards/card_back.png');
              }}
            />
          </div>
        );
      })}
    </div>
  );
};
