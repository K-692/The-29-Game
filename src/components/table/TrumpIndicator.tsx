import React from 'react';
import { CARD_MANIFEST, SUIT_COLORS, SUIT_SYMBOLS } from '../../assets/cardManifest';
import { PublicGameState } from '../../engine/types';
import { Eye, Sparkles, Layers } from 'lucide-react';
import { PlayingCard } from '../card/PlayingCard';

interface RevealedTrumpTopRightProps {
  publicState: PublicGameState;
}

/**
 * Top-Right persistent indicator: displays the revealed trump suit ONLY after official reveal.
 * Before reveal, hidden trump is completely omitted.
 */
export const RevealedTrumpTopRight: React.FC<RevealedTrumpTopRightProps> = ({ publicState }) => {
  const {
    revealedTrumpSuit,
    isTrumpRevealed,
    trumpMode,
    revealedSeventhCard,
  } = publicState;

  // 1. Joker / No Trump mode: display NO TRUMP
  if (trumpMode === 'no-trump') {
    return (
      <div className="bg-white/95 backdrop-blur-md border border-amber-300 rounded-2xl px-3 py-1.5 shadow-md flex items-center gap-2 text-xs">
        <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
        <span className="font-black text-slate-900 tracking-wider">NO TRUMP</span>
      </div>
    );
  }

  // 2. Only display when officially revealed
  if (!isTrumpRevealed || !revealedTrumpSuit) {
    return null; // Do not display before official reveal!
  }

  // 3. 7th Card Mode: show actual revealed 7th card + trump suit
  if (trumpMode === 'seventh-card' && revealedSeventhCard) {
    const cardObj = CARD_MANIFEST[revealedSeventhCard];
    return (
      <div className="bg-white/95 backdrop-blur-md border border-cyan-400 rounded-2xl p-1.5 pr-3 shadow-md flex items-center gap-2">
        <div className="w-8 h-11 shrink-0 overflow-hidden rounded shadow">
          <PlayingCard cardId={revealedSeventhCard} size="sm" />
        </div>
        <div className="text-left">
          <span className="text-[10px] text-cyan-800 uppercase tracking-wider font-extrabold block">
            7th Card Trump
          </span>
          <div className="flex items-center gap-1">
            <span className={`text-base font-black ${SUIT_COLORS[revealedTrumpSuit] === 'red' ? 'text-rose-600' : 'text-slate-900'}`}>
              {SUIT_SYMBOLS[revealedTrumpSuit]}
            </span>
            <span className="text-xs font-black text-slate-800 tracking-wide uppercase">
              {revealedTrumpSuit}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // 4. Standard Suit Trump
  return (
    <div className="bg-white/95 backdrop-blur-md border border-amber-300 rounded-2xl px-3 py-1.5 shadow-md flex items-center gap-2">
      <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
      <div className="text-left">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold block leading-none">
          Trump
        </span>
        <div className="flex items-center gap-1.5">
          <span className={`text-lg font-black leading-none ${SUIT_COLORS[revealedTrumpSuit] === 'red' ? 'text-rose-600' : 'text-slate-900'}`}>
            {SUIT_SYMBOLS[revealedTrumpSuit]}
          </span>
          <span className="text-xs font-black text-slate-800 tracking-wide uppercase leading-none">
            {revealedTrumpSuit}
          </span>
        </div>
      </div>
    </div>
  );
};

interface AskToRevealTrumpButtonProps {
  canRevealTrump: boolean;
  onRevealTrump: () => void;
}

/**
 * Bottom-Left compact button: appears only when player cannot follow suit and trump is concealed.
 */
export const AskToRevealTrumpButton: React.FC<AskToRevealTrumpButtonProps> = ({
  canRevealTrump,
  onRevealTrump,
}) => {
  if (!canRevealTrump) return null;

  return (
    <button
      type="button"
      onClick={onRevealTrump}
      className="bg-amber-400 hover:bg-amber-300 active:scale-95 text-slate-950 font-black px-4 py-2.5 rounded-2xl text-xs shadow-xl border-2 border-amber-300/80 flex items-center gap-2 transition-all uppercase tracking-wider cursor-pointer"
      title="Ask to reveal the concealed trump suit"
    >
      <Eye className="w-4 h-4 text-slate-950" />
      ASK TO REVEAL TRUMP
    </button>
  );
};
