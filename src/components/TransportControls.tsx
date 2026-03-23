/**
 * TransportControls - UI component for transport controls
 * 
 * Provides play/pause/stop buttons and tempo/time signature controls
 * for the master transport system.
 */

import React from 'react';
import { Play, Pause, Square } from 'lucide-react';
import { useTransport } from '../context/TransportContext';

export const TransportControls: React.FC = () => {
  const {
    state,
    currentBeat,
    tempo,
    timeSignature,
    start,
    stop,
    pause,
    setTempo,
  } = useTransport();

  const handlePlayPause = () => {
    if (state === 'playing') {
      pause();
    } else {
      start();
    }
  };

  return (
    <div className="flex items-center gap-4 p-4 bg-audafact-surface-1 border border-audafact-divider rounded-lg">
      {/* Transport Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={handlePlayPause}
          className="p-2 rounded hover:bg-audafact-surface-2 text-audafact-text-primary"
          title={state === 'playing' ? 'Pause' : 'Play'}
        >
          {state === 'playing' ? (
            <Pause className="w-5 h-5" />
          ) : (
            <Play className="w-5 h-5" />
          )}
        </button>
        <button
          onClick={stop}
          className="p-2 rounded hover:bg-audafact-surface-2 text-audafact-text-primary"
          title="Stop"
        >
          <Square className="w-5 h-5" />
        </button>
      </div>

      {/* Beat Position */}
      <div className="text-sm text-audafact-text-secondary">
        Beat: {currentBeat.toFixed(2)}
      </div>

      {/* Tempo Control */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-audafact-text-secondary">BPM:</label>
        <input
          type="number"
          value={tempo}
          onChange={(e) => setTempo(Number(e.target.value))}
          min="60"
          max="200"
          className="w-16 px-2 py-1 bg-audafact-surface-2 border border-audafact-divider rounded text-audafact-text-primary"
        />
      </div>

      {/* Time Signature Display */}
      <div className="text-sm text-audafact-text-secondary">
        {timeSignature.numerator}/{timeSignature.denominator}
      </div>
    </div>
  );
};

