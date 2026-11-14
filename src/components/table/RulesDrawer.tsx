import React from 'react';
import { X, BookOpen, Crown, Flame, Lock, Trophy, Award } from 'lucide-react';

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
      <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs text-slate-300">
        {/* Card Hierarchy & Points */}
        <section className="space-y-2 bg-slate-900/70 p-3.5 rounded-2xl border border-slate-800">
          <h3 className="font-bold text-amber-400 text-sm flex items-center gap-1.5">
            <Award className="w-4 h-4 text-amber-400" /> 1. Deck & Point Values (28 pts total)
          </h3>
          <p className="text-slate-400 leading-relaxed">
            Played with 32 cards (8 cards per suit). Hierarchy from highest to lowest:
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

        {/* Bidding Phase */}
        <section className="space-y-2 bg-slate-900/70 p-3.5 rounded-2xl border border-slate-800">
          <h3 className="font-bold text-amber-400 text-sm flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-amber-400" /> 2. Bidding (16 to 28)
          </h3>
          <p className="text-slate-400 leading-relaxed">
            4 cards are dealt in Round 1. Players bid clockwise starting to the dealer&apos;s right. Minimum bid is <strong>16</strong>.
            A player can raise the bid or <strong>PASS</strong>. Once a player passes, they cannot bid again in that deal.
            If all pass, the dealer is forced to bid 16.
          </p>
        </section>

        {/* Trump Concealment & Revelation */}
        <section className="space-y-2 bg-slate-900/70 p-3.5 rounded-2xl border border-slate-800">
          <h3 className="font-bold text-amber-400 text-sm flex items-center gap-1.5">
            <Lock className="w-4 h-4 text-amber-400" /> 3. Secret Trump & Trick Play
          </h3>
          <p className="text-slate-400 leading-relaxed">
            The highest bidder selects a secret Trump suit and keeps it concealed face-down.
            The remaining 4 cards are dealt (8 cards total per player).
          </p>
          <ul className="list-disc pl-4 space-y-1 text-slate-400">
            <li><strong>Follow Suit:</strong> You MUST play the lead suit if you hold any card of that suit.</li>
            <li><strong>Trump Reveal:</strong> If you cannot follow suit, you may request to reveal the secret Trump!</li>
            <li>Once revealed, anyone unable to follow suit may play trump cards to cut the trick.</li>
          </ul>
        </section>

        {/* Pair / Royals Bonus */}
        <section className="space-y-2 bg-slate-900/70 p-3.5 rounded-2xl border border-slate-800">
          <h3 className="font-bold text-amber-400 text-sm flex items-center gap-1.5">
            <Crown className="w-4 h-4 text-amber-400" /> 4. Pair / Royals (Royals Bonus)
          </h3>
          <p className="text-slate-400 leading-relaxed">
            If a player holds both the <strong>King (K)</strong> and <strong>Queen (Q)</strong> of the Trump suit, they may declare Pair after trump is revealed:
          </p>
          <ul className="list-disc pl-4 space-y-1 text-slate-400">
            <li>If declared by <strong>Bidding Team</strong>: Contract target decreases by 4 points (e.g. 17 target becomes 13).</li>
            <li>If declared by <strong>Opponents</strong>: Contract target increases by 4 points (e.g. 17 target becomes 21).</li>
          </ul>
        </section>

        {/* Match Scoring */}
        <section className="space-y-2 bg-slate-900/70 p-3.5 rounded-2xl border border-slate-800">
          <h3 className="font-bold text-amber-400 text-sm flex items-center gap-1.5">
            <Trophy className="w-4 h-4 text-amber-400" /> 5. Match Scoring (+6 / -6)
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
