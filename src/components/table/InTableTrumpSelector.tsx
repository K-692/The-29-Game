import React, { useState } from 'react';
import { CARD_MANIFEST, SUITS, SUIT_COLORS, SUIT_SYMBOLS, Suit } from '../../assets/cardManifest';
import { TrumpSelectionChoice } from '../../engine/types';
import { soundManager } from '../../common/SoundManager';

interface InTableTrumpSelectorProps {
  handCardIds: string[];
  highestBid: number;
  highestBidderName: string;
  isMyTurn: boolean;
  remainingSeconds: number;
  onSelectTrump: (choice: TrumpSelectionChoice) => void;
}

const SUIT_NAMES: Record<Suit, string> = { DIAMONDS: 'Diamonds', HEARTS: 'Hearts', CLUBS: 'Clubs', SPADES: 'Spades' };

/** Minimal secret-trump chooser: 4 suits, Joker (no trump) and 7th card. */
export const InTableTrumpSelector: React.FC<InTableTrumpSelectorProps> = ({
  handCardIds,
  highestBid,
  highestBidderName,
  isMyTurn,
  remainingSeconds = 15,
  onSelectTrump,
}) => {
  const [selected, setSelected] = useState<TrumpSelectionChoice | null>(null);
  const [sent, setSent] = useState(false);

  const suitCounts: Record<Suit, number> = { DIAMONDS: 0, HEARTS: 0, CLUBS: 0, SPADES: 0 };
  for (const id of handCardIds) {
    const card = CARD_MANIFEST[id];
    if (card) suitCounts[card.suit]++;
  }

  if (!isMyTurn) {
    return (
      <div className="panel w-full max-w-xs mx-auto px-4 py-3 text-center animate-fade-in">
        <div className="panel-title text-base">{highestBidderName} won at {highestBid}</div>
        <p className="text-xs text-cream-300 mt-1 animate-pulse">Choosing a secret trump…</p>
      </div>
    );
  }

  const option = (choice: TrumpSelectionChoice, content: React.ReactNode, hint: string) => {
    const active = selected === choice;
    return (
      <button
        key={choice}
        type="button"
        onClick={() => {
          soundManager.playSlide();
          setSelected(choice);
        }}
        className={`rounded-xl px-2 py-2.5 border text-center transition ${
          active ? 'bg-cream-100 text-felt-800 border-cream-100' : 'border-cream-100/15 hover:border-cream-100/50 hover:bg-cream-100/5'
        }`}
      >
        {content}
        <div className={`text-[10px] mt-0.5 ${active ? 'text-felt-600' : 'text-cream-300/70'}`}>{hint}</div>
      </button>
    );
  };

  return (
    <div className="panel w-full max-w-sm mx-auto p-4 space-y-3 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="panel-title text-lg">Choose trump</div>
        <span className={`font-mono text-sm tabular-nums ${remainingSeconds <= 5 ? 'text-[#e36a56]' : 'text-cream-300'}`}>
          {remainingSeconds}s
        </span>
      </div>
      <p className="text-xs text-cream-300 -mt-1">You won at {highestBid}. Only you will know it until it's revealed.</p>

      <div className="grid grid-cols-4 gap-2">
        {SUITS.map((suit) =>
          option(
            suit,
            <span
              className={`text-3xl leading-none ${
                SUIT_COLORS[suit] === 'red' ? 'text-suit-red' : selected === suit ? 'text-felt-900' : 'text-cream-50'
              }`}
              aria-label={SUIT_NAMES[suit]}
            >
              {SUIT_SYMBOLS[suit]}
            </span>,
            `${suitCounts[suit]} in hand`
          )
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {option('NO_TRUMP', <span className="text-sm font-semibold">Joker</span>, 'No trump')}
        {option('SEVENTH_CARD', <span className="text-sm font-semibold">7th card</span>, 'Your next card decides')}
      </div>

      <button
        type="button"
        disabled={!selected || sent}
        onClick={() => {
          if (!selected) return;
          setSent(true);
          onSelectTrump(selected);
        }}
        className="btn-primary w-full py-2.5"
      >
        {sent ? 'Setting trump…' : 'Confirm'}
      </button>
    </div>
  );
};
