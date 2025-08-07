import React, { useState, useEffect } from 'react';
import { LibraryService } from '../services/libraryService';
import { useUserTier } from '../hooks/useUserTier';

interface RotationInfoProps {
  className?: string;
}

const RotationInfo: React.FC<RotationInfoProps> = ({ className = '' }) => {
  const { tier } = useUserTier();
  const [rotationInfo, setRotationInfo] = useState<{
    weekNumber: number;
    trackCount: number;
    nextRotationDate: string;
    daysUntilRotation: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadRotationInfo = async () => {
      try {
        const info = await LibraryService.getCurrentRotationInfo();
        setRotationInfo(info);
      } catch (error) {
        console.error('Error loading rotation info:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadRotationInfo();
  }, []);

  // Only show for free users
  if (tier.id !== 'free' || isLoading || !rotationInfo) {
    return null;
  }

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  const getRotationMessage = () => {
    if (rotationInfo.daysUntilRotation === 0) {
      return "New tracks available today!";
    } else if (rotationInfo.daysUntilRotation === 1) {
      return "New tracks tomorrow!";
    } else {
      return `${rotationInfo.daysUntilRotation} days until new tracks`;
    }
  };

  return (
    <div className={`rotation-info ${className}`}>
      <div className="rotation-info-content">
        <div className="rotation-info-header">
          <span className="rotation-icon">🔄</span>
          <span className="rotation-title">Track Rotation</span>
        </div>
        
        <div className="rotation-details">
          <div className="rotation-stat">
            <span className="stat-label">Current Tracks:</span>
            <span className="stat-value">{rotationInfo.trackCount}/10</span>
          </div>
          
          <div className="rotation-stat">
            <span className="stat-label">Next Rotation:</span>
            <span className="stat-value">{formatDate(rotationInfo.nextRotationDate)}</span>
          </div>
          
          <div className="rotation-message">
            {getRotationMessage()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RotationInfo; 