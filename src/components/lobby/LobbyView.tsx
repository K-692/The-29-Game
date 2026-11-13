import React, { useState } from 'react';
import { PlayerInfo, PlayerPosition, Team } from '../../engine/types';
import { 
  ArrowLeft, 
  Bot, 
  Check, 
  Copy, 
  Play, 
  RefreshCw, 
  Share2, 
  ShieldCheck, 
  User, 
  Users 
} from 'lucide-react';

interface LobbyViewProps {
  roomCode: string;
  players: PlayerInfo[];
  myPlayerId: string;
  isHost: boolean;
  onToggleCpu: (pos: PlayerPosition) => void;
  onSwapSeats: (posA: PlayerPosition, posB: PlayerPosition) => void;
  onStartGame: () => void;
  onLeave: () => void;
}

export const LobbyView: React.FC<LobbyViewProps> = ({
  roomCode,
  players,
  myPlayerId,
  isHost,
  onToggleCpu,
  onSwapSeats,
  onStartGame,
  onLeave,
}) => {
  const [copied, setCopied] = useState(false);
  const [swapSource, setSwapSource] = useState<PlayerPosition | null>(null);

  const inviteUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}?room=${roomCode}`
    : `?room=${roomCode}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Check if all 4 seats are occupied and ready
  const isReadyToStart = players.every((p) => p.isReady && (p.isCpu || Boolean(p.id)));

  // Group by team
  const teamAPlayers = players.filter((p) => p.team === 0);
  const teamBPlayers = players.filter((p) => p.team === 1);

  const handleSeatClick = (pos: PlayerPosition) => {
    if (!isHost) return;
    if (swapSource === null) {
      setSwapSource(pos);
    } else {
      if (swapSource !== pos) {
        onSwapSeats(swapSource, pos);
      }
      setSwapSource(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-8">
      {/* Top Bar */}
      <div className="max-w-4xl mx-auto w-full flex items-center justify-between pb-6 border-b border-slate-800">
        <button
          onClick={onLeave}
          className="flex items-center gap-2 text-slate-400 hover:text-slate-100 transition-colors text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" /> Leave Lobby
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Room Code:</span>
          <span className="font-mono text-base font-black text-amber-400 bg-slate-900 border border-slate-800 px-3 py-1 rounded-xl">
            {roomCode}
          </span>
        </div>
      </div>

      {/* Main Lobby Center Area */}
      <div className="max-w-4xl mx-auto w-full my-6 space-y-6">
        {/* Shareable Invite Card */}
        <div className="bg-gradient-to-r from-amber-500/10 via-slate-900 to-emerald-500/10 border border-amber-500/30 rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-center sm:text-left">
            <h3 className="text-base font-black text-slate-100 flex items-center justify-center sm:justify-start gap-2">
              <Share2 className="w-4 h-4 text-amber-400" /> Share Invitation Link with Friends
            </h3>
            <p className="text-xs text-slate-400">
              Send this link to your friend to join your team directly from any browser
            </p>
          </div>

          <button
            onClick={handleCopyLink}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Invite Link Copied!' : 'Copy Invite Link'}
          </button>
        </div>

        {/* 4 Player Positions: Team A vs Team B */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Team A: You (P0) & Partner (P2) */}
          <div className="bg-slate-900/80 border-2 border-emerald-500/40 rounded-3xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-400" />
                <h3 className="font-black text-emerald-400 text-base">Team A (Partners)</h3>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">Sit Opposite (P0 & P2)</span>
            </div>

            <div className="space-y-3">
              {teamAPlayers.map((p) => {
                const isMe = p.id === myPlayerId;
                const isSelectedForSwap = swapSource === p.position;

                return (
                  <div
                    key={p.position}
                    onClick={() => handleSeatClick(p.position)}
                    className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between ${
                      isSelectedForSwap
                        ? 'border-amber-400 bg-amber-500/10 ring-2 ring-amber-400'
                        : isMe
                          ? 'border-emerald-500 bg-emerald-950/20'
                          : 'border-slate-800 bg-slate-950'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center text-emerald-400 font-bold">
                        {p.isCpu ? <Bot className="w-5 h-5" /> : <User className="w-5 h-5" />}
                      </div>
                      <div>
                        <div className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
                          {p.name}
                          {isMe && <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-black">YOU</span>}
                          {p.isHost && <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-black">HOST</span>}
                        </div>
                        <div className="text-xs text-slate-400">
                          Seat {p.position === 0 ? 'South (P0)' : 'North (P2 - Partner)'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isHost && !p.isHost && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleCpu(p.position);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] font-bold text-slate-300 transition-colors"
                        >
                          {p.isCpu ? 'Make Human' : 'Make CPU'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Team B: Opponents (P1 & P3) */}
          <div className="bg-slate-900/80 border-2 border-amber-500/40 rounded-3xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-amber-400" />
                <h3 className="font-black text-amber-400 text-base">Team B (Opponents)</h3>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">Sit Opposite (P1 & P3)</span>
            </div>

            <div className="space-y-3">
              {teamBPlayers.map((p) => {
                const isMe = p.id === myPlayerId;
                const isSelectedForSwap = swapSource === p.position;

                return (
                  <div
                    key={p.position}
                    onClick={() => handleSeatClick(p.position)}
                    className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between ${
                      isSelectedForSwap
                        ? 'border-amber-400 bg-amber-500/10 ring-2 ring-amber-400'
                        : isMe
                          ? 'border-amber-500 bg-amber-950/20'
                          : 'border-slate-800 bg-slate-950'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center text-amber-400 font-bold">
                        {p.isCpu ? <Bot className="w-5 h-5" /> : <User className="w-5 h-5" />}
                      </div>
                      <div>
                        <div className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
                          {p.name}
                          {isMe && <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-black">YOU</span>}
                        </div>
                        <div className="text-xs text-slate-400">
                          Seat {p.position === 1 ? 'West (P1)' : 'East (P3)'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isHost && !p.isHost && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleCpu(p.position);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] font-bold text-slate-300 transition-colors"
                        >
                          {p.isCpu ? 'Make Human' : 'Make CPU'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {isHost && (
          <p className="text-xs text-slate-400 text-center italic">
            Tip: As host, click on two seats to swap players, or click Make CPU / Make Human to customize opponents.
          </p>
        )}
      </div>

      {/* Bottom Start Game Control */}
      <div className="max-w-4xl mx-auto w-full pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-xs text-slate-400">
          {isReadyToStart ? (
            <span className="text-emerald-400 font-bold flex items-center gap-1.5">
              <Check className="w-4 h-4" /> All 4 positions occupied and ready!
            </span>
          ) : (
            <span>Waiting for all 4 seats to be occupied before starting...</span>
          )}
        </div>

        {isHost ? (
          <button
            onClick={onStartGame}
            disabled={!isReadyToStart}
            className={`w-full sm:w-auto px-8 py-3.5 rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2 ${
              isReadyToStart
                ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 shadow-xl shadow-emerald-500/25 active:scale-95'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
            }`}
          >
            <Play className="w-4 h-4 fill-current" /> Start Game
          </button>
        ) : (
          <div className="text-xs text-slate-400 italic">
            Waiting for Host to start match...
          </div>
        )}
      </div>
    </div>
  );
};
