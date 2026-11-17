import React from 'react';
import { Dialog } from '../common/Dialog';
import { RulesContent } from '../common/RulesContent';

interface HowToPlayModalProps {
  onClose: () => void;
}

export const HowToPlayModal: React.FC<HowToPlayModalProps> = ({ onClose }) => (
  <Dialog title="How to play 29" onClose={onClose} width="max-w-lg">
    <div className="max-h-[65vh] overflow-y-auto pr-1 -mr-1">
      <RulesContent />
    </div>
  </Dialog>
);
