import React from 'react';
import { CARD_MANIFEST, SUIT_COLORS, SUIT_SYMBOLS } from '../../assets/cardManifest';
import { PublicGameState } from '../../engine/types';
import { Eye, Lock, Sparkles, Layers, Award } from 'lucide-react';

interface TrumpIndicatorProps {
  publicState: PublicGameState;
  onRevealTrump: () => void;
  canRevealTrump: boolean;
}

export const TrumpIndicator: React.FC<TrumpIndicatorProps> = ({
  publicState,
  onRevealTrump,
  canRevealTrump,
}) => {
  const {
    revealedTrumpSuit,
    isTrumpConcealed,
    isTrumpRevealed,
    highestBidder,
    myPosition,
    trumpMode,
    revealedSeventhCard,
    hasSeventhCardReserved,
  } = publicState;

  if (!revealedTrumpSuit && !isTrumpConcealed && trumpMode !== 'no-trump' && !hasSeventhCardReserved) {
    return null; // Not selected yet
  }

  const isBidder = myPosition !== null && highestBidder === myPosition;

  // 1. Joker / No Trump Mode
  if (trumpMode === 'no-trump') {
    return (
      <div className="bg-white/95 backdrop-blur-md border border-amber-300 rounded-2xl px-3.5 py-1.5 shadow-md flex items-center gap-2.5">
        <span className="text-xl" role="img" aria-label="No Trump">
          🃏
        </span>
        <div className="text-left">
          <span className="text-[10px] text-amber-700 uppercase tracking-wider font-extrabold flex items-center gap-1">
            No Trump Mode <Award className="w-3 h-3 text-amber-600" />
          </span>
          <span className="text-xs font-bold text-slate-700">
            Highest lead card wins · No cuts
          </span>
        </div>
      </div>
    );
  }

  // 2. 7th Card Mode
  if (trumpMode === 'seventh-card' || hasSeventhCardReserved || revealedSeventhCard) {
    if (isTrumpRevealed && revealedTrumpSuit) {
      const cardObj = revealedSeventhCard ? CARD_MANIFEST[revealedSeventhCard] : null;
      return (
        <div className="bg-white/95 backdrop-blur-md border border-cyan-300 rounded-2xl px-3.5 py-1.5 shadow-md flex items-center gap-2.5">
          <Layers className="w-4 h-4 text-cyan-600" />
          <div className="text-left">
            <span className="text-[10px] text-cyan-700 uppercase tracking-wider font-bold block">
              7th Card Revealed Trump
            </span>
            <div className="flex items-center gap-1.5">
              <span className={`text-xl font-black ${SUIT_COLORS[revealedTrumpSuit] === 'red' ? 'text-rose-600' : 'text-slate-900'}`}>
                {SUIT_SYMBOLS[revealedTrumpSuit]}
              </span>
              <span className="text-xs font-black text-slate-800 tracking-wide uppercase">
                {revealedTrumpSuit} ({cardObj ? cardObj.name : 'Revealed'})
              </span>
            </div>
          </div>
        </div>
      );
    }

    // Concealed 7th Card
    return (
      <div className="flex items-center gap-2">
        <div className="bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl px-3.5 py-1.5 shadow-md flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-600" />
          <div>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block">
              Trump: 7th Card
            </span>
            <span className="text-xs font-bold text-cyan-700 flex items-center gap-1">
              Reserved Face-Down {isBidder && revealedSeventhCard ? `(${CARD_MANIFEST[revealedSeventhCard]?.name})` : ''}
            </span>
          </div>
        </div>

        {canRevealTrump && (
          <button
            type="button"
            onClick={onRevealTrump}
            className="bg-amber-400 hover:bg-amber-300 active:scale-95 text-slate-950 font-bold px-3.5 py-1.5 rounded-xl text-xs shadow-md flex items-center gap-1.5 transition-all animate-bounce"
          >
            <Eye className="w-4 h-4 text-slate-900" /> Reveal 7th Card!
          </button>
        )}
      </div>
    );
  }

  // 3. Standard Suit Trump
  return (
    <div className="flex items-center gap-2">
      {isTrumpRevealed && revealedTrumpSuit ? (
        // Revealed Trump Badge
        <div className="bg-white/95 backdrop-blur-md border border-amber-300 rounded-2xl px-3.5 py-1.5 shadow-md flex items-center gap-2.5">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <div className="text-left">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold block">
              Trump Suit
            </span>
            <div className="flex items-center gap-1.5">
              <span className={`text-xl font-black ${SUIT_COLORS[revealedTrumpSuit] === 'red' ? 'text-rose-600' : 'text-slate-900'}`}>
                {SUIT_SYMBOLS[revealedTrumpSuit]}
              </span>
              <span className="text-sm font-black text-slate-800 tracking-wide uppercase">
                {revealedTrumpSuit}
              </span>
            </div>
          </div>
        </div>
      ) : (
        // Concealed Trump
        <div className="flex items-center gap-2">
          <div className="bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl px-3.5 py-1.5 shadow-md flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-600" />
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block">
                Trump Status
              </span>
              <span className="text-xs font-bold text-amber-700 flex items-center gap-1">
                Concealed {isBidder && revealedTrumpSuit ? `(${revealedTrumpSuit})` : ''}
              </span>
            </div>
          </div>

          {/* Reveal button if player cannot follow suit */}
          {canRevealTrump && (
            <button
              type="button"
              onClick={onRevealTrump}
              className="bg-amber-400 hover:bg-amber-300 active:scale-95 text-slate-950 font-bold px-3.5 py-1.5 rounded-xl text-xs shadow-md flex items-center gap-1.5 transition-all animate-bounce"
            >
              <Eye className="w-4 h-4 text-slate-900" /> Ask for Trump!
            </button>
          )}
        </div>
      )}
    </div>
  );
};
