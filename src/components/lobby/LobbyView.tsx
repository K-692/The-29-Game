import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { PlayerPosition } from '../../engine/types';
import { LanSeat, lanClient } from '../../services/lanClient';
import { 
  ArrowLeft, 
  Loader2,
  Check, 
  Copy, 
  Play, 
  QrCode, 
  User, 
  Users, 
  Wifi, 
  Sparkles,
  ShieldCheck
} from 'lucide-react';

interface LobbyViewProps {
  roomCode: string;
  seats: LanSeat[];
  myPosition: PlayerPosition;
  isHost: boolean;
  onSelectSeat: (pos: PlayerPosition) => void;
  onStartMatch: () => void;
  onLeave: () => void;
  startError?: string | null;
}

export const LobbyView: React.FC<LobbyViewProps> = ({
  roomCode,
  seats,
  myPosition,
  isHost,
  onSelectSeat,
  onStartMatch,
  onLeave,
  startError,
}) => {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  // Build the invite link from the host's real LAN IP. Opening the page as
  // "localhost" on the host would otherwise produce a link nobody else can use.
  const [lanOrigin, setLanOrigin] = useState<string>(() =>
    typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'
  );
  useEffect(() => {
    let cancelled = false;
    fetch(`${lanClient.getHostUrl()}/api/lan-info`)
      .then((r) => (r.ok ? r.json() : null))
      .then((info: { primaryIp?: string; port?: number } | null) => {
        if (cancelled || !info?.primaryIp || typeof window === 'undefined') return;
        const { protocol, port, hostname } = window.location;
        const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
        if (!isLocal) return; // already opened via a LAN address
        // In Vite dev (5173) share the dev page; otherwise share the host server.
        const sharePort = port === '5173' ? '5173' : String(info.port ?? port);
        setLanOrigin(`${protocol}//${info.primaryIp}${sharePort ? `:${sharePort}` : ''}`);
      })
      .catch(() => {
        /* keep window origin */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const inviteUrl = `${lanOrigin}${typeof window !== 'undefined' ? window.location.pathname : '/'}?room=${roomCode}`;

  useEffect(() => {
    QRCode.toDataURL(inviteUrl, { width: 200, margin: 1, color: { dark: '#000000', light: '#ffffff' } }, (err, url) => {
      if (!err && url) {
        setQrDataUrl(url);
      }
    });
  }, [inviteUrl]);

  const handleCopyLink = () => {
    // navigator.clipboard is unavailable on plain-http LAN addresses; fall back to a hidden textarea.
    const fallbackCopy = () => {
      const ta = document.createElement('textarea');
      ta.value = inviteUrl;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } catch {
        /* ignore */
      }
      document.body.removeChild(ta);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(inviteUrl).catch(fallbackCopy);
    } else {
      fallbackCopy();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getSeat = (pos: PlayerPosition): LanSeat | undefined => {
    return seats.find((s) => s.position === pos);
  };

  const seat1 = getSeat(0); // Bottom, Team A
  const seat2 = getSeat(1); // Left, Team B
  const seat3 = getSeat(2); // Top, Team A
  const seat4 = getSeat(3); // Right, Team B

  const renderSeatCard = (seat: LanSeat | undefined, pos: PlayerPosition, label: string, teamLabel: string, isTeamA: boolean) => {
    const isMySeat = myPosition === pos;
    const isOccupied = Boolean(seat?.occupied ?? (seat?.connected && seat?.playerId));
    const isReconnecting = isOccupied && !seat?.connected;

    return (
      <div
        onClick={() => {
          if (!isMySeat && !isOccupied) {
            onSelectSeat(pos);
          }
        }}
        className={`relative p-4 rounded-3xl border-2 transition-all flex flex-col justify-between cursor-pointer ${
          isMySeat
            ? 'border-amber-400 bg-amber-500/10 ring-2 ring-amber-400/40 shadow-xl'
            : isOccupied
            ? 'border-slate-800 bg-slate-900/90 shadow-md cursor-default'
            : isTeamA
            ? 'border-dashed border-emerald-500/50 bg-emerald-950/20 hover:border-emerald-400 hover:bg-emerald-950/40'
            : 'border-dashed border-amber-500/50 bg-amber-950/20 hover:border-amber-400 hover:bg-amber-950/40'
        }`}
      >
        {/* Seat Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isTeamA ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
            />
            <span
              className={`text-xs font-black uppercase tracking-wider ${
                isTeamA ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {label} ({teamLabel})
            </span>
          </div>

          {isMySeat ? (
            <span className="text-[10px] bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full font-black uppercase">
              YOUR SEAT
            </span>
          ) : isOccupied ? (
            <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-bold">
              OCCUPIED
            </span>
          ) : (
            <span className="text-[10px] bg-slate-800/80 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold animate-pulse">
              CLICK TO SIT
            </span>
          )}
        </div>

        {/* Seat Body */}
        <div className="py-3 flex items-center gap-3">
          <div
            className={`w-11 h-11 rounded-2xl flex items-center justify-center border font-bold ${
              isMySeat
                ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                : isOccupied
                ? 'bg-slate-800 border-slate-700 text-slate-200'
                : 'bg-slate-950 border-slate-800 text-slate-500'
            }`}
          >
            {isReconnecting ? (
              <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
            ) : isOccupied || isMySeat ? (
              <User className="w-5 h-5" />
            ) : (
              <Users className="w-5 h-5 opacity-40" />
            )}
          </div>

          <div>
            <div className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
              {isMySeat ? (
                <>
                  <span>{seat?.playerName || 'You'}</span>
                  {seat?.isHost && (
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-black">
                      HOST
                    </span>
                  )}
                </>
              ) : isOccupied ? (
                <span>{seat?.playerName}</span>
              ) : (
                <span className="text-slate-400 italic">Waiting for a player…</span>
              )}
            </div>
            <div className="text-[11px] text-slate-500">
              {isReconnecting ? 'Reconnecting…' : isOccupied || isMySeat ? 'Connected' : 'Open seat — share the invite link'}
            </div>
          </div>
        </div>

        {/* Switch Seat Action if Vacant */}
        {!isMySeat && !isOccupied && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectSeat(pos);
            }}
            className="w-full mt-2 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200 transition-colors"
          >
            Move to Seat {pos + 1}
          </button>
        )}
      </div>
    );
  };

  const playerCount = seats.filter((s) => s.connected && (s.occupied ?? Boolean(s.playerId))).length;
  const missing = 4 - playerCount;
  const canStart = missing === 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6">
      {/* Top Navbar */}
      <header className="max-w-4xl mx-auto w-full flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <button
            onClick={onLeave}
            className="flex items-center gap-2 text-slate-400 hover:text-slate-100 transition-colors text-sm font-semibold"
          >
            <ArrowLeft className="w-4 h-4" /> Leave Lobby
          </button>
          <img src="/assets/game_logo.png" alt="The 29 Game" className="w-8 h-8 object-contain drop-shadow" />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-2xl">
            <Wifi className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">LAN Room:</span>
            <span className="font-mono text-base font-black text-amber-400 pl-1">{roomCode}</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto w-full my-4 space-y-6">
        {/* LAN Invite Card with Link & QR Code */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-center sm:text-left">
            <h3 className="text-sm font-black text-slate-100 flex items-center justify-center sm:justify-start gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" /> Invite LAN Players (Same Wi-Fi)
            </h3>
            <p className="text-xs text-slate-400">
              Open <span className="font-mono text-amber-300 font-bold">{inviteUrl}</span> on other laptops or phones.
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => setShowQr(!showQr)}
              className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 flex items-center justify-center gap-1.5 transition-colors"
            >
              <QrCode className="w-4 h-4 text-amber-400" />
              {showQr ? 'Hide QR' : 'Show QR'}
            </button>

            <button
              onClick={handleCopyLink}
              className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-1.5"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy Link'}
            </button>
          </div>
        </div>

        {/* QR Code Popdown (If expanded) */}
        {showQr && qrDataUrl && (
          <div className="flex flex-col items-center justify-center p-6 bg-slate-900 border border-amber-500/40 rounded-3xl animate-fade-in space-y-2">
            <span className="text-xs font-bold text-slate-300">Scan with Phone or Tablet on same Wi-Fi:</span>
            <img src={qrDataUrl} alt="Room QR Code" className="w-44 h-44 rounded-2xl border-4 border-white shadow-xl" />
            <span className="text-[11px] font-mono text-amber-400 font-semibold">{inviteUrl}</span>
          </div>
        )}

        {/* 4 Interactive Seats Layout */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-400" /> 4 Table Seats (Click any vacant seat to switch)
            </h4>
            <span className="text-xs text-slate-400">
              Partners: <span className="text-emerald-400 font-bold">Team A (Seats 1 & 3)</span> vs{' '}
              <span className="text-amber-400 font-bold">Team B (Seats 2 & 4)</span>
            </span>
          </div>

          {/* 4 Seat Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Seat 1: Bottom / Team A */}
            {renderSeatCard(seat1, 0, 'Seat 1: Bottom', 'Team A', true)}

            {/* Seat 3: Top / Team A (Partner) */}
            {renderSeatCard(seat3, 2, 'Seat 3: Top (Partner)', 'Team A', true)}

            {/* Seat 2: Left / Team B (Opponent) */}
            {renderSeatCard(seat2, 1, 'Seat 2: Left', 'Team B', false)}

            {/* Seat 4: Right / Team B (Opponent) */}
            {renderSeatCard(seat4, 3, 'Seat 4: Right', 'Team B', false)}
          </div>
        </div>

        {/* Informational Banner */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-3.5 text-center text-xs text-slate-400">
          💡 29 is played by exactly 4 people. The match can start once every seat is filled. Partners sit opposite each other.
        </div>
      </main>

      {/* Footer Start Control */}
      <footer className="max-w-4xl mx-auto w-full pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-xs text-slate-400 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>
            {playerCount} / 4 players connected{missing > 0 ? ` • waiting for ${missing} more` : ' • ready to start'}
          </span>
        </div>

        {isHost ? (
          <div className="flex flex-col items-center sm:items-end gap-1.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={onStartMatch}
              disabled={!canStart}
              className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm shadow-xl shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 transform active:scale-95 disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-400 disabled:shadow-none disabled:cursor-not-allowed disabled:active:scale-100"
            >
              <Play className={`w-4 h-4 ${canStart ? 'fill-slate-950' : 'fill-slate-400'}`} />
              {canStart ? 'Start Match' : `Waiting for ${missing} more player${missing > 1 ? 's' : ''}`}
            </button>
            {startError && <span className="text-[11px] text-rose-300 font-semibold">{startError}</span>}
          </div>
        ) : (
          <div className="text-xs text-slate-400 font-medium italic animate-pulse">
            Waiting for the Room Host to start the match...
          </div>
        )}
      </footer>
    </div>
  );
};
