import React from 'react';
import { AudioAsset } from '../context/DemoContext';

interface DemoTrackInfoProps {
  track: AudioAsset | null;
  className?: string;
}

const DemoTrackInfo: React.FC<DemoTrackInfoProps> = ({ track, className = '' }) => {
  if (!track) return null;

  return (
    <div className={`demo-track-info ${className}`}>
      <h3>{track.name}</h3>
      <p>{track.genre} • {track.bpm} BPM</p>
    </div>
  );
};

export default DemoTrackInfo; 