import React from 'react';
import { CARD_MANIFEST, SUIT_COLORS, SUIT_SYMBOLS, Suit } from '../../assets/cardManifest';
import { PublicGameState, PlayerPosition } from '../../engine/types';
import { Eye, HelpCircle, Lock, Sparkles } from 'lucide-react';

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
  const { revealedTrumpSuit, isTrumpConcealed, isTrumpRevealed, highestBidder, myPosition, trumpRevealedBy } = publicState;

  if (!revealedTrumpSuit && !isTrumpConcealed) {
    return null; // Not selected yet
  }

  const isBidder = myPosition !== null && highestBidder === myPosition;

  return (
    <div className="flex items-center gap-2">
      {isTrumpRevealed && revealedTrumpSuit ? (
        // Revealed Trump Badge
        <div className="bg-slate-900/90 border-2 border-amber-400 rounded-2xl px-3.5 py-1.5 shadow-2xl flex items-center gap-2.5 animate-pulse-subtle">
          <Sparkles className="w-4 h-4 text-amber-400 animate-spin-slow" />
          <div className="text-left">
            <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold block">
              Trump Suit
            </span>
            <div className="flex items-center gap-1.5">
              <span className={`text-xl font-black ${SUIT_COLORS[revealedTrumpSuit] === 'red' ? 'text-red-500' : 'text-slate-100'}`}>
                {SUIT_SYMBOLS[revealedTrumpSuit]}
              </span>
              <span className="text-sm font-black text-slate-100 tracking-wide uppercase">
                {revealedTrumpSuit}
              </span>
            </div>
          </div>
        </div>
      ) : (
        // Concealed Trump
        <div className="flex items-center gap-2">
          <div className="bg-slate-900/90 border border-slate-700 rounded-2xl px-3 py-1.5 shadow-lg flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-400" />
            <div>
              <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold block">
                Trump Status
              </span>
              <span className="text-xs font-bold text-amber-400 flex items-center gap-1">
                Concealed {isBidder && revealedTrumpSuit ? `(${revealedTrumpSuit})` : ''}
              </span>
            </div>
          </div>

          {/* Reveal button if player cannot follow suit */}
          {canRevealTrump && (
            <button
              onClick={onRevealTrump}
              className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black px-3.5 py-2 rounded-xl text-xs shadow-lg shadow-amber-500/20 flex items-center gap-1.5 transition-all animate-bounce"
            >
              <Eye className="w-4 h-4" /> Ask for Trump!
            </button>
          )}
        </div>
      )}
    </div>
  );
};

