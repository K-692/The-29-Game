import React from 'react';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="space-y-1.5">
    <h3 className="font-display text-base text-cream-50">{title}</h3>
    <div className="text-[13px] leading-relaxed text-cream-200/90 space-y-1">{children}</div>
  </section>
);

/** Short, accurate rules shared by the home "How to play" dialog and the in-game drawer. */
export const RulesContent: React.FC = () => (
  <div className="space-y-5">
    <Section title="Teams & cards">
      <p>Four players, two partnerships — partners sit opposite. 32 cards (7 to Ace). Empty seats are played by the computer.</p>
      <p>Rank in every suit: <b className="text-cream-50">J &gt; 9 &gt; A &gt; 10 &gt; K &gt; Q &gt; 8 &gt; 7</b>. Points: J 3 · 9 2 · A 1 · 10 1 (28) + 1 for the last trick = 29.</p>
    </Section>
    <Section title="Bidding">
      <p>Four cards each, then bidding from 16 to 29 in pairs. The player left of the dealer (A) bids against the next player (B); they keep raising until one passes. The survivor then bids against C, and the survivor of that against D. A player who passes is out for the deal. The last one standing wins the bid. If A, B and C all pass without a bid, D must open at 16.</p>
      <p>Bubbles on each seat show every call, so you can always see who holds the high bid and whether they're your partner or an opponent.</p>
    </Section>
    <Section title="Trump">
      <p>The winning bidder secretly picks a suit, <b className="text-cream-50">Joker</b> (no trump) or the <b className="text-cream-50">7th card</b> (the 3rd card of their next four decides).</p>
      <p>If you can't follow suit you may ask for trump to be revealed. Playing a trump card when you can't follow also reveals it.</p>
    </Section>
    <Section title="Winning a trick">
      <p>You must follow the led suit if you can. The highest card of the led suit wins — <b className="text-cream-50">unless a trump is played: then the trump wins, and if several trumps are played the highest trump wins.</b></p>
    </Section>
    <Section title="Double & re-double">
      <p>After trump is chosen the defenders have 10 seconds to double (2×). If they do, the bidding side has 10 seconds to re-double (4×).</p>
    </Section>
    <Section title="King & Queen pair">
      <p>When trump is revealed, a player holding both the King and Queen of trump changes the target by 4 (bid 19+ only): −4 if on the bidding side (min 16), +4 if defending (max 29).</p>
    </Section>
    <Section title="Scoring">
      <p>The bidding side scores +1 (×2 / ×4 if doubled) for reaching the target, otherwise −1 (×2 / ×4).</p>
      <p><b className="text-cream-50">Sweep:</b> if the bidding side takes every point of the deal it scores +2; if the defenders take every point the bidding side scores −2 (also ×2 / ×4 when doubled).</p>
      <p>First side to +6 wins; a side at −6 loses.</p>
    </Section>
  </div>
);
