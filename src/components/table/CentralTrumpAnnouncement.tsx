import React from 'react';
import { SpecialTrumpAnnouncement } from '../../engine/types';
import { PlayingCard } from '../card/PlayingCard';

interface CentralTrumpAnnouncementProps {
  announcement: SpecialTrumpAnnouncement;
}

/** Brief centre-table note when the bidder picks Joker (no trump) or the 7th card. */
export const CentralTrumpAnnouncement: React.FC<CentralTrumpAnnouncementProps> = ({ announcement }) => {
  const isNoTrump = announcement.type === 'NO_TRUMP' || announcement.type === 'JOKER';

  return (
    <div className="panel mx-auto w-max max-w-[18rem] px-5 py-4 flex items-center gap-4 pointer-events-none animate-fade-in">
      {isNoTrump ? (
        <span className="w-12 h-16 rounded-lg bg-cream-100 text-felt-800 flex items-center justify-center text-2xl shadow-soft">🃏</span>
      ) : (
        <PlayingCard cardId="CARD_BACK" faceDown size="sm" className="shadow-soft" />
      )}
      <div>
        <div className="panel-title text-lg">{isNoTrump ? 'Joker — no trump' : '7th card trump'}</div>
        <p className="text-xs text-cream-300 mt-0.5">
          {isNoTrump ? 'Highest card of the led suit wins.' : 'Hidden until someone asks for trump.'}
        </p>
      </div>
    </div>
  );
};
