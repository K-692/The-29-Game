import React from 'react';
import { X, BookOpen, Crown, Flame, Lock, Trophy, Award, Layers } from 'lucide-react';

interface RulesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RulesDrawer: React.FC<RulesDrawerProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-slate-950/95 backdrop-blur-xl border-l border-slate-800 shadow-2xl flex flex-col transition-all animate-slide-left text-slate-100">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-amber-400" />
          <h2 className="text-base font-black text-slate-100">Twenty-Nine (29) Rules</h2>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors"
          title="Close Rules"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Rules Content (Scrollable, Non-blocking) */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs text-slate-300">
        {/* 1. Deck & Point Values */}
        <section className="space-y-2 bg-slate-900/70 p-3.5 rounded-2xl border border-slate-800">
          <h3 className="font-bold text-amber-400 text-sm flex items-center gap-1.5">
            <Award className="w-4 h-4 text-amber-400" /> 1. Deck & Point Values (28 pts total)
          </h3>
          <p className="text-slate-400 leading-relaxed">
            Played with 32 cards (8 cards per suit). Hierarchy and point values:
          </p>
          <div className="grid grid-cols-4 gap-1.5 text-center font-mono pt-1">
            <div className="p-1.5 bg-slate-950 rounded-lg border border-amber-500/30">
              <span className="font-black text-amber-300 block text-sm">J</span>
              <span className="text-[10px] text-slate-400">3 pts</span>
            </div>
            <div className="p-1.5 bg-slate-950 rounded-lg border border-amber-500/30">
              <span className="font-black text-amber-300 block text-sm">9</span>
              <span className="text-[10px] text-slate-400">2 pts</span>
            </div>
            <div className="p-1.5 bg-slate-950 rounded-lg border border-slate-800">
              <span className="font-black text-slate-200 block text-sm">A</span>
              <span className="text-[10px] text-slate-400">1 pt</span>
            </div>
            <div className="p-1.5 bg-slate-950 rounded-lg border border-slate-800">
              <span className="font-black text-slate-200 block text-sm">10</span>
              <span className="text-[10px] text-slate-400">1 pt</span>
            </div>
            <div className="p-1.5 bg-slate-950 rounded-lg border border-slate-800 text-slate-500">
              <span className="font-bold block text-sm">K</span>
              <span className="text-[10px]">0 pts</span>
            </div>
            <div className="p-1.5 bg-slate-950 rounded-lg border border-slate-800 text-slate-500">
              <span className="font-bold block text-sm">Q</span>
              <span className="text-[10px]">0 pts</span>
            </div>
            <div className="p-1.5 bg-slate-950 rounded-lg border border-slate-800 text-slate-500">
              <span className="font-bold block text-sm">8</span>
              <span className="text-[10px]">0 pts</span>
            </div>
            <div className="p-1.5 bg-slate-950 rounded-lg border border-slate-800 text-slate-500">
              <span className="font-bold block text-sm">7</span>
              <span className="text-[10px]">0 pts</span>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 italic pt-1">
            Winning the final (8th) trick awards +1 bonus point, bringing total potential points to 29.
          </p>
        </section>

        {/* 2. Dealing Sequence & First Bidder Eligibility */}
        <section className="space-y-2 bg-slate-900/70 p-3.5 rounded-2xl border border-slate-800">
          <h3 className="font-bold text-amber-400 text-sm flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-amber-400" /> 2. Dealer & 4-Card Initial Deal
          </h3>
          <ul className="list-disc pl-4 space-y-1 text-slate-400 leading-relaxed">
            <li><strong>Random Initial Dealer:</strong> The dealer for the first round is selected at random (Seats 1–4). The dealer rotates clockwise each subsequent deal.</li>
            <li><strong>Initial Deal:</strong> Exactly 4 cards are dealt to each player before bidding starts.</li>
            <li><strong>First Bidder:</strong> The player sitting immediately to the left of the dealer opens bidding.</li>
            <li><strong>Point-Card Eligibility:</strong> The first bidder must hold at least one point-valued card (J, 9, A, or 10). If they hold 0 point cards, all cards are returned, reshuffled, and redealt until eligible.</li>
          </ul>
        </section>

        {/* 3. Single-Round Bidding */}
        <section className="space-y-2 bg-slate-900/70 p-3.5 rounded-2xl border border-slate-800">
          <h3 className="font-bold text-amber-400 text-sm flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-amber-400" /> 3. One-Round Bidding (16 to 28)
          </h3>
          <ul className="list-disc pl-4 space-y-1 text-slate-400 leading-relaxed">
            <li><strong>Strictly One Round:</strong> Exactly 4 turns in clockwise order around the table. Each player gets exactly one turn to bid or pass.</li>
            <li><strong>Opening Bid:</strong> Minimum bid is 16. Any subsequent bid must exceed the current highest bid.</li>
            <li><strong>Forced Dealer Bid:</strong> If the first 3 players pass, the dealer is forced to place the opening bid of 16.</li>
            <li><strong>15s Timer:</strong> Each bidder has 15 seconds. If the timer expires, an automatic PASS is submitted (or forced 16 for dealer).</li>
          </ul>
        </section>

        {/* 4. Six Trump Options & 7th Card Mechanics */}
        <section className="space-y-2 bg-slate-900/70 p-3.5 rounded-2xl border border-slate-800">
          <h3 className="font-bold text-amber-400 text-sm flex items-center gap-1.5">
            <Lock className="w-4 h-4 text-amber-400" /> 4. Six Trump Options & 2nd Deal
          </h3>
          <p className="text-slate-400 leading-relaxed">
            The winning bidder chooses from 6 trump options:
          </p>
          <ul className="list-disc pl-4 space-y-1 text-slate-400">
            <li><strong>Suits (Hearts, Spades, Clubs, Diamonds):</strong> Traditional secret trump suit concealed face-down.</li>
            <li><strong>Joker / No Trump:</strong> No trump suit exists. The highest card of the lead suit always wins the trick; off-suit cards cannot cut; Royal Pairs cannot be declared.</li>
            <li><strong>7th Card Trump:</strong> During the second deal, the bidder&apos;s 7th card is placed face-down on the table as a reserved trump card. When trump is revealed during trick play, the card flips over, its suit becomes trump, and it returns to the bidder&apos;s hand.</li>
          </ul>
          <p className="text-[11px] text-slate-400 pt-1">
            After trump selection, the remaining 4 cards are dealt to all players (8 cards total per player) before trick play begins.
          </p>
        </section>

        {/* 5. Trick Play & Following Suit */}
        <section className="space-y-2 bg-slate-900/70 p-3.5 rounded-2xl border border-slate-800">
          <h3 className="font-bold text-amber-400 text-sm flex items-center gap-1.5">
            <Crown className="w-4 h-4 text-amber-400" /> 5. Trick Play & Trump Revelation
          </h3>
          <ul className="list-disc pl-4 space-y-1 text-slate-400">
            <li><strong>Must Follow Suit:</strong> You MUST play a card of the led suit if you hold one.</li>
            <li><strong>Trump Revelation:</strong> If unable to follow suit, you may request to reveal the secret Trump!</li>
            <li>Once revealed, players unable to follow suit may play trump cards to cut the trick.</li>
          </ul>
        </section>

        {/* 6. Pair / Royals */}
        <section className="space-y-2 bg-slate-900/70 p-3.5 rounded-2xl border border-slate-800">
          <h3 className="font-bold text-amber-400 text-sm flex items-center gap-1.5">
            <Crown className="w-4 h-4 text-amber-400" /> 6. Pair / Royals (Royals Bonus)
          </h3>
          <p className="text-slate-400 leading-relaxed">
            Holding both King (K) and Queen (Q) of the Trump suit allows declaring Pair after trump is revealed:
          </p>
          <ul className="list-disc pl-4 space-y-1 text-slate-400">
            <li><strong>Bidding Team:</strong> Contract target decreases by 4 points (e.g. 17 target becomes 13).</li>
            <li><strong>Defending Team:</strong> Contract target increases by 4 points (e.g. 17 target becomes 21).</li>
          </ul>
        </section>

        {/* 7. Match Scoring */}
        <section className="space-y-2 bg-slate-900/70 p-3.5 rounded-2xl border border-slate-800">
          <h3 className="font-bold text-amber-400 text-sm flex items-center gap-1.5">
            <Trophy className="w-4 h-4 text-amber-400" /> 7. Match Scoring (+6 / -6)
          </h3>
          <p className="text-slate-400 leading-relaxed">
            Fulfilling the contract awards <strong>+1 Game Point</strong> (+2 if bid was 21+).
            Failing contract deducts <strong>-1 Game Point</strong> (-2 if bid was 21+).
            First team to reach <strong>+6 points</strong> wins the match; reaching <strong>-6 points</strong> loses.
          </p>
        </section>
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-slate-800 text-center text-[11px] text-slate-500 bg-slate-900/40">
        Live LAN 29 Multiplayer • Non-blocking reference
      </div>
    </div>
  );
};
