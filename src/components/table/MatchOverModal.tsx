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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-center space-y-6">
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center border border-amber-300 shadow-lg animate-bounce">
            <Trophy className="w-10 h-10" />
          </div>
        </div>

        <div className="space-y-1">
          <h2 className="text-3xl font-black text-slate-800">
            {isMyTeamWinner ? 'VICTORY!' : 'MATCH OVER'}
          </h2>
          <p className="text-sm font-bold text-amber-600">
            {winnerTeam === myTeam ? 'Your Partnership Wins the Match!' : 'Opponents Win the Match!'}
          </p>
        </div>

        {/* Final Standings */}
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2">
          <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block">
            Final Match Score (+6 to Win)
          </span>
          <div className="flex items-center justify-center gap-6 text-xl font-mono font-bold">
            <div className="text-center">
              <span className="text-xs text-sky-700 block font-sans font-bold flex items-center justify-center gap-1">
                <span className="w-2 h-2 rounded-full bg-sky-500" />
                {myTeam === 0 ? 'Your Side' : 'Opponents'}
              </span>
              <span className={finalScore.team0 >= 6 ? 'text-sky-700 font-black' : 'text-slate-800'}>
                {finalScore.team0 > 0 ? `+${finalScore.team0}` : finalScore.team0}
              </span>
            </div>
            <span className="text-slate-300">vs</span>
            <div className="text-center">
              <span className="text-xs text-rose-700 block font-sans font-bold flex items-center justify-center gap-1">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                {myTeam === 1 ? 'Your Side' : 'Opponents'}
              </span>
              <span className={finalScore.team1 >= 6 ? 'text-rose-700 font-black' : 'text-slate-800'}>
                {finalScore.team1 > 0 ? `+${finalScore.team1}` : finalScore.team1}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            onClick={onExit}
            className="flex-1 py-3 rounded-xl font-bold text-sm bg-slate-100 hover:bg-slate-200 active:scale-98 text-slate-700 border border-slate-200 transition-all flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4" /> Home
          </button>

          {isHost && (
            <button
              onClick={onRematch}
              className="flex-1 py-3 rounded-xl font-bold text-sm bg-amber-400 hover:bg-amber-300 active:scale-98 text-slate-950 shadow-md transition-all flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" /> Rematch
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
