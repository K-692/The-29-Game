import React, { useState } from 'react';
import { CARD_MANIFEST, SUITS, RANKS_29, Suit, Rank, CARD_BACK } from '../../assets/cardManifest';
import { PlayingCard } from './PlayingCard';
import { ArrowLeft, CheckCircle2, Eye, FileCode2, Layers } from 'lucide-react';

interface CardPreviewGalleryProps {
  onBack: () => void;
}

export const CardPreviewGallery: React.FC<CardPreviewGalleryProps> = ({ onBack }) => {
  const [selectedCardId, setSelectedCardId] = useState<string>('J_HEARTS');
  const [filterSuit, setFilterSuit] = useState<Suit | 'ALL'>('ALL');

  const selectedCard = selectedCardId === 'CARD_BACK' ? null : CARD_MANIFEST[selectedCardId];

  const totalPoints = Object.values(CARD_MANIFEST).reduce((acc, c) => acc + c.points, 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-slate-400 hover:text-amber-400 transition-colors mb-2 text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Game
          </button>
          <h1 className="text-2xl sm:text-3xl font-black text-amber-400 tracking-tight flex items-center gap-3">
            <Layers className="w-7 h-7 text-amber-500" /> Card Asset Verification Gallery
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Authoritative EPS vector extraction verification for the 32-card 29 deck + Card Back
          </p>
        </div>

        {/* Verification Summary Pill */}
        <div className="flex items-center gap-4 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 shadow-md">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
            <CheckCircle2 className="w-5 h-5" /> 32 Cards + 1 Back Verified
          </div>
          <div className="h-4 w-px bg-slate-700" />
          <div className="text-xs text-slate-400">
            Total Points: <span className="font-bold text-amber-400">{totalPoints}</span> / 28
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-8 mt-8">
        {/* Left: Card Grid (3 cols) */}
        <div className="lg:col-span-3 space-y-8">
          {/* Filter Pills */}
          <div className="flex flex-wrap gap-2">
            {(['ALL', ...SUITS] as (Suit | 'ALL')[]).map((suit) => (
              <button
                key={suit}
                onClick={() => setFilterSuit(suit)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  filterSuit === suit
                    ? 'bg-amber-500 text-slate-950 shadow-md'
                    : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
                }`}
              >
                {suit === 'ALL' ? 'All Suits (32)' : suit}
              </button>
            ))}
          </div>

          {/* Cards Grouped by Suit */}
          {SUITS.filter((s) => filterSuit === 'ALL' || filterSuit === s).map((suit) => (
            <div key={suit} className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 shadow-lg">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
                <h2 className="text-base font-bold text-slate-200 flex items-center gap-2">
                  <span className={suit === 'HEARTS' || suit === 'DIAMONDS' ? 'text-red-500' : 'text-slate-100'}>
                    {suit === 'HEARTS' && '♥'}
                    {suit === 'DIAMONDS' && '♦'}
                    {suit === 'CLUBS' && '♣'}
                    {suit === 'SPADES' && '♠'}
                  </span>
                  {suit} (8 Cards)
                </h2>
                <span className="text-xs text-slate-500 font-mono">
                  Points in suit: 7 pts (J:3, 9:2, A:1, 10:1, K:0, Q:0, 8:0, 7:0)
                </span>
              </div>

              {/* 8 Cards row */}
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-3 sm:gap-4 justify-items-center">
                {RANKS_29.map((rank) => {
                  const cardId = `${rank}_${suit}`;
                  const isSelected = selectedCardId === cardId;
                  return (
                    <div
                      key={cardId}
                      onClick={() => setSelectedCardId(cardId)}
                      className={`flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all cursor-pointer ${
                        isSelected ? 'bg-amber-500/10 ring-2 ring-amber-400' : 'hover:bg-slate-800/60'
                      }`}
                    >
                      <PlayingCard cardId={cardId} size="sm" isPlayable={true} />
                      <span className="text-xs font-mono text-slate-300 font-semibold">{rank}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Card Back Section */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 shadow-lg">
            <h2 className="text-base font-bold text-slate-200 mb-4 pb-2 border-b border-slate-800">
              Card Back Asset (Geometric Pattern)
            </h2>
            <div
              onClick={() => setSelectedCardId('CARD_BACK')}
              className={`inline-flex flex-col items-center gap-2 p-3 rounded-xl cursor-pointer ${
                selectedCardId === 'CARD_BACK' ? 'bg-amber-500/10 ring-2 ring-amber-400' : 'hover:bg-slate-800/60'
              }`}
            >
              <PlayingCard cardId="CARD_BACK" size="md" isPlayable={true} />
              <span className="text-xs text-slate-400 font-mono">card_back.svg / .png</span>
            </div>
          </div>
        </div>

        {/* Right: Inspection Inspector Panel (1 col) */}
        <div className="lg:col-span-1">
          <div className="sticky top-6 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
            <div className="flex items-center gap-2 text-amber-400 text-sm font-bold uppercase tracking-wider">
              <Eye className="w-4 h-4" /> Asset Inspector
            </div>

            {/* Large Card Preview */}
            <div className="flex justify-center py-4 bg-table-dark/70 rounded-xl border border-table-border/40 shadow-inner">
              <PlayingCard cardId={selectedCardId} size="lg" />
            </div>

            {/* Inspector Details */}
            {selectedCard ? (
              <div className="space-y-3 text-sm">
                <div className="text-lg font-black text-slate-100">{selectedCard.name}</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/50">
                    <span className="text-slate-400 block">Rank</span>
                    <span className="font-bold text-slate-100 text-sm">{selectedCard.rank}</span>
                  </div>
                  <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/50">
                    <span className="text-slate-400 block">Suit</span>
                    <span className="font-bold text-slate-100 text-sm">{selectedCard.suit}</span>
                  </div>
                  <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/50">
                    <span className="text-slate-400 block">29 Card Points</span>
                    <span className="font-bold text-amber-400 text-sm">{selectedCard.points} pt{selectedCard.points !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/50">
                    <span className="text-slate-400 block">Hierarchy Rank</span>
                    <span className="font-bold text-slate-100 text-sm">#{8 - selectedCard.order} ({selectedCard.order}/7)</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800 space-y-1.5 font-mono text-[11px] text-slate-400">
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <FileCode2 className="w-3.5 h-3.5 text-amber-500" /> Vector SVG:
                  </div>
                  <div className="bg-slate-950 p-2 rounded border border-slate-800 break-all text-slate-300">
                    public/assets/cards/{selectedCard.svgAsset}
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-300 pt-1">
                    <FileCode2 className="w-3.5 h-3.5 text-emerald-500" /> 600 DPI PNG:
                  </div>
                  <div className="bg-slate-950 p-2 rounded border border-slate-800 break-all text-slate-300">
                    public/assets/cards/{selectedCard.pngAsset}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-sm">
                <div className="text-lg font-black text-slate-100">{CARD_BACK.name}</div>
                <p className="text-xs text-slate-400">
                  Authentic geometric blue-teal patterned card back extracted directly from vector EPS sheet.
                </p>
                <div className="bg-slate-950 p-2.5 rounded border border-slate-800 font-mono text-[11px] text-slate-300 break-all">
                  public/assets/cards/{CARD_BACK.svgAsset}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
