import React from 'react';
import { useUserTier } from '../hooks/useUserTier';

interface RotationInfoProps {
  weekNumber: number;
  trackCount: number;
  className?: string;
}

export const RotationInfo: React.FC<RotationInfoProps> = ({ 
  weekNumber, 
  trackCount, 
  className = '' 
}) => {
  const { tier } = useUserTier();

  if (tier.id !== 'free') {
    return null;
  }

  const getNextRotationDate = () => {
    const now = new Date();
    const daysUntilNextWeek = 7 - now.getDay();
    const nextWeek = new Date(now);
    nextWeek.setDate(now.getDate() + daysUntilNextWeek);
    nextWeek.setHours(0, 0, 0, 0);
    return nextWeek;
  };

  const formatTimeUntilNextRotation = () => {
    const now = new Date();
    const nextRotation = getNextRotationDate();
    const diffMs = nextRotation.getTime() - now.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''}`;
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''}`;
    } else {
      return 'Less than an hour';
    }
  };

  return (
    <div className={`rotation-info ${className}`}>
      <div className="rotation-badge">
        <span className="rotation-icon">🔄</span>
        <span className="rotation-text">
          Week {Math.floor(weekNumber)} • {trackCount} tracks available
        </span>
      </div>
      <div className="rotation-countdown">
        <span className="countdown-text">
          New tracks in {formatTimeUntilNextRotation()}
        </span>
      </div>
    </div>
  );
}; 