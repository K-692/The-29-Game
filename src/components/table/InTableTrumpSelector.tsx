import React, { useState } from 'react';
import { CARD_MANIFEST, SUITS, SUIT_COLORS, SUIT_SYMBOLS, Suit } from '../../assets/cardManifest';
import { TrumpSelectionChoice } from '../../engine/types';
import { Lock, Sparkles, Clock, Check, Layers, Award } from 'lucide-react';

interface InTableTrumpSelectorProps {
  handCardIds: string[];
  highestBid: number;
  highestBidderName: string;
  isMyTurn: boolean;
  remainingSeconds: number;
  onSelectTrump: (choice: TrumpSelectionChoice) => void;
}

export const InTableTrumpSelector: React.FC<InTableTrumpSelectorProps> = ({
  handCardIds,
  highestBid,
  highestBidderName,
  isMyTurn,
  remainingSeconds,
  onSelectTrump,
}) => {
  const [selectedChoice, setSelectedChoice] = useState<TrumpSelectionChoice>('SPADES');

  // Count suits in current 4-card hand
  const suitCounts: Record<Suit, number> = { DIAMONDS: 0, HEARTS: 0, CLUBS: 0, SPADES: 0 };
  for (const id of handCardIds) {
    const card = CARD_MANIFEST[id];
    if (card) suitCounts[card.suit]++;
  }

  const isUrgent = remainingSeconds <= 10;

  const getConfirmationLabel = (choice: TrumpSelectionChoice): string => {
    if (choice === 'NO_TRUMP') return 'Confirm Joker / No Trump Mode';
    if (choice === 'SEVENTH_CARD') return 'Confirm 7th Card Trump Mode';
    return `Confirm Concealed Trump: ${choice}`;
  };

  return (
    <div className="w-full max-w-xl mx-auto bg-slate-900/95 backdrop-blur-md border-2 border-amber-500/80 rounded-3xl p-4 sm:p-5 shadow-2xl space-y-3.5 z-30 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-black uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            {isMyTurn ? 'You Won Bid' : 'Trump Selection'} ({highestBid} pts)
          </span>
          <span className="text-xs text-slate-300 font-semibold flex items-center gap-1">
            <Lock className="w-3 h-3 text-amber-400" /> 6 Options Available
          </span>
        </div>

        {/* Countdown Timer */}
        <div
          className={`flex items-center gap-1.5 px-3 py-1 rounded-xl font-mono text-xs font-bold ${
            isUrgent
              ? 'bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse'
              : 'bg-slate-800 text-slate-300 border border-slate-700'
          }`}
        >
          <Clock className={`w-3.5 h-3.5 ${isUrgent ? 'text-red-400' : 'text-amber-400'}`} />
          <span>00:{remainingSeconds.toString().padStart(2, '0')}</span>
        </div>
      </div>

      {isMyTurn ? (
        <div className="space-y-3">
          <p className="text-xs text-slate-400 text-center">
            Select a secret Trump suit, Joker / No Trump, or 7th Card mode. Remaining 4 cards will be dealt afterwards.
          </p>

          {/* 6 Trump Options Grid (2x3) */}
          <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
            {/* 4 Standard Suits */}
            {SUITS.map((suit) => {
              const isSelected = selectedChoice === suit;
              const isRed = SUIT_COLORS[suit] === 'red';
              const count = suitCounts[suit];

              return (
                <button
                  key={suit}
                  type="button"
                  onClick={() => setSelectedChoice(suit)}
                  className={`p-3 rounded-2xl border-2 flex items-center justify-between transition-all ${
                    isSelected
                      ? 'border-amber-400 bg-amber-500/15 ring-2 ring-amber-400/40 shadow-lg scale-[1.02]'
                      : 'border-slate-800 bg-slate-950/70 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className={`text-2xl font-black ${isRed ? 'text-red-500' : 'text-slate-100'}`}>
                      {SUIT_SYMBOLS[suit]}
                    </span>
                    <div className="text-left">
                      <span className="font-bold text-xs text-slate-200 block uppercase tracking-wide">
                        {suit}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {count} in hand
                      </span>
                    </div>
                  </div>

                  {isSelected && (
                    <span className="w-5 h-5 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center font-bold">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </span>
                  )}
                </button>
              );
            })}

            {/* Option 5: Joker / No Trump */}
            <button
              type="button"
              onClick={() => setSelectedChoice('NO_TRUMP')}
              className={`p-3 rounded-2xl border-2 flex items-center justify-between transition-all ${
                selectedChoice === 'NO_TRUMP'
                  ? 'border-amber-400 bg-amber-500/15 ring-2 ring-amber-400/40 shadow-lg scale-[1.02]'
                  : 'border-slate-800 bg-slate-950/70 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-2xl" role="img" aria-label="Joker">
                  🃏
                </span>
                <div className="text-left">
                  <span className="font-bold text-xs text-amber-300 block uppercase tracking-wide flex items-center gap-1">
                    No Trump <Award className="w-3 h-3 text-amber-400" />
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Lead suit wins; no cuts
                  </span>
                </div>
              </div>

              {selectedChoice === 'NO_TRUMP' && (
                <span className="w-5 h-5 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center font-bold">
                  <Check className="w-3 h-3 stroke-[3]" />
                </span>
              )}
            </button>

            {/* Option 6: 7th Card Trump */}
            <button
              type="button"
              onClick={() => setSelectedChoice('SEVENTH_CARD')}
              className={`p-3 rounded-2xl border-2 flex items-center justify-between transition-all ${
                selectedChoice === 'SEVENTH_CARD'
                  ? 'border-amber-400 bg-amber-500/15 ring-2 ring-amber-400/40 shadow-lg scale-[1.02]'
                  : 'border-slate-800 bg-slate-950/70 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-2xl" role="img" aria-label="7th Card">
                  🎴
                </span>
                <div className="text-left">
                  <span className="font-bold text-xs text-cyan-300 block uppercase tracking-wide flex items-center gap-1">
                    7th Card <Layers className="w-3 h-3 text-cyan-400" />
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Reserved from 2nd deal
                  </span>
                </div>
              </div>

              {selectedChoice === 'SEVENTH_CARD' && (
                <span className="w-5 h-5 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center font-bold">
                  <Check className="w-3 h-3 stroke-[3]" />
                </span>
              )}
            </button>
          </div>

          <button
            type="button"
            onClick={() => onSelectTrump(selectedChoice)}
            className="w-full py-2.5 rounded-xl font-black text-xs bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 transform active:scale-95"
          >
            <Lock className="w-4 h-4 text-slate-950" />
            {getConfirmationLabel(selectedChoice)}
          </button>
        </div>
      ) : (
        <div className="text-center py-4 bg-slate-950/60 rounded-2xl border border-slate-800 text-xs text-slate-300 space-y-2">
          <div className="flex items-center justify-center gap-2 font-bold text-amber-400">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
            <span>{highestBidderName} is choosing Trump ({highestBid} pts)...</span>
          </div>
          <p className="text-[11px] text-slate-400">
            The winning bidder can select a suit, Joker (No Trump), or 7th Card mode.
          </p>
        </div>
      )}
    </div>
  );
};
