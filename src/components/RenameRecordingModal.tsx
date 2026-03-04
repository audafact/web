import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';

interface RenameRecordingModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentName: string;
  onSave: (newName: string) => Promise<void>;
}

export const RenameRecordingModal: React.FC<RenameRecordingModalProps> = ({
  isOpen,
  onClose,
  currentName,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Strip extension for editing; we'll add it back on save or use as-is
      const base = currentName.replace(/\.(mp3|wav|wave)$/i, '') || currentName;
      setName(base);
    }
  }, [isOpen, currentName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      // If user didn't add extension, keep original or default to .wav
      const ext = currentName.match(/\.(mp3|wav|wave)$/i)?.[1] || 'wav';
      const finalName = trimmed.includes('.') ? trimmed : `${trimmed}.${ext}`;
      await onSave(finalName);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="p-6">
        <h3 className="text-lg font-semibold audafact-heading mb-4">Rename recording</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="rename-input" className="block text-sm font-medium audafact-text-primary mb-1">
              Name
            </label>
            <input
              id="rename-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-audafact-surface-2 border border-audafact-divider rounded-lg audafact-text-primary placeholder-audafact-text-secondary focus:outline-none focus:ring-2 focus:ring-audafact-accent-cyan"
              placeholder="Recording name"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 audafact-text-secondary hover:audafact-text-primary transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || saving}
              className="px-4 py-2 bg-audafact-accent-cyan text-audafact-bg-primary rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
};
