import React from 'react';
import { SpecialTrumpAnnouncement } from '../../engine/types';
import { PlayingCard } from '../card/PlayingCard';

interface CentralTrumpAnnouncementProps {
  announcement: SpecialTrumpAnnouncement;
}

export const CentralTrumpAnnouncement: React.FC<CentralTrumpAnnouncementProps> = ({ announcement }) => {
  const isNoTrump = announcement.type === 'NO_TRUMP' || announcement.type === 'JOKER';

  return (
    <div className="relative flex flex-col items-center justify-center p-4 sm:p-5 rounded-3xl bg-slate-950/85 backdrop-blur-md border-2 border-amber-400/90 shadow-[0_0_35px_rgba(251,191,36,0.5)] text-center select-none animate-in fade-in zoom-in-95 duration-200 pointer-events-none max-w-xs sm:max-w-sm mx-auto">
      {isNoTrump ? (
        <div className="flex flex-col items-center gap-2">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg text-3xl sm:text-4xl animate-bounce">
            🃏
          </div>
          <span className="text-xs font-black uppercase tracking-wider text-amber-300">
            Special Trump Announcement
          </span>
          <h3 className="text-lg sm:text-xl font-black text-white tracking-wide">
            JOKER / NO TRUMP
          </h3>
          <p className="text-xs text-amber-100/90 max-w-[220px]">
            No suit has trump priority. The highest card of the led suit wins each trick.
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <div className="relative transform hover:scale-105 transition-transform duration-200">
            <PlayingCard cardId="CARD_BACK" faceDown={true} size="table" className="shadow-2xl ring-2 ring-amber-400/80" />
            <span className="absolute -top-2 -right-2 bg-amber-400 text-slate-950 font-black text-[11px] px-2 py-0.5 rounded-full shadow-md">
              7th
            </span>
          </div>
          <span className="text-xs font-black uppercase tracking-wider text-amber-300">
            Special Trump Announcement
          </span>
          <h3 className="text-lg sm:text-xl font-black text-white tracking-wide">
            7th CARD RESERVED
          </h3>
          <p className="text-xs text-amber-100/90 max-w-[220px]">
            The 7th dealt card is set aside as secret trump until legally requested.
          </p>
        </div>
      )}
    </div>
  );
};
