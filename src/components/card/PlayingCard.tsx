import React, { useState } from 'react';
import { CARD_MANIFEST, getCardSvgUrl, getCardPngUrl, CardIdentity } from '../../assets/cardManifest';

export interface PlayingCardProps {
  cardId: string; // e.g. "J_HEARTS" or "CARD_BACK"
  faceDown?: boolean;
  isPlayable?: boolean;
  isSelected?: boolean;
  isDragging?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  onPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  style?: React.CSSProperties;
  animateThrow?: boolean;
  rotation?: number; // In degrees, for natural scatter
}

// Card dimensions tuned for optimal hierarchy: prominent in hand, balanced on table
const SIZE_CLASSES = {
  xs: 'w-12 h-[4.2rem] rounded-md',
  sm: 'w-16 h-[5.6rem] sm:w-18 sm:h-[6.3rem] md:w-20 md:h-[7rem] rounded-lg',
  md: 'w-22 h-[7.7rem] sm:w-26 sm:h-[9.1rem] md:w-30 md:h-[10.5rem] lg:w-32 lg:h-[11.2rem] rounded-xl',
  lg: 'w-26 h-[9.1rem] sm:w-30 sm:h-[10.5rem] md:w-34 md:h-[11.9rem] rounded-xl',
  xl: 'w-32 h-[11.2rem] sm:w-38 sm:h-[13.3rem] rounded-2xl',
};

export const PlayingCard: React.FC<PlayingCardProps> = ({
  cardId,
  faceDown = false,
  isPlayable = false,
  isSelected = false,
  isDragging = false,
  disabled = false,
  onClick,
  onPointerDown,
  size = 'md',
  className = '',
  style = {},
  animateThrow = false,
  rotation = 0,
}) => {
  const [useFallbackPng, setUseFallbackPng] = useState(false);

  const isBack = faceDown || cardId === 'CARD_BACK';
  const cardData: CardIdentity | undefined = !isBack ? CARD_MANIFEST[cardId] : undefined;

  const getCardTitle = () => {
    if (isBack) return 'Face Down Card';
    if (cardData) return `${cardData.name} (${cardData.points} pts)`;
    if (cardId === '6_HEARTS') return '6 of Hearts (Trump Indicator)';
    if (cardId === '6_SPADES') return '6 of Spades (Trump Indicator)';
    if (cardId === '6_CLUBS') return '6 of Clubs (Trump Indicator)';
    if (cardId === '6_DIAMONDS') return '6 of Diamonds (Trump Indicator)';
    return 'Playing Card';
  };

  const assetUrl = useFallbackPng
    ? getCardPngUrl(isBack ? 'CARD_BACK' : cardId)
    : getCardSvgUrl(isBack ? 'CARD_BACK' : cardId);

  const sizeClass = SIZE_CLASSES[size];

  const handleClick = (e: React.MouseEvent) => {
    if (!disabled && onClick) {
      onClick();
    }
  };

  const combinedTransform = [
    rotation ? `rotate(${rotation}deg)` : '',
    style.transform || '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      onClick={handleClick}
      onPointerDown={onPointerDown}
      style={{
        ...style,
        transform: combinedTransform || undefined,
      }}
      className={`
        relative select-none flex-shrink-0 bg-white opacity-100 rounded-xl
        ${sizeClass}
        ${isPlayable && !disabled ? 'cursor-grab shadow-lg ring-2 ring-amber-400' : 'shadow-md'}
        ${isDragging ? 'cursor-grabbing shadow-2xl ring-4 ring-amber-400 z-50' : ''}
        ${isSelected && !isDragging ? '-translate-y-8 ring-4 ring-amber-400 shadow-2xl z-30' : ''}
        ${disabled ? 'cursor-not-allowed opacity-90' : ''}
        ${animateThrow ? 'animate-throw' : ''}
        ${className}
      `}
      title={getCardTitle()}
    >
      {/* Authentic Card Image (100% Fully Opaque Pure White Background) */}
      <img
        src={assetUrl}
        alt={getCardTitle()}
        onError={() => setUseFallbackPng(true)}
        className="w-full h-full object-contain filter drop-shadow-sm pointer-events-none rounded-xl"
        loading="eager"
        draggable={false}
      />

      {/* Point badge for scoring cards */}
      {isPlayable && cardData && cardData.points > 0 && !isDragging && (
        <span className="absolute -top-2 -right-2 bg-amber-500 text-slate-950 text-[10px] font-black px-1.5 py-0.5 rounded-full shadow-md border border-amber-200 pointer-events-none">
          +{cardData.points}
        </span>
      )}
    </div>
  );
};
