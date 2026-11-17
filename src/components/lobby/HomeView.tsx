import React, { useState } from 'react';
import { HelpCircle, LogIn, Plus, Volume2, VolumeX, Pencil } from 'lucide-react';
import { soundManager } from '../../common/SoundManager';

interface HomeViewProps {
  displayName: string;
  onUpdateName: (name: string) => void;
  onCreateRoom: () => void;
  onJoinRoom: () => void;
  onOpenGallery?: () => void;
  onOpenHowToPlay: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  displayName,
  onUpdateName,
  onCreateRoom,
  onJoinRoom,
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

  return (
    <div className="h-[100dvh] w-full bg-felt-800 bg-[radial-gradient(ellipse_at_center,_#225438_0%,_#153524_70%)] text-cream-100 flex flex-col p-4 sm:p-6 overflow-hidden select-none">
      {/* Top controls */}
      <div className="flex items-center justify-end gap-1.5">
        <button
          onClick={() => setIsMuted(soundManager.toggleMute())}
          className="p-2 rounded-xl text-cream-200/80 hover:text-cream-50 hover:bg-cream-100/10 transition-colors"
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
        <button
          onClick={onOpenHowToPlay}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-cream-200/80 hover:text-cream-50 hover:bg-cream-100/10 transition-colors"
        >
          <HelpCircle className="w-4 h-4" /> How to play
        </button>
      </div>

      <main className="flex-1 flex flex-col items-center justify-center gap-7 w-full max-w-xs mx-auto text-center">
        <img
          src="/assets/game_logo.png"
          alt="29 Card Game"
          className="w-36 h-36 sm:w-44 sm:h-44 object-contain drop-shadow-[0_18px_30px_rgba(0,0,0,0.35)]"
        />

        {/* Name */}
        {isEditingName ? (
          <form onSubmit={handleSaveName} className="w-full flex gap-2">
            <input
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              maxLength={20}
              autoFocus
              className="field text-center"
              aria-label="Your name"
            />
            <button type="submit" className="btn-primary px-3">Save</button>
          </form>
        ) : (
          <button
            onClick={() => {
              setTempName(displayName);
              setIsEditingName(true);
            }}
            className="group flex items-center gap-2 text-cream-200 hover:text-cream-50 transition-colors"
          >
            <span className="eyebrow">Playing as</span>
            <span className="font-display text-lg text-cream-50">{displayName}</span>
            <Pencil className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100" />
          </button>
        )}

        <div className="w-full flex flex-col gap-2.5">
          <button onClick={onCreateRoom} className="btn-primary w-full py-3">
            <Plus className="w-4 h-4" /> Host a room
          </button>
          <button onClick={onJoinRoom} className="btn-ghost w-full py-3">
            <LogIn className="w-4 h-4" /> Join a room
          </button>
        </div>

        <p className="text-xs text-cream-300/70 leading-relaxed">
          Play with friends on the same Wi-Fi. Empty seats are played by the computer.
        </p>
      </main>
    </div>
  );
};
