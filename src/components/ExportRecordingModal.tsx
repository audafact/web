import React, { useState, useEffect, useRef } from 'react';
import { Modal } from './Modal';

interface Performance {
  id: string;
  startTime: number;
  endTime?: number;
  events: unknown[];
  tracks: string[];
  duration: number;
  audioBlob?: Blob;
}

interface ExportRecordingModalProps {
  performance: Performance | null;
  isOpen: boolean;
  onClose: () => void;
  onExport: (filename: string, format: 'mp3' | 'wav') => void;
  onCancel?: () => void;
  allowedFormats: ('mp3' | 'wav')[];
  canSave?: boolean;
  /** When WAV is blocked, called when user clicks the upgrade CTA */
  onUpgradeWav?: () => void;
}

const defaultFilename = () =>
  `audafact_recording_${new Date().toISOString().slice(0, 16).replace('T', '_')}`;

export const ExportRecordingModal: React.FC<ExportRecordingModalProps> = ({
  performance,
  isOpen,
  onClose,
  onExport,
  onCancel,
  allowedFormats,
  canSave = true,
  onUpgradeWav,
}) => {
  const [filename, setFilename] = useState(defaultFilename);
  const effectiveFormats = canSave ? allowedFormats : (allowedFormats.includes('mp3') ? ['mp3'] as const : allowedFormats);
  const [format, setFormat] = useState<'mp3' | 'wav'>(effectiveFormats.includes('wav') ? 'wav' : 'mp3');
  const prevOpenRef = useRef(false);

  useEffect(() => {
    if (isOpen && !prevOpenRef.current) {
      setFilename(defaultFilename());
      const formats = canSave ? allowedFormats : (allowedFormats.includes('mp3') ? ['mp3'] : allowedFormats);
      setFormat(formats.includes('wav') ? 'wav' : 'mp3');
    }
    prevOpenRef.current = isOpen;
  }, [isOpen, allowedFormats, canSave]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!performance) return;
    const ext = format === 'mp3' ? 'mp3' : 'wav';
    const finalFilename = filename.endsWith(`.${ext}`) ? filename : `${filename}.${ext}`;
    onExport(finalFilename, format);
    onClose();
  };

  if (!performance) return null;

  const durationSec = Math.floor(performance.duration / 1000);
  const durationStr = `${Math.floor(durationSec / 60)}:${(durationSec % 60).toString().padStart(2, '0')}`;

  const handleCancel = () => {
    onCancel?.();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleCancel}>
      <div className="p-6">
        <h3 className="text-lg font-semibold audafact-heading mb-4">Export Recording</h3>

        {!canSave && (
          <div className="mb-4 p-3 bg-amber-500/20 border border-amber-500/40 rounded-lg">
            <p className="text-sm text-amber-200">
              You&apos;ve reached your recording limit (1). Name and download as MP3 — this recording won&apos;t be saved to the app.
            </p>
          </div>
        )}

        <div className="mb-4 p-3 bg-audafact-surface-2 rounded-lg">
          <p className="text-sm audafact-text-secondary">
            Duration: {durationStr} • {performance.tracks.length} tracks
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="export-filename" className="block text-sm font-medium audafact-text-primary mb-1">
              Filename
            </label>
            <input
              id="export-filename"
              type="text"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              className="w-full px-3 py-2 bg-audafact-surface-2 border border-audafact-divider rounded-lg audafact-text-primary placeholder-audafact-text-secondary focus:outline-none focus:ring-2 focus:ring-audafact-accent-cyan"
              placeholder="audafact_recording_2025-03-03_14_30"
            />
          </div>

          <div>
            <label className="block text-sm font-medium audafact-text-primary mb-2">Format</label>
            <div className="flex flex-col gap-2">
              {effectiveFormats.includes('mp3') && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="format"
                    value="mp3"
                    checked={format === 'mp3'}
                    onChange={() => setFormat('mp3')}
                    className="text-audafact-accent-cyan focus:ring-audafact-accent-cyan"
                  />
                  <span className="audafact-text-primary">MP3 (compressed)</span>
                </label>
              )}
              {effectiveFormats.includes('wav') ? (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="format"
                    value="wav"
                    checked={format === 'wav'}
                    onChange={() => setFormat('wav')}
                    className="text-audafact-accent-cyan focus:ring-audafact-accent-cyan"
                  />
                  <span className="audafact-text-primary">WAV (stereo, DAW-ready)</span>
                </label>
              ) : onUpgradeWav ? (
                <button
                  type="button"
                  onClick={onUpgradeWav}
                  className="flex items-center gap-2 text-left p-2 -m-2 rounded-lg border border-audafact-divider bg-audafact-surface-2/50 opacity-75 hover:opacity-100 hover:border-audafact-accent-cyan/50 hover:bg-audafact-surface-2 transition-colors group"
                >
                  <span className="w-4 h-4 rounded-full border-2 border-audafact-divider" />
                  <span className="audafact-text-secondary">WAV (stereo, DAW-ready)</span>
                  <span className="ml-auto text-xs font-medium px-2 py-0.5 rounded bg-audafact-accent-cyan/20 text-audafact-accent-cyan group-hover:bg-audafact-accent-cyan/30">
                    Pro
                  </span>
                </button>
              ) : null}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 audafact-text-secondary hover:audafact-text-primary transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-audafact-accent-cyan text-audafact-bg-primary rounded-lg font-medium hover:opacity-90 transition-opacity"
            >
              Export
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
};
