import React, { useEffect } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, X } from 'lucide-react';

export interface SampleEditModeProps {
  /** Stable id for transition key when switching session tracks */
  sessionTrackId: string;
  trackLabel: string;
  children: React.ReactNode;
  onClose: () => void;
  onPrevLibrary: () => void;
  onNextLibrary: () => void;
  onPrevSessionTrack: () => void;
  onNextSessionTrack: () => void;
  hasPrevSessionTrack: boolean;
  hasNextSessionTrack: boolean;
  isTrackLoading: boolean;
}

/**
 * Full-screen sample edit shell: dimmed backdrop (tap to close), header with library L/R and back,
 * optional vertical session track arrows, Escape to close. Body is provided by Studio (waveform + controls).
 */
const SampleEditMode: React.FC<SampleEditModeProps> = ({
  sessionTrackId,
  trackLabel,
  children,
  onClose,
  onPrevLibrary,
  onNextLibrary,
  onPrevSessionTrack,
  onNextSessionTrack,
  hasPrevSessionTrack,
  hasNextSessionTrack,
  isTrackLoading,
}) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Sample edit"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/55 cursor-default"
        aria-label="Close sample edit"
        onClick={onClose}
        data-testid="sample-edit-backdrop"
      />
      <div
        className="relative z-[1] flex max-h-[min(92vh,920px)] w-full max-w-4xl flex-col overflow-hidden rounded-card border border-audafact-divider bg-audafact-surface-1 shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-center gap-1.5 border-b border-audafact-divider bg-audafact-surface-2 px-2 py-2 sm:gap-2 sm:px-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-audafact-divider px-2 py-1.5 text-xs font-medium text-audafact-text-primary hover:bg-audafact-surface-1"
            title="Back to Studio"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">Back</span>
          </button>

          <button
            type="button"
            disabled={isTrackLoading}
            onClick={onPrevLibrary}
            className="inline-flex shrink-0 items-center gap-0.5 rounded-lg border border-audafact-divider px-1.5 py-1.5 text-[11px] font-medium text-audafact-text-secondary hover:bg-audafact-surface-1 hover:text-audafact-accent-cyan disabled:cursor-not-allowed disabled:opacity-50 sm:gap-1 sm:px-2 sm:text-xs"
            title="Previous library sample"
          >
            <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
            <span className="max-w-[4.5rem] truncate sm:max-w-none">Prev sample</span>
          </button>

          <h2 className="min-w-0 flex-1 truncate text-center text-sm font-semibold audafact-heading sm:text-base">
            Sample edit — <span className="font-normal text-audafact-text-secondary">{trackLabel}</span>
          </h2>

          <button
            type="button"
            disabled={isTrackLoading}
            onClick={onNextLibrary}
            className="inline-flex shrink-0 items-center gap-0.5 rounded-lg border border-audafact-divider px-1.5 py-1.5 text-[11px] font-medium text-audafact-text-secondary hover:bg-audafact-surface-1 hover:text-audafact-accent-cyan disabled:cursor-not-allowed disabled:opacity-50 sm:gap-1 sm:px-2 sm:text-xs"
            title="Next library sample"
          >
            <span className="max-w-[4.5rem] truncate text-right sm:max-w-none">Next sample</span>
            <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
          </button>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex shrink-0 items-center justify-center rounded-lg border border-audafact-divider p-1.5 text-audafact-text-secondary hover:bg-audafact-surface-1 hover:text-audafact-text-primary"
            title="Close"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          <div
            key={sessionTrackId}
            className="transition-opacity duration-200 ease-out motion-reduce:transition-none"
          >
            {children}
          </div>
        </div>

        {(hasPrevSessionTrack || hasNextSessionTrack) && (
          <footer className="flex shrink-0 items-center justify-center gap-6 border-t border-audafact-divider bg-audafact-surface-2 px-3 py-2">
            <button
              type="button"
              onClick={onPrevSessionTrack}
              disabled={!hasPrevSessionTrack}
              className="inline-flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-xs font-medium text-audafact-text-secondary hover:bg-audafact-surface-1 hover:text-audafact-accent-cyan disabled:cursor-not-allowed disabled:opacity-40"
              title="Previous track in session"
            >
              <ChevronUp className="h-5 w-5" aria-hidden />
              Previous track
            </button>
            <button
              type="button"
              onClick={onNextSessionTrack}
              disabled={!hasNextSessionTrack}
              className="inline-flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-xs font-medium text-audafact-text-secondary hover:bg-audafact-surface-1 hover:text-audafact-accent-cyan disabled:cursor-not-allowed disabled:opacity-40"
              title="Next track in session"
            >
              <ChevronDown className="h-5 w-5" aria-hidden />
              Next track
            </button>
          </footer>
        )}
      </div>
    </div>
  );
};

export default SampleEditMode;
