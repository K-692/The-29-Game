import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { soundManager } from '../../common/SoundManager';
import { Team } from '../../engine/types';
import { RotateCcw, Home } from 'lucide-react';

interface MatchOverModalProps {
  winnerTeam: Team;
  myTeam: Team;
  finalScore: { team0: number; team1: number };
  isHost: boolean;
  onRematch: () => void;
  onExit: () => void;
}

export const MatchOverModal: React.FC<MatchOverModalProps> = ({
  winnerTeam,
  myTeam,
  finalScore,
  isHost,
  onRematch,
  onExit,
}) => {
  const isMyTeamWinner = winnerTeam === myTeam;

  useEffect(() => {
    soundManager.playVictory();

    // Trigger celebratory confetti
    try {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#f5f0e1', '#c9432f', '#2c6a47', '#e8c766'],
      });
    } catch {}
  }, []);

  const us = myTeam === 0 ? finalScore.team0 : finalScore.team1;
  const them = myTeam === 0 ? finalScore.team1 : finalScore.team0;
  const fmt = (n: number) => (n > 0 ? `+${n}` : `${n}`);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-felt-950/60 backdrop-blur-sm animate-fade-in">
      <div className="panel w-full max-w-xs p-6 text-center space-y-4">
        <img src="/assets/game_logo.png" alt="29" className="w-14 h-14 mx-auto rounded-xl" />
        <div>
          <div className="eyebrow">Match over</div>
          <h2 className="panel-title text-3xl mt-1">{isMyTeamWinner ? 'You won' : 'You lost'}</h2>
        </div>
        <div className="flex items-center justify-center gap-6">
          <div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-felt-400">Us</div>
            <div className="font-display text-3xl tabular-nums">{fmt(us)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-[#e36a56]">Them</div>
            <div className="font-display text-3xl tabular-nums">{fmt(them)}</div>
          </div>
        </div>
        <div className="flex flex-col gap-2 pt-1">
          {isHost ? (
            <button onClick={onRematch} className="btn-primary w-full">
              <RotateCcw className="w-4 h-4" /> Play again
            </button>
          ) : (
            <p className="text-xs text-cream-300">Waiting for the host to start a new match…</p>
          )}
          <button onClick={onExit} className="btn-ghost w-full">
            <Home className="w-4 h-4" /> Leave
          </button>
        </div>
      </div>
    </div>
  );
};
