import React, { useState } from 'react';
import { CARD_MANIFEST, SUITS, SUIT_COLORS, SUIT_SYMBOLS, Suit } from '../../assets/cardManifest';
import { TrumpSelectionChoice } from '../../engine/types';
import { soundManager } from '../../common/SoundManager';
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
  remainingSeconds = 15,
  onSelectTrump,
}) => {
  const [selectedChoice, setSelectedChoice] = useState<TrumpSelectionChoice>('SPADES');

  // Count suits in current 4-card hand
  const suitCounts: Record<Suit, number> = { DIAMONDS: 0, HEARTS: 0, CLUBS: 0, SPADES: 0 };
  for (const id of handCardIds) {
    const card = CARD_MANIFEST[id];
    if (card) suitCounts[card.suit]++;
  }

  const isUrgent = remainingSeconds <= 5;

  const getConfirmationLabel = (choice: TrumpSelectionChoice): string => {
    if (choice === 'NO_TRUMP') return 'Confirm Joker / No Trump Mode';
    if (choice === 'SEVENTH_CARD') return 'Confirm 7th Card Trump Mode';
    return `Confirm Concealed Trump: ${choice}`;
  };

  return (
    <div className="w-full max-w-sm sm:max-w-md mx-auto bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl p-3 sm:p-3.5 shadow-2xl space-y-2 z-30 select-none text-slate-900 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-amber-900 text-[11px] font-black uppercase tracking-wider">
            <Sparkles className="w-3 h-3 text-amber-600" />
            {isMyTurn ? 'You Won Bid' : 'Trump Selection'} ({highestBid} pts)
          </span>
          <span className="text-[11px] text-slate-600 font-semibold flex items-center gap-1">
            <Lock className="w-3 h-3 text-amber-600" /> 6 Options
          </span>
        </div>

        {/* 30s Countdown Timer */}
        <div
          className={`flex items-center gap-1 px-2 py-0.5 rounded-lg font-mono text-[11px] font-black ${
            isUrgent
              ? 'bg-red-500 text-white animate-pulse'
              : 'bg-amber-100 text-amber-950 border border-amber-300/60'
          }`}
        >
          <Clock className="w-3 h-3" />
          <span>00:{remainingSeconds.toString().padStart(2, '0')}</span>
        </div>
      </div>

      {isMyTurn ? (
        <div className="space-y-2">
          <p className="text-[11px] text-slate-500 text-center">
            Pick a secret Trump suit, Joker / No Trump, or 7th Card mode.
          </p>

          {/* 6 Trump Options Grid (2x3) */}
          <div className="grid grid-cols-2 gap-1.5">
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
                  className={`p-2 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                    isSelected
                      ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-400/40 shadow-xs scale-[1.01]'
                      : 'border-slate-200 bg-slate-50/80 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xl font-black ${isRed ? 'text-red-600' : 'text-slate-900'}`}>
                      {SUIT_SYMBOLS[suit]}
                    </span>
                    <div className="text-left">
                      <span className="font-bold text-[11px] text-slate-900 block uppercase tracking-wide">
                        {suit}
                      </span>
                      <span className="text-[9px] text-slate-500">
                        {count} in hand
                      </span>
                    </div>
                  </div>

                  {isSelected && (
                    <span className="w-3.5 h-3.5 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </span>
                  )}
                </button>
              );
            })}

            {/* Option 5: Joker / No Trump */}
            <button
              type="button"
              onClick={() => setSelectedChoice('NO_TRUMP')}
              className={`p-2 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                selectedChoice === 'NO_TRUMP'
                  ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-400/40 shadow-xs scale-[1.01]'
                  : 'border-slate-200 bg-slate-50/80 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className="text-xl" role="img" aria-label="Joker">
                  🃏
                </span>
                <div className="text-left">
                  <span className="font-bold text-[11px] text-amber-800 block uppercase tracking-wide flex items-center gap-1">
                    No Trump <Award className="w-2.5 h-2.5 text-amber-600" />
                  </span>
                  <span className="text-[9px] text-slate-500">
                    Lead suit wins
                  </span>
                </div>
              </div>

              {selectedChoice === 'NO_TRUMP' && (
                <span className="w-3.5 h-3.5 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold">
                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                </span>
              )}
            </button>

            {/* Option 6: 7th Card Trump */}
            <button
              type="button"
              onClick={() => setSelectedChoice('SEVENTH_CARD')}
              className={`p-2 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                selectedChoice === 'SEVENTH_CARD'
                  ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-400/40 shadow-xs scale-[1.01]'
                  : 'border-slate-200 bg-slate-50/80 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className="text-xl" role="img" aria-label="7th Card">
                  🎴
                </span>
                <div className="text-left">
                  <span className="font-bold text-[11px] text-teal-800 block uppercase tracking-wide flex items-center gap-1">
                    7th Card <Layers className="w-2.5 h-2.5 text-teal-600" />
                  </span>
                  <span className="text-[9px] text-slate-500">
                    Reserved from deal 2
                  </span>
                </div>
              </div>

              {selectedChoice === 'SEVENTH_CARD' && (
                <span className="w-3.5 h-3.5 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold">
                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                </span>
              )}
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              soundManager.playTrumpSelect();
              onSelectTrump(selectedChoice);
            }}
            className="w-full py-2 rounded-xl font-black text-xs uppercase tracking-wider bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
          >
            <Lock className="w-3 h-3 text-slate-950" />
            {getConfirmationLabel(selectedChoice)}
          </button>
        </div>
      ) : (
        <div className="text-center py-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600">
          {highestBidderName} is choosing Trump ({highestBid} pts)...
        </div>
      )}
    </div>
  );
};
