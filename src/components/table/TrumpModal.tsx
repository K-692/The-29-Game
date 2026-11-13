import React, { useState } from 'react';
import { CARD_MANIFEST, SUITS, SUIT_COLORS, SUIT_SYMBOLS, Suit } from '../../assets/cardManifest';
import { PlayingCard } from '../card/PlayingCard';
import { Lock, Sparkles } from 'lucide-react';

interface TrumpModalProps {
  handCardIds: string[];
  highestBid: number;
  onSelectTrump: (suit: Suit) => void;
}

export const TrumpModal: React.FC<TrumpModalProps> = ({
  handCardIds,
  highestBid,
  onSelectTrump,
}) => {
  const [selectedSuit, setSelectedSuit] = useState<Suit>('SPADES');

  // Count how many cards in hand for each suit
  const suitCounts: Record<Suit, number> = { DIAMONDS: 0, HEARTS: 0, CLUBS: 0, SPADES: 0 };
  for (const id of handCardIds) {
    const card = CARD_MANIFEST[id];
    if (card) suitCounts[card.suit]++;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border-2 border-amber-500 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-400/30 text-amber-400 text-xs font-black uppercase tracking-wider">
            <Sparkles className="w-4 h-4 text-amber-500" /> Bidding Won ({highestBid} pts)
          </div>
          <h2 className="text-2xl font-black text-slate-100">Select Secret Trump Suit</h2>
          <p className="text-xs text-slate-400 flex items-center justify-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            Trump remains concealed until revealed during trick play
          </p>
        </div>

        {/* Your 4 Initial Cards Reference */}
        <div>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2 text-center">
            Your 4 Cards (Phase 1 Deal)
          </span>
          <div className="flex justify-center -space-x-4">
            {handCardIds.map((cardId) => (
              <PlayingCard key={cardId} cardId={cardId} size="sm" />
            ))}
          </div>
        </div>

        {/* Suit Options Grid */}
        <div className="grid grid-cols-2 gap-3">
          {SUITS.map((suit) => {
            const isSelected = selectedSuit === suit;
            const isRed = SUIT_COLORS[suit] === 'red';
            const count = suitCounts[suit];

            return (
              <button
                key={suit}
                onClick={() => setSelectedSuit(suit)}
                className={`p-4 rounded-2xl border-2 flex items-center justify-between transition-all ${
                  isSelected
                    ? 'border-amber-400 bg-amber-500/15 ring-2 ring-amber-400/40 shadow-xl'
                    : 'border-slate-800 bg-slate-950/60 hover:bg-slate-800/60 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`text-3xl font-black ${isRed ? 'text-red-500' : 'text-slate-100'}`}>
                    {SUIT_SYMBOLS[suit]}
                  </span>
                  <div className="text-left">
                    <span className="font-bold text-sm text-slate-200 block uppercase tracking-wide">
                      {suit}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">
                      {count} card{count !== 1 ? 's' : ''} in hand
                    </span>
                  </div>
                </div>

                {isSelected && (
                  <span className="w-3 h-3 rounded-full bg-amber-400 shadow-glow" />
                )}
              </button>
            );
          })}
        </div>

        {/* Action Button */}
        <button
          onClick={() => onSelectTrump(selectedSuit)}
          className="w-full py-3.5 rounded-xl font-black text-sm bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-xl shadow-amber-500/25 transition-all transform active:scale-95"
        >
          Confirm Concealed Trump: {selectedSuit}
        </button>
      </div>
    </div>
  );
};
