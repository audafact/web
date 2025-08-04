import React from 'react';

interface NextTrackButtonProps {
  onNextTrack: () => void;
  isLoading: boolean;
  className?: string;
}

const NextTrackButton: React.FC<NextTrackButtonProps> = ({ 
  onNextTrack, 
  isLoading, 
  className = '' 
}) => {
  return (
    <button
      onClick={onNextTrack}
      disabled={isLoading}
      className={`next-track-button ${className}`}
      title="Try another demo track"
    >
      {isLoading ? '🔄 Loading...' : '⏭️ Next Track'}
    </button>
  );
};

export default NextTrackButton; 