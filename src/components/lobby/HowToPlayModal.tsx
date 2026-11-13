import React, { useState } from 'react';
import { BookOpen, Check, ChevronRight, Crown, Flame, Lock, Trophy, X } from 'lucide-react';
import { PlayingCard } from '../card/PlayingCard';

interface HowToPlayModalProps {
  onClose: () => void;
}

export const HowToPlayModal: React.FC<HowToPlayModalProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'cards' | 'bidding' | 'tricks' | 'royals' | 'scoring'>('cards');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-black text-slate-100">Official Rules of Indian 29 (Twenty-Nine)</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/30 overflow-x-auto text-xs font-bold">
          {[
            { id: 'cards', label: '1. Deck & Points' },
            { id: 'bidding', label: '2. Bidding & Trump' },
            { id: 'tricks', label: '3. Trick Play' },
            { id: 'royals', label: '4. Pair / Royals' },
            { id: 'scoring', label: '5. Scoring' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-3 whitespace-nowrap transition-colors border-b-2 ${
                activeTab === tab.id
                  ? 'border-amber-400 text-amber-400 bg-amber-500/10'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto space-y-4 text-sm text-slate-300 leading-relaxed">
          {activeTab === 'cards' && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-amber-400">The 32-Card Deck & Card Point Values</h3>
              <p>
                Twenty-Nine is played with exactly <strong>32 cards</strong> from a standard pack (8 cards in each of the 4 suits: Diamonds, Spades, Hearts, Clubs).
              </p>
              
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                  Rank Hierarchy & Point Values
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                    <span className="font-bold text-slate-100 block text-sm">Jack (J)</span>
                    <span className="text-amber-400 font-black">3 Points</span> (Highest)
                  </div>
                  <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                    <span className="font-bold text-slate-100 block text-sm">Nine (9)</span>
                    <span className="text-amber-400 font-black">2 Points</span>
                  </div>
                  <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                    <span className="font-bold text-slate-100 block text-sm">Ace (A)</span>
                    <span className="text-amber-400 font-black">1 Point</span>
                  </div>
                  <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                    <span className="font-bold text-slate-100 block text-sm">Ten (10)</span>
                    <span className="text-amber-400 font-black">1 Point</span>
                  </div>
                </div>
                <p className="text-xs text-slate-400">
                  Kings (K), Queens (Q), 8s, and 7s have <strong>0 card points</strong>, but are vital for leading and following suit.
                </p>
                <div className="p-2.5 bg-amber-500/10 border border-amber-400/30 rounded-xl text-xs text-amber-300 font-semibold">
                  Total card points = 28. Winning the 8th (last) trick awards 1 bonus point, bringing the grand total to <strong>29 points</strong>!
                </div>
              </div>
            </div>
          )}

          {activeTab === 'bidding' && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-amber-400">Two-Phase Dealing, Bidding & Concealed Trump</h3>
              <ol className="list-decimal pl-5 space-y-2">
                <li>
                  <strong>Phase 1 Deal:</strong> Every player receives 4 cards initially.
                </li>
                <li>
                  <strong>Bidding Cycle:</strong> Starting clockwise from the player left of dealer, players bid for the contract.
                  The minimum bid is <strong>16</strong> and maximum is <strong>28</strong> (or 29 with last-trick bonus).
                </li>
                <li>
                  <strong>Passing:</strong> A player who passes cannot re-enter bidding. If everyone passes, the dealer is forced to bid 16.
                </li>
                <li>
                  <strong>Concealed Trump:</strong> The highest bidder privately picks the Trump Suit from their 4 cards. 
                  The trump is kept strictly secret from all other players!
                </li>
                <li>
                  <strong>Phase 2 Deal:</strong> Remaining 4 cards are dealt to each player, bringing hands to 8 cards before trick play starts.
                </li>
              </ol>
            </div>
          )}

          {activeTab === 'tricks' && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-amber-400">Trick Play & Mandatory Follow-Suit</h3>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong>Leading:</strong> Player left of dealer leads the 1st trick. The winner of each trick leads the next trick.
                </li>
                <li>
                  <strong>Mandatory Follow-Suit:</strong> If you hold a card of the suit led, you <em>MUST</em> follow suit.
                </li>
                <li>
                  <strong>Asking for Trump:</strong> If you cannot follow suit and trump is still concealed, you can click <strong>Ask for Trump</strong>. 
                  The trump suit is revealed to all players, and you can cut/trump the trick!
                </li>
                <li>
                  <strong>Winning the Trick:</strong> If trump has been played, the highest trump card wins. Otherwise, the highest card of the suit led wins.
                </li>
              </ul>
            </div>
          )}

          {activeTab === 'royals' && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-amber-400">Pair / Royals Declaration (King + Queen of Trump)</h3>
              <p>
                A player holding both the <strong>King and Queen of the trump suit</strong> can declare a Pair once trump has been revealed and their team has won at least one trick.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-950 p-3 rounded-xl border border-emerald-500/40">
                  <span className="font-bold text-emerald-400 block mb-1">Declared by Bidding Team</span>
                  Contract target is <strong>reduced by 4 points</strong> (e.g., a bid of 16 becomes 12 points).
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-red-500/40">
                  <span className="font-bold text-red-400 block mb-1">Declared by Defending Team</span>
                  Contract target is <strong>increased by 4 points</strong> (e.g., a bid of 16 becomes 20 points).
                </div>
              </div>
            </div>
          )}

          {activeTab === 'scoring' && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-amber-400">End-of-Deal Scoring & Match Victory</h3>
              <p>
                At the end of all 8 tricks, card points won by each team are counted.
              </p>
              <ul className="list-disc pl-5 space-y-2 text-xs">
                <li>
                  <strong>Contract Fulfilled:</strong> If Bidding Team score ≥ Target, they gain <strong>+1 Game Point</strong> (+2 for bids ≥ 21).
                </li>
                <li>
                  <strong>Contract Failed:</strong> If Bidding Team score &lt; Target, they lose <strong>-1 Game Point</strong> (-2 for bids ≥ 21).
                </li>
                <li>
                  <strong>Winning the Match:</strong> The first team to reach <strong>+6 Game Points</strong> wins the match! A team reaching <strong>-6</strong> loses.
                </li>
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-md transition-all"
          >
            Got It, Let's Play!
          </button>
        </div>
      </div>
    </div>
  );
};
