import React from 'react';
import { X, BookOpen, Crown, Flame, Lock, Trophy, Award, Layers, Zap } from 'lucide-react';

interface RulesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RulesDrawer: React.FC<RulesDrawerProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white/95 backdrop-blur-xl border-l border-slate-200 shadow-2xl flex flex-col transition-all animate-slide-left text-slate-800">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-amber-500" />
          <h2 className="text-base font-black text-slate-900">Twenty-Nine (29) Rules</h2>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
          title="Close Rules"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Rules Content (Scrollable, Non-blocking) */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs text-slate-600">
        {/* 1. Deck & Point Values */}
        <section className="space-y-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
          <h3 className="font-bold text-amber-600 text-sm flex items-center gap-1.5">
            <Award className="w-4 h-4 text-amber-500" /> 1. Deck & Point Values (28 pts total)
          </h3>
          <p className="text-slate-600 leading-relaxed">
            Played with 32 cards (8 cards per suit). Hierarchy and point values:
          </p>
          <div className="grid grid-cols-4 gap-1.5 text-center font-mono pt-1">
            <div className="p-1.5 bg-white rounded-lg border border-amber-300 shadow-xs">
              <span className="font-black text-amber-600 block text-sm">J</span>
              <span className="text-[10px] text-slate-500">3 pts</span>
            </div>
            <div className="p-1.5 bg-white rounded-lg border border-amber-300 shadow-xs">
              <span className="font-black text-amber-600 block text-sm">9</span>
              <span className="text-[10px] text-slate-500">2 pts</span>
            </div>
            <div className="p-1.5 bg-white rounded-lg border border-slate-200 shadow-xs">
              <span className="font-black text-slate-800 block text-sm">A</span>
              <span className="text-[10px] text-slate-500">1 pt</span>
            </div>
            <div className="p-1.5 bg-white rounded-lg border border-slate-200 shadow-xs">
              <span className="font-black text-slate-800 block text-sm">10</span>
              <span className="text-[10px] text-slate-500">1 pt</span>
            </div>
            <div className="p-1.5 bg-white rounded-lg border border-slate-200 shadow-xs text-slate-400">
              <span className="font-bold block text-sm">K</span>
              <span className="text-[10px]">0 pts</span>
            </div>
            <div className="p-1.5 bg-white rounded-lg border border-slate-200 shadow-xs text-slate-400">
              <span className="font-bold block text-sm">Q</span>
              <span className="text-[10px]">0 pts</span>
            </div>
            <div className="p-1.5 bg-white rounded-lg border border-slate-200 shadow-xs text-slate-400">
              <span className="font-bold block text-sm">8</span>
              <span className="text-[10px]">0 pts</span>
            </div>
            <div className="p-1.5 bg-white rounded-lg border border-slate-200 shadow-xs text-slate-400">
              <span className="font-bold block text-sm">7</span>
              <span className="text-[10px]">0 pts</span>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 italic pt-1">
            Winning the final (8th) trick awards +1 bonus point, bringing total potential deal points to 29.
          </p>
        </section>

        {/* 2. Dealer & 4-Card Initial Deal */}
        <section className="space-y-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
          <h3 className="font-bold text-amber-600 text-sm flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-amber-500" /> 2. Dealer & 4-Card Initial Deal
          </h3>
          <ul className="list-disc pl-4 space-y-1 text-slate-600 leading-relaxed">
            <li><strong>Dealer Rotation:</strong> Initial dealer is randomly chosen; dealer advances clockwise each subsequent deal.</li>
            <li><strong>Initial Deal:</strong> Exactly 4 cards are dealt to each player before bidding starts.</li>
            <li><strong>First Bidder:</strong> The player sitting to the left of the dealer opens the bidding.</li>
            <li><strong>Point-Card Eligibility:</strong> First bidder must hold at least one point card (J, 9, A, 10). Reshuffled and redealt if void of points.</li>
          </ul>
        </section>

        {/* 3. Bidding */}
        <section className="space-y-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
          <h3 className="font-bold text-amber-600 text-sm flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-amber-500" /> 3. Single-Round Bidding (16 to 28)
          </h3>
          <ul className="list-disc pl-4 space-y-1 text-slate-600 leading-relaxed">
            <li><strong>Strictly One Round:</strong> Exactly 4 turns in clockwise order around the table. Each player bids or passes once.</li>
            <li><strong>Opening Bid:</strong> Minimum bid is 16. Each bid must exceed the prior highest bid.</li>
            <li><strong>Forced Dealer Bid:</strong> If first 3 players pass, the dealer is forced to open at 16.</li>
          </ul>
        </section>

        {/* 4. Trump Selection & Announcements */}
        <section className="space-y-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
          <h3 className="font-bold text-amber-600 text-sm flex items-center gap-1.5">
            <Lock className="w-4 h-4 text-amber-500" /> 4. Six Trump Options & Announcements
          </h3>
          <ul className="list-disc pl-4 space-y-1 text-slate-600">
            <li><strong>Suits (Hearts, Spades, Clubs, Diamonds):</strong> Traditional secret trump suit concealed face-down.</li>
            <li><strong>Joker / No Trump:</strong> No trump suit exists. Highest card of lead suit always wins trick. Announced on table for 1 second.</li>
            <li><strong>7th Card Trump:</strong> Bidder&apos;s 7th card is set aside face-down as secret trump (announced with card-back visual for 1s). Returns to bidder&apos;s hand when revealed.</li>
          </ul>
        </section>

        {/* 5. Double & Re-Double */}
        <section className="space-y-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
          <h3 className="font-bold text-amber-600 text-sm flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-amber-500" /> 5. Double &amp; Re-Double (10s Deadlines)
          </h3>
          <p className="text-slate-600 leading-relaxed">
            Before trick play begins, partnerships can challenge the contract stakes:
          </p>
          <ul className="list-disc pl-4 space-y-1 text-slate-600">
            <li><strong>Stage 1 (Defending Team):</strong> 10 seconds to select DOUBLE or PASS. If passed or timer expires, normal match (1x).</li>
            <li><strong>Stage 2 (Bidding Team):</strong> If doubled, bidding team has 10 seconds to select RE-DOUBLE or PASS. If passed, match remains Doubled (2x). If re-doubled, match becomes Re-Doubled (4x).</li>
            <li><strong>Match Point Multipliers:</strong>
              <ul className="list-disc pl-4 pt-1 space-y-0.5">
                <li>Normal: Fulfilled = +1 pt, Failed = -1 pt</li>
                <li>Doubled: Fulfilled = +2 pts, Failed = -2 pts</li>
                <li>Re-Doubled: Fulfilled = +4 pts, Failed = -4 pts</li>
              </ul>
            </li>
          </ul>
        </section>

        {/* 6. King-Queen Pair / Royals */}
        <section className="space-y-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
          <h3 className="font-bold text-amber-600 text-sm flex items-center gap-1.5">
            <Crown className="w-4 h-4 text-amber-500" /> 6. King-Queen Pair / Royals
          </h3>
          <p className="text-slate-600 leading-relaxed">
            Evaluated automatically upon legal trump reveal:
          </p>
          <ul className="list-disc pl-4 space-y-1 text-slate-600">
            <li><strong>Eligibility:</strong> Requires original bid ≥ 19. Both King and Queen of the revealed trump suit must be held in the same player&apos;s hand.</li>
            <li><strong>Bidding Team Pair:</strong> Target reduced by 4 points (minimum target: 16).</li>
            <li><strong>Defending Team Pair:</strong> Target increased by 4 points (maximum target: 29).</li>
            <li><strong>Announcement:</strong> Displays side-by-side King and Queen cards for 2 seconds and updates target on the scoreboard.</li>
          </ul>
        </section>

        {/* 7. Match Winning Condition */}
        <section className="space-y-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
          <h3 className="font-bold text-amber-600 text-sm flex items-center gap-1.5">
            <Trophy className="w-4 h-4 text-amber-500" /> 7. Match Winning Condition (+6 to Win)
          </h3>
          <p className="text-slate-600 leading-relaxed">
            The first team to reach <strong>+6 match points</strong> wins the match! Negative match points are fully supported.
          </p>
        </section>
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-slate-200 text-center text-[11px] text-slate-400 bg-slate-50/80">
        Live LAN 29 Multiplayer • Pure Host-Authoritative Architecture
      </div>
    </div>
  );
};
