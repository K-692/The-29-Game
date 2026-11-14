import React, { useState } from 'react';
import { CARD_MANIFEST, getCardSvgUrl, getCardPngUrl, CardIdentity } from '../../assets/cardManifest';

export interface PlayingCardProps {
  cardId: string; // e.g. "J_HEARTS" or "CARD_BACK"
  faceDown?: boolean;
  isPlayable?: boolean;
  isSelected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  animateThrow?: boolean;
  rotation?: number; // In degrees, for trick area natural scatter
}

const SIZE_CLASSES = {
  xs: 'w-10 h-14 rounded-sm',
  sm: 'w-14 h-20 rounded-md',
  md: 'w-20 h-28 sm:w-24 sm:h-34 rounded-lg',
  lg: 'w-24 h-34 sm:w-28 sm:h-40 rounded-xl',
  xl: 'w-32 h-44 sm:w-36 sm:h-50 rounded-2xl',
};

export const PlayingCard: React.FC<PlayingCardProps> = ({
  cardId,
  faceDown = false,
  isPlayable = false,
  isSelected = false,
  disabled = false,
  onClick,
  size = 'md',
  className = '',
  animateThrow = false,
  rotation = 0,
}) => {
  const [useFallbackPng, setUseFallbackPng] = useState(false);

  const isBack = faceDown || cardId === 'CARD_BACK';
  const cardData: CardIdentity | undefined = !isBack ? CARD_MANIFEST[cardId] : undefined;

  const assetUrl = useFallbackPng
    ? getCardPngUrl(isBack ? 'CARD_BACK' : cardId)
    : getCardSvgUrl(isBack ? 'CARD_BACK' : cardId);

  const sizeClass = SIZE_CLASSES[size];

  const handleClick = () => {
    if (!disabled && isPlayable && onClick) {
      onClick();
    } else if (onClick && !disabled) {
      onClick();
    }
  };

  return (
    <div
      onClick={handleClick}
      style={{
        transform: rotation ? `rotate(${rotation}deg)` : undefined,
      }}
      className={`
        relative select-none transition-all duration-200 ease-out flex-shrink-0
        ${sizeClass}
        ${isPlayable && !disabled ? 'cursor-pointer hover:-translate-y-4 hover:shadow-card-hover ring-2 ring-amber-400/90 shadow-lg' : ''}
        ${isSelected ? '-translate-y-6 ring-4 ring-amber-400 shadow-2xl z-30' : ''}
        ${disabled ? 'opacity-70 cursor-not-allowed filter brightness-75' : ''}
        ${animateThrow ? 'animate-throw' : ''}
        ${className}
      `}
      title={cardData ? `${cardData.name} (${cardData.points} pts)` : 'Face Down Card'}
    >
      {/* Authentic Card Image */}
      <img
        src={assetUrl}
        alt={cardData ? cardData.name : 'Card Back'}
        onError={() => setUseFallbackPng(true)}
        className="w-full h-full object-contain filter drop-shadow-md pointer-events-none"
        loading="eager"
      />

      {/* Point badge on hover for playable cards */}
      {isPlayable && cardData && cardData.points > 0 && (
        <span className="absolute -top-2 -right-2 bg-amber-500 text-slate-950 text-[10px] font-black px-1.5 py-0.5 rounded-full shadow-md border border-amber-300">
          +{cardData.points}
        </span>
      )}
    </div>
  );
};

