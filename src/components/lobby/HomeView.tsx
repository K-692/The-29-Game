import React, { useState } from 'react';
import { 
  Bot, 
  HelpCircle, 
  Layers, 
  LogIn, 
  PlusCircle, 
  Settings, 
  Sparkles, 
  Users, 
  Volume2, 
  VolumeX 
} from 'lucide-react';
import { PlayingCard } from '../card/PlayingCard';
import { soundManager } from '../../common/SoundManager';

interface HomeViewProps {
  displayName: string;
  onUpdateName: (name: string) => void;
  onCreateRoom: () => void;
  onJoinRoom: () => void;
  onPlayWithComputer: () => void;
  onOpenGallery: () => void;
  onOpenHowToPlay: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  displayName,
  onUpdateName,
  onCreateRoom,
  onJoinRoom,
  onPlayWithComputer,
  onOpenGallery,
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-8 relative overflow-hidden selection:bg-amber-500 selection:text-black">
      {/* Background Decorative Cards Fan */}
      <div className="absolute -top-12 -right-12 opacity-15 pointer-events-none transform rotate-12 scale-125 hidden md:block">
        <div className="flex -space-x-12">
          <PlayingCard cardId="J_HEARTS" size="xl" />
          <PlayingCard cardId="9_SPADES" size="xl" />
          <PlayingCard cardId="A_DIAMONDS" size="xl" />
          <PlayingCard cardId="10_CLUBS" size="xl" />
        </div>
      </div>

      {/* Top Navbar */}
      <header className="max-w-5xl mx-auto w-full flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center font-black text-slate-950 font-serif text-lg shadow-md">
            29
          </div>
          <span className="font-bold text-sm tracking-wide text-slate-300">Indian Twenty-Nine</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Mute button */}
          <button
            onClick={handleToggleSound}
            className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-900 rounded-xl transition-colors"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX className="w-5 h-5 text-red-400" /> : <Volume2 className="w-5 h-5 text-emerald-400" />}
          </button>

          {/* How to Play */}
          <button
            onClick={onOpenHowToPlay}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-bold text-slate-300 transition-colors"
          >
            <HelpCircle className="w-4 h-4 text-amber-400" /> How to Play
          </button>
        </div>
      </header>

      {/* Hero Center Section */}
      <main className="max-w-md mx-auto w-full my-auto py-8 text-center space-y-7 z-10">
        {/* Title & Badge */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-400/30 text-amber-400 text-xs font-black tracking-wider uppercase">
            <Sparkles className="w-3.5 h-3.5" /> Traditional Indian Card Game
          </div>
          <h1 className="text-5xl sm:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-amber-500 tracking-tight font-serif drop-shadow-md">
            29
          </h1>
          <p className="text-base font-bold text-slate-300 tracking-wide uppercase">
            Twenty-Nine Card Game
          </p>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            Play online with your friend as partners against real players or intelligent computer bots
          </p>
        </div>

        {/* Player Name Tag */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3 flex items-center justify-between shadow-lg">
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
                className="px-3 py-1 bg-amber-500 text-slate-950 text-xs font-black rounded-lg"
              >
                Save
              </button>
            </form>
          ) : (
            <>
              <div className="flex items-center gap-2.5 text-left">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-400/30 flex items-center justify-center text-amber-400 font-bold text-xs">
                  {displayName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Playing as</span>
                  <span className="text-sm font-bold text-slate-100">{displayName}</span>
                </div>
              </div>
              <button
                onClick={() => setIsEditingName(true)}
                className="text-xs text-amber-400 hover:text-amber-300 font-semibold px-2 py-1 rounded hover:bg-slate-800"
              >
                Change
              </button>
            </>
          )}
        </div>

        {/* Primary Action Buttons */}
        <div className="space-y-3">
          {/* Create Private Room */}
          <button
            onClick={onCreateRoom}
            className="w-full py-4 rounded-2xl font-black text-sm bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-xl shadow-amber-500/25 transition-all transform active:scale-95 flex items-center justify-center gap-2.5"
          >
            <PlusCircle className="w-5 h-5" /> Create Private Online Room
          </button>

          {/* Join Room */}
          <button
            onClick={onJoinRoom}
            className="w-full py-3.5 rounded-2xl font-bold text-sm bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-100 shadow-lg transition-all flex items-center justify-center gap-2.5"
          >
            <LogIn className="w-5 h-5 text-amber-400" /> Join Room by Code / Link
          </button>

          {/* Play with Computer */}
          <button
            onClick={onPlayWithComputer}
            className="w-full py-3.5 rounded-2xl font-bold text-sm bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-500/50 text-emerald-300 shadow-lg transition-all flex items-center justify-center gap-2.5"
          >
            <Bot className="w-5 h-5 text-emerald-400" /> Play with Computer (Instant Match)
          </button>
        </div>

        {/* Secondary: Card Gallery Verification */}
        <div className="pt-2">
          <button
            onClick={onOpenGallery}
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-amber-400 transition-colors py-1 px-3 rounded-lg hover:bg-slate-900"
          >
            <Layers className="w-4 h-4 text-amber-500" /> View 32 Card Assets Gallery (EPS Vector)
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-5xl mx-auto w-full text-center text-xs text-slate-400 py-4 border-t border-slate-900 z-10">
        <p>Traditional Indian 29 Rules • Authentic Vector Card Artwork • Deployable on GitHub Pages</p>
      </footer>
    </div>
  );
};
