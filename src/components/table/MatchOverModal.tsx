import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { soundManager } from '../../common/SoundManager';
import { Team } from '../../engine/types';
import { Trophy, RotateCcw, Home } from 'lucide-react';

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
      });
    } catch {}
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border-2 border-amber-500 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-center space-y-6">
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center border-2 border-amber-400 shadow-2xl animate-bounce">
            <Trophy className="w-10 h-10" />
          </div>
        </div>

        <div className="space-y-1">
          <h2 className="text-3xl font-black text-slate-100">
            {isMyTeamWinner ? 'VICTORY!' : 'MATCH OVER'}
          </h2>
          <p className="text-sm font-bold text-amber-400">
            {winnerTeam === 0 ? 'Team A (P1 & P3)' : 'Team B (P2 & P4)'} Wins the Match!
          </p>
        </div>

        {/* Final Standings */}
        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
          <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">
            Final Match Score
          </span>
          <div className="flex items-center justify-center gap-6 text-xl font-mono font-black">
            <div className="text-center">
              <span className="text-xs text-slate-400 block font-sans">Team A</span>
              <span className={finalScore.team0 >= 6 ? 'text-emerald-400' : 'text-slate-300'}>
                {finalScore.team0}
              </span>
            </div>
            <span className="text-slate-700">vs</span>
            <div className="text-center">
              <span className="text-xs text-slate-400 block font-sans">Team B</span>
              <span className={finalScore.team1 >= 6 ? 'text-amber-400' : 'text-slate-300'}>
                {finalScore.team1}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            onClick={onExit}
            className="flex-1 py-3 rounded-xl font-bold text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4" /> Home
          </button>

          {isHost && (
            <button
              onClick={onRematch}
              className="flex-1 py-3 rounded-xl font-black text-sm bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-xl shadow-amber-500/25 transition-all flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" /> Rematch
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
