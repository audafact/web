import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Modal } from './Modal';

interface Performance {
  id: string;
  startTime: number;
  endTime?: number;
  events: unknown[];
  tracks: string[];
  duration: number;
  audioBlob?: Blob;
  databaseId?: string;
}

interface ExportRecordingModalProps {
  performance: Performance | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (filename: string, format: 'mp3' | 'wav') => void;
  onExport: (filename: string, format: 'mp3' | 'wav') => void;
  onSaveAndExport: (filename: string, format: 'mp3' | 'wav') => void;
  onCancel?: () => void;
  allowedFormats: ('mp3' | 'wav')[];
  canSave?: boolean;
  /** When WAV is blocked, called when user clicks the upgrade CTA */
  onUpgradeWav?: () => void;
  /** When save is blocked (recording limit), called when user clicks the upgrade CTA */
  onUpgradeSave?: () => void;
}

const defaultFilename = () =>
  `audafact_recording_${new Date().toISOString().slice(0, 16).replace('T', '_')}`;

export const ExportRecordingModal: React.FC<ExportRecordingModalProps> = ({
  performance,
  isOpen,
  onClose,
  onSave,
  onExport,
  onSaveAndExport,
  onCancel,
  allowedFormats,
  canSave = true,
  onUpgradeWav,
  onUpgradeSave,
}) => {
  const [filename, setFilename] = useState(defaultFilename);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const effectiveFormats = canSave ? allowedFormats : (allowedFormats.includes('mp3') ? ['mp3'] as const : allowedFormats);
  const [format, setFormat] = useState<'mp3' | 'wav'>(effectiveFormats.includes('wav') ? 'wav' : 'mp3');
  const prevOpenRef = useRef(false);

  useEffect(() => {
    if (isOpen && !prevOpenRef.current) {
      setFilename(defaultFilename());
      setDropdownOpen(false);
      const formats = canSave ? allowedFormats : (allowedFormats.includes('mp3') ? ['mp3'] : allowedFormats);
      setFormat(formats.includes('wav') ? 'wav' : 'mp3');
    }
    prevOpenRef.current = isOpen;
  }, [isOpen, allowedFormats, canSave]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const openDropdown = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownPosition({ top: rect.bottom + 4, left: rect.right - 192 });
    }
    setDropdownOpen(true);
  };

  const getFinalFilename = () => {
    const ext = format === 'mp3' ? 'mp3' : 'wav';
    return filename.endsWith(`.${ext}`) ? filename : `${filename}.${ext}`;
  };

  const handleAction = (action: 'save' | 'export' | 'saveAndExport') => {
    if (!performance) return;
    const finalFilename = getFinalFilename();
    if (action === 'save') onSave(finalFilename, format);
    else if (action === 'export') onExport(finalFilename, format);
    else onSaveAndExport(finalFilename, format);
    setDropdownOpen(false);
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
              You&apos;ve hit your plan&apos;s recording limit. Export your flip to finish the idea (MP3) — upgrade for more saves
              and WAV.
            </p>
          </div>
        )}

        <div className="mb-4 p-3 bg-audafact-surface-2 rounded-lg">
          <p className="text-sm audafact-text-secondary">
            Duration: {durationStr} • {performance.tracks.length} tracks
          </p>
        </div>

        <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
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

          {!canSave && onUpgradeSave && (
            <button
              type="button"
              onClick={onUpgradeSave}
              className="flex items-center gap-2 text-left p-2 -m-2 rounded-lg border border-audafact-divider bg-audafact-surface-2/50 opacity-75 hover:opacity-100 hover:border-audafact-accent-cyan/50 hover:bg-audafact-surface-2 transition-colors group w-full"
            >
              <span className="w-4 h-4 rounded-full border-2 border-audafact-divider flex-shrink-0" />
              <span className="audafact-text-secondary">Save to app</span>
              <span className="ml-auto text-xs font-medium px-2 py-0.5 rounded bg-audafact-accent-cyan/20 text-audafact-accent-cyan group-hover:bg-audafact-accent-cyan/30">
                Pro
              </span>
            </button>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 audafact-text-secondary hover:audafact-text-primary transition-colors"
            >
              Cancel
            </button>
            <div ref={triggerRef} className="relative">
              <div className="flex rounded-lg overflow-hidden border border-audafact-accent-cyan/50">
                <button
                  type="button"
                  onClick={() => handleAction('saveAndExport')}
                  className="px-4 py-2 bg-audafact-accent-cyan text-audafact-bg-primary font-medium hover:opacity-90 transition-opacity"
                >
                  Save & Export
                </button>
                <button
                  type="button"
                  onClick={() => dropdownOpen ? setDropdownOpen(false) : openDropdown()}
                  className="px-2 py-2 bg-audafact-accent-cyan text-audafact-bg-primary border-l border-audafact-accent-cyan/70 hover:opacity-90 transition-opacity"
                  aria-label="More options"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={dropdownOpen ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
                  </svg>
                </button>
              </div>
              {dropdownOpen && createPortal(
                <div
                  ref={dropdownRef}
                  className="fixed py-1 w-48 bg-audafact-surface-2 border border-audafact-divider rounded-lg shadow-lg z-[60]"
                  style={{ top: dropdownPosition.top, left: dropdownPosition.left }}
                >
                  <button
                    type="button"
                    onClick={() => handleAction('save')}
                    disabled={!canSave}
                    className="w-full px-4 py-2 text-left text-sm audafact-text-primary hover:bg-audafact-surface-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Save as…
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAction('export')}
                    className="w-full px-4 py-2 text-left text-sm audafact-text-primary hover:bg-audafact-surface-1"
                  >
                    Export only
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAction('saveAndExport')}
                    className="w-full px-4 py-2 text-left text-sm audafact-text-primary hover:bg-audafact-surface-1"
                  >
                    Save & Export
                  </button>
                </div>,
                document.body
              )}
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
};
