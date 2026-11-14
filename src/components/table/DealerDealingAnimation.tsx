import React, { useEffect, useState, useRef } from 'react';
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

export const DealerDealingAnimation: React.FC<DealerDealingAnimationProps> = ({
  dealerIndex,
  myPosition,
  onDealingComplete,
}) => {
  const [activeFlyingCards, setActiveFlyingCards] = useState<FlyingCard[]>([]);
  const [dealIndex, setDealIndex] = useState<number>(0);

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

  useEffect(() => {
    // 16 cards sequentially: 4 cards to each of the 4 players
    const TOTAL_CARDS = 16;
    const INTERVAL_MS = 110;
    const FLIGHT_DURATION_MS = 280;

    let currentCard = 0;
    const interval = setInterval(() => {
      if (currentCard >= TOTAL_CARDS) {
        clearInterval(interval);
        setTimeout(() => {
          onDealingComplete();
        }, FLIGHT_DURATION_MS + 100);
        return;
      }

      // Clockwise distribution starting from player to dealer's left
      const recipientAbs = ((dealerIndex + 1 + (currentCard % 4)) % 4) as PlayerPosition;
      const recipientRel = getRelativePosition(recipientAbs);

      // Measure layout coordinates
      const dealerEl = document.querySelector(`[data-seat="${dealerRel}"]`);
      const targetEl = document.querySelector(`[data-seat="${recipientRel}"]`);

      let startX = window.innerWidth / 2;
      let startY = window.innerHeight / 2;
      if (dealerEl) {
        const r = dealerEl.getBoundingClientRect();
        startX = r.left + r.width / 2;
        startY = r.top + r.height / 2;
      }

      let targetX = window.innerWidth / 2;
      let targetY = window.innerHeight * 0.85;
      if (recipientRel === 'bottom') {
        const handEl = document.querySelector('#player-hand');
        if (handEl) {
          const r = handEl.getBoundingClientRect();
          targetX = r.left + r.width / 2;
          targetY = r.top + r.height / 2;
        } else if (targetEl) {
          const r = targetEl.getBoundingClientRect();
          targetX = r.left + r.width / 2;
          targetY = r.top + r.height / 2;
        }
      } else if (targetEl) {
        const r = targetEl.getBoundingClientRect();
        targetX = r.left + r.width / 2;
        targetY = r.top + r.height / 2;
      }

      const cardId = currentCard;
      if (cardId % 4 === 0) {
        soundManager.playDeal();
      }

      setActiveFlyingCards((prev) => [
        ...prev,
        { id: cardId, startX, startY, targetX, targetY, progress: 0 },
      ]);

      // Animate progress to 1
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
      }, FLIGHT_DURATION_MS + 50);

      currentCard++;
      setDealIndex(currentCard);
    }, INTERVAL_MS);

    return () => {
      clearInterval(interval);
    };
  }, [dealerIndex, myPosition, dealerRel]);

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {/* Dealing Progress Pill in Center */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white/95 backdrop-blur-md border border-slate-200 px-4 py-2 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-bold text-slate-800 animate-fade-in">
        <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
        <span>Dealing First 4 Cards ({dealIndex}/16)...</span>
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
              transition: 'left 0.28s cubic-bezier(0.2, 0.8, 0.2, 1), top 0.28s cubic-bezier(0.2, 0.8, 0.2, 1), transform 0.28s ease-out',
            }}
            className="w-12 h-16 sm:w-16 sm:h-22 rounded-lg overflow-hidden shadow-2xl border border-amber-900/40 bg-white"
          >
            <img
              src="/assets/cards/card_back.svg"
              alt="Dealing Card"
              className="w-full h-full object-cover"
              onError={(e) => {
                // Fallback to png if svg fails
                (e.target as HTMLImageElement).src = '/assets/cards/card_back.png';
              }}
            />
          </div>
        );
      })}
    </div>
  );
};
