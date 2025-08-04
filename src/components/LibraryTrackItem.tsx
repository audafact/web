import React from 'react';
import { LibraryTrackItemProps } from '../types/music';
import { useUserTier } from '../hooks/useUserTier';

const LibraryTrackItem: React.FC<LibraryTrackItemProps> = ({
  track,
  isPreviewing,
  onPreview,
  onAddToStudio,
  canAddToStudio,
  isProOnly
}) => {
  const { tier } = useUserTier();
  
  const handleAddToStudio = () => {
    if (tier.id === 'guest') {
      // Dispatch custom event for signup modal
      window.dispatchEvent(new CustomEvent('showSignupModal', {
        detail: { trigger: 'add_library_track' }
      }));
      return;
    }
    
    onAddToStudio();
  };
  
  return (
    <div className={`track-item ${isProOnly ? 'pro-only' : ''}`}>
      <div className="track-info">
        <div className="track-header">
          <h4 className="track-name">{track.name}</h4>
          {isProOnly && <span className="pro-badge">PRO</span>}
        </div>
        
        {track.artist && (
          <p className="track-artist">{track.artist}</p>
        )}
        
        <div className="track-meta">
          <span className="track-genre">{track.genre}</span>
          <span className="track-bpm">{track.bpm} BPM</span>
          {track.key && <span className="track-key">{track.key}</span>}
        </div>
        
        <div className="track-tags">
          {track.tags.slice(0, 3).map(tag => (
            <span key={tag} className="track-tag">{tag}</span>
          ))}
        </div>
      </div>
      
      <div className="track-actions">
        <button
          onClick={onPreview}
          className={`preview-button ${isPreviewing ? 'playing' : ''}`}
          title={isPreviewing ? 'Stop preview' : 'Preview track'}
        >
          {isPreviewing ? (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>
        
        {canAddToStudio ? (
          <button
            onClick={handleAddToStudio}
            className="add-button"
            title="Add to studio"
          >
            ➕
          </button>
        ) : (
          <button
            onClick={handleAddToStudio}
            className="add-button locked"
            title="Sign up to add this track to your studio"
          >
            🔒
          </button>
        )}
      </div>
    </div>
  );
};

export default LibraryTrackItem; 