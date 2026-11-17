import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { PlayerPosition } from '../../engine/types';
import { LanSeat, lanClient } from '../../services/lanClient';
import { ArrowLeft, Check, Copy, QrCode, Bot, Loader2 } from 'lucide-react';

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
    QRCode.toDataURL(inviteUrl, { width: 200, margin: 1, color: { dark: '#153524', light: '#f5f0e1' } }, (err, url) => {
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

  const seatAt = (pos: PlayerPosition) => seats.find((s) => s.position === pos);
  const isTaken = (s?: LanSeat) => Boolean(s?.occupied ?? (s?.connected && s?.playerId));
  const playerCount = seats.filter((s) => s.connected && isTaken(s)).length;
  const cpuCount = 4 - playerCount;

  // Seats drawn relative to the viewer: you at the bottom, partner opposite.
  const rel = (offset: number) => ((myPosition + offset) % 4) as PlayerPosition;

  const SeatChip: React.FC<{ pos: PlayerPosition }> = ({ pos }) => {
    const seat = seatAt(pos);
    const mine = pos === myPosition;
    const taken = isTaken(seat);
    const reconnecting = taken && !seat?.connected;
    const partner = pos % 2 === myPosition % 2;
    const clickable = !mine && !taken;
    return (
      <button
        type="button"
        disabled={!clickable}
        onClick={() => clickable && onSelectSeat(pos)}
        title={clickable ? 'Sit here' : undefined}
        className={`w-32 sm:w-36 rounded-xl px-3 py-2 text-left transition border ${
          mine
            ? 'bg-cream-100 text-felt-800 border-cream-100'
            : taken
            ? 'bg-felt-900/70 border-cream-100/15 text-cream-50'
            : 'border-dashed border-cream-100/25 text-cream-300/70 hover:border-cream-100/60 hover:text-cream-50'
        }`}
      >
        <div className={`text-[9px] uppercase tracking-[0.16em] ${mine ? 'text-felt-600' : 'text-cream-300/60'}`}>
          {mine ? 'You' : partner ? 'Partner' : 'Opponent'}
        </div>
        <div className="flex items-center gap-1.5 text-sm truncate">
          {taken ? (
            <>
              <span>{seat?.avatar}</span>
              <span className="truncate font-medium">{seat?.playerName}</span>
              {seat?.isHost && <span className="text-[9px] opacity-60">host</span>}
              {reconnecting && <Loader2 className="w-3 h-3 animate-spin opacity-70" />}
            </>
          ) : (
            <>
              <Bot className="w-3.5 h-3.5" />
              <span>Computer</span>
            </>
          )}
        </div>
      </button>
    );
  };

  return (
    <div className="min-h-[100dvh] bg-felt-800 bg-[radial-gradient(ellipse_at_center,_#225438_0%,_#153524_70%)] text-cream-100 flex flex-col p-4 sm:p-6">
      <header className="flex items-center justify-between">
        <button onClick={onLeave} className="flex items-center gap-1.5 text-sm text-cream-300/80 hover:text-cream-50">
          <ArrowLeft className="w-4 h-4" /> Leave
        </button>
        <img src="/assets/game_logo.png" alt="29" className="w-9 h-9 rounded-lg" />
      </header>

      <main className="flex-1 flex flex-col items-center justify-center gap-8 py-6">
        {/* Room code + invite */}
        <div className="text-center space-y-3">
          <div className="eyebrow">Room code</div>
          <div className="font-mono text-4xl sm:text-5xl tracking-[0.3em] text-cream-50 pl-[0.3em]">{roomCode}</div>
          <div className="flex items-center justify-center gap-2">
            <button onClick={handleCopyLink} className="btn-ghost py-1.5 px-3 text-xs">
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy invite link'}
            </button>
            <button onClick={() => setShowQr((v) => !v)} className="btn-ghost py-1.5 px-3 text-xs" aria-pressed={showQr}>
              <QrCode className="w-3.5 h-3.5" /> QR
            </button>
          </div>
          {showQr && qrDataUrl && (
            <div className="flex flex-col items-center gap-1.5 pt-1 animate-fade-in">
              <img src={qrDataUrl} alt="Invite QR code" className="w-36 h-36 rounded-xl" />
              <span className="text-[11px] font-mono text-cream-300/70">{inviteUrl}</span>
            </div>
          )}
        </div>

        {/* Seats around a mini table */}
        <div className="grid grid-cols-3 grid-rows-3 items-center justify-items-center gap-2 sm:gap-3">
          <div className="col-start-2 row-start-1"><SeatChip pos={rel(2)} /></div>
          <div className="col-start-1 row-start-2"><SeatChip pos={rel(1)} /></div>
          <div className="col-start-2 row-start-2 w-24 h-16 sm:w-32 sm:h-20 rounded-[50%] bg-felt-500/60 border border-cream-100/20 shadow-inner" aria-hidden />
          <div className="col-start-3 row-start-2"><SeatChip pos={rel(3)} /></div>
          <div className="col-start-2 row-start-3"><SeatChip pos={rel(0)} /></div>
        </div>
        <p className="text-xs text-cream-300/70 -mt-4">Tap an open seat to move. Open seats are played by the computer.</p>
      </main>

      <footer className="flex flex-col items-center gap-2 pb-2">
        {isHost ? (
          <>
            <button onClick={onStartMatch} disabled={playerCount < 1} className="btn-primary px-10 py-3">
              Start game
            </button>
            <span className="text-xs text-cream-300/70">
              {playerCount} {playerCount === 1 ? 'player' : 'players'}
              {cpuCount > 0 ? ` + ${cpuCount} computer` : ''}
            </span>
            {startError && <span className="text-xs text-suit-red">{startError}</span>}
          </>
        ) : (
          <span className="text-sm text-cream-300/80 animate-pulse">Waiting for the host to start…</span>
        )}
      </footer>
    </div>
  );
};
