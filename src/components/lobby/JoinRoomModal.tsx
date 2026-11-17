import React, { useState } from 'react';
import { PlayerPosition } from '../../engine/types';
import { Dialog, DialogError } from '../common/Dialog';

interface JoinRoomModalProps {
  initialRoomCode?: string;
  initialName: string;
  onClose: () => void;
  onJoin: (roomCode: string, playerName: string, hostAddress: string, preferredSeat?: PlayerPosition) => Promise<string | null>;
}

export const JoinRoomModal: React.FC<JoinRoomModalProps> = ({ initialRoomCode = '', initialName, onClose, onJoin }) => {
  const [code, setCode] = useState(initialRoomCode.toUpperCase());
  const [name, setName] = useState(initialName || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim() || busy) return;
    setBusy(true);
    setError(null);
    // No seat preference: the first open seat is taken; seats can be switched in the lobby.
    const err = await onJoin(code.trim().toUpperCase(), name.trim(), '');
    if (err) {
      setError(err);
      setBusy(false);
    }
  };

  return (
    <Dialog title="Join a room" subtitle="Ask the host for the 6-letter room code." onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block space-y-1.5">
          <span className="eyebrow">Room code</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABC123"
            maxLength={8}
            required
            autoFocus={!initialRoomCode}
            className="field font-mono text-lg tracking-[0.35em] text-center uppercase"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="eyebrow">Your name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            maxLength={20}
            required
            autoFocus={Boolean(initialRoomCode)}
            className="field"
          />
        </label>

        <DialogError message={error} />
        <button type="submit" disabled={busy || !code.trim() || !name.trim()} className="btn-primary w-full py-3">
          {busy ? 'Joining…' : 'Join'}
        </button>
      </form>
    </Dialog>
  );
};
