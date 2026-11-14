import React, { useState } from 'react';
import { 
  Bot, 
  HelpCircle, 
  LogIn, 
  PlusCircle, 
  Sparkles, 
  Volume2, 
  VolumeX,
  Radio
} from 'lucide-react';
import { PlayingCard } from '../card/PlayingCard';
import { soundManager } from '../../common/SoundManager';

interface HomeViewProps {
  displayName: string;
  onUpdateName: (name: string) => void;
  onCreateRoom: () => void;
  onJoinRoom: () => void;
  onPlayWithComputer: () => void;
  onOpenGallery?: () => void;
  onOpenHowToPlay: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  displayName,
  onUpdateName,
  onCreateRoom,
  onJoinRoom,
  onPlayWithComputer,
  onOpenHowToPlay,
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(displayName);
  const [isMuted, setIsMuted] = useState(soundManager.getMuted());

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    if (tempName.trim()) {
      onUpdateName(tempName.trim());
      setIsEditingName(false);
    }
  };

  const handleToggleSound = () => {
    const muted = soundManager.toggleMute();
    setIsMuted(muted);
  };

  return (
    <div className="h-[100dvh] max-h-[100dvh] w-full bg-slate-950 text-slate-100 flex flex-col justify-between p-3 sm:p-5 relative overflow-hidden box-border select-none selection:bg-amber-500 selection:text-black">
      {/* Background Decorative Cards Fan */}
      <div className="absolute -top-12 -right-12 opacity-15 pointer-events-none transform rotate-12 scale-125 hidden md:block">
        <div className="flex -space-x-12">
          <PlayingCard cardId="J_HEARTS" size="xl" />
          <PlayingCard cardId="9_SPADES" size="xl" />
          <PlayingCard cardId="A_DIAMONDS" size="xl" />
          <PlayingCard cardId="10_CLUBS" size="xl" />
        </div>
      </div>

      {/* Floating Top Controls (No background navbar strip, no reserved height) */}
      <div className="max-w-5xl mx-auto w-full flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-2">
          <img src="/assets/game_logo.png" alt="The 29 Game" className="w-8 h-8 object-contain drop-shadow" />
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-xs sm:text-sm tracking-wide text-slate-200">Indian Twenty-Nine</span>
            <span className="text-[10px] font-mono bg-emerald-950/80 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
              <Radio className="w-2.5 h-2.5 animate-pulse" /> LAN HOST
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Mute button */}
          <button
            onClick={handleToggleSound}
            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-900 rounded-xl transition-colors cursor-pointer"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>

          {/* How to Play */}
          <button
            onClick={onOpenHowToPlay}
            className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-bold text-slate-300 transition-colors cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5 text-amber-400" /> How to Play
          </button>
        </div>
      </div>

      {/* Hero Center Section (Adaptable, fits all viewports with zero scrolling) */}
      <main className="max-w-md mx-auto w-full flex-1 flex flex-col justify-center items-center py-2 text-center space-y-3 sm:space-y-4 z-10 min-h-0">
        {/* Title & Badge */}
        <div className="space-y-1.5 sm:space-y-2 flex flex-col items-center">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-400/30 text-amber-400 text-[11px] font-black tracking-wider uppercase">
            <Sparkles className="w-3 h-3" /> Traditional Indian Card Game
          </div>
          <div className="flex justify-center py-0.5">
            <img 
              src="/assets/game_logo.png" 
              alt="The 29 Game Logo" 
              className="w-20 h-20 sm:w-28 sm:h-28 object-contain drop-shadow-[0_8px_20px_rgba(245,158,11,0.25)] hover:scale-105 transition-transform duration-300"
            />
          </div>
          <p className="text-xs sm:text-sm font-black text-amber-400 tracking-wider uppercase">
            Twenty-Nine Card Game
          </p>
          <p className="text-[11px] sm:text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
            Play locally over LAN / Wi-Fi with friends as partners against intelligent computer bots or human opponents
          </p>
        </div>

        {/* Player Name Tag */}
        <div className="w-full bg-slate-900/80 border border-slate-800 rounded-2xl p-2 sm:p-2.5 flex items-center justify-between shadow-lg">
          {isEditingName ? (
            <form onSubmit={handleSaveName} className="flex-1 flex items-center gap-2">
              <input
                type="text"
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                maxLength={20}
                autoFocus
                className="flex-1 bg-slate-950 border border-amber-500 rounded-lg px-2.5 py-1 text-xs text-slate-100 outline-none font-bold"
              />
              <button
                type="submit"
                className="px-3 py-1 bg-amber-500 text-slate-950 text-xs font-black rounded-lg cursor-pointer"
              >
                Save
              </button>
            </form>
          ) : (
            <>
              <div className="flex items-center gap-2 text-left">
                <div className="w-7 h-7 rounded-xl bg-amber-500/10 border border-amber-400/30 flex items-center justify-center text-amber-400 font-bold text-xs">
                  {displayName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <span className="text-[9px] text-slate-500 uppercase font-bold block leading-none">Playing as</span>
                  <span className="text-xs sm:text-sm font-bold text-slate-100">{displayName}</span>
                </div>
              </div>
              <button
                onClick={() => setIsEditingName(true)}
                className="text-xs text-amber-400 hover:text-amber-300 font-semibold px-2 py-0.5 rounded hover:bg-slate-800 cursor-pointer"
              >
                Change
              </button>
            </>
          )}
        </div>

        {/* Primary Action Buttons */}
        <div className="w-full space-y-2 sm:space-y-2.5">
          {/* Create LAN Room */}
          <button
            onClick={onCreateRoom}
            className="w-full py-3 sm:py-3.5 rounded-2xl font-black text-xs sm:text-sm bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-lg shadow-amber-500/20 transition-all transform active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4 sm:w-5 sm:h-5" /> Host New LAN Room
          </button>

          {/* Join LAN Room */}
          <button
            onClick={onJoinRoom}
            className="w-full py-2.5 sm:py-3 rounded-2xl font-bold text-xs sm:text-sm bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-100 shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogIn className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" /> Join LAN Game (Code / IP)
          </button>

          {/* Play with Computer */}
          <button
            onClick={onPlayWithComputer}
            className="w-full py-2.5 sm:py-3 rounded-2xl font-bold text-xs sm:text-sm bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-500/50 text-emerald-300 shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" /> Play with Computer (1P + 3 Bots)
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-5xl mx-auto w-full text-center text-[10px] sm:text-xs text-slate-500 py-1.5 border-t border-slate-900/80 z-10 shrink-0">
        <p>Traditional Indian 29 Rules • Original EPS Playing Cards • LAN Local Multiplayer</p>
      </footer>
    </div>
  );
};
