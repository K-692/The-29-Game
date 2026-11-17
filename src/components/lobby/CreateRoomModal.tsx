import React, { useState } from 'react';
import { DEFAULT_RULES_CONFIG, GameRulesConfig, PlayerPosition } from '../../engine/types';
import { Dialog, DialogError } from '../common/Dialog';

interface CreateRoomModalProps {
  initialName: string;
  onClose: () => void;
  onCreate: (hostName: string, rules: GameRulesConfig, preferredSeat: PlayerPosition) => Promise<string | null>;
}

export const CreateRoomModal: React.FC<CreateRoomModalProps> = ({ initialName, onClose, onCreate }) => {
  const [name, setName] = useState(initialName || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    // Seats can be changed in the lobby; standard 29 rules apply.
    const err = await onCreate(name.trim(), DEFAULT_RULES_CONFIG, 0);
    if (err) {
      setError(err);
      setBusy(false);
    }
  };

  return (
    <Dialog title="Host a room" subtitle="Friends on your Wi-Fi can join with the room code." onClose={onClose}>
      <form onSubmit={handleCreate} className="space-y-4">
        <label className="block space-y-1.5">
          <span className="eyebrow">Your name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            maxLength={20}
            required
            autoFocus
            className="field"
          />
        </label>
        <DialogError message={error} />
        <button type="submit" disabled={busy || !name.trim()} className="btn-primary w-full py-3">
          {busy ? 'Creating…' : 'Create room'}
        </button>
      </form>
    </Dialog>
  );
};
