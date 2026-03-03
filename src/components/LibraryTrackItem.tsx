import React from 'react';
import { LibraryTrackItemProps } from '../types/music';
import { useUser } from '../hooks/useUser';

const LibraryTrackItem: React.FC<LibraryTrackItemProps> = ({
  track,
  isPreviewing,
  onPreview,
  onAddToStudio,
  canAddToStudio,
  isProOnly
}) => {
  const { tier } = useUser();
  
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

  const genresText = [track.genre, ...(track.tags ?? [])]
    .filter(Boolean)
    .flatMap((s) => String(s).split(',').map((x) => x.trim()).filter(Boolean))
    .join(', ');

  const handleDragStart = (e: React.DragEvent) => {
    if (tier.id === 'guest') {
      e.preventDefault();
      return;
    }

    e.dataTransfer.setData('text/plain', track.id);
    e.dataTransfer.setData('application/json', JSON.stringify({
      type: 'library-track',
      name: track.name,
      id: track.id,
      file: track.fileKey,
      trackType: track.type
    }));
    e.dataTransfer.effectAllowed = 'copy';
  };
  
  return (
    <div 
      className={`track-item ${isProOnly ? 'pro-only' : ''}`}
      draggable={canAddToStudio}
      onDragStart={handleDragStart}
      title={canAddToStudio ? 'Drag to studio or click + to add' : undefined}
    >
      {canAddToStudio && (
        <div className="flex flex-col gap-0.5 self-center text-audafact-text-secondary opacity-60 mr-2" aria-hidden>
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="9" cy="6" r="1.5" />
            <circle cx="15" cy="6" r="1.5" />
            <circle cx="9" cy="12" r="1.5" />
            <circle cx="15" cy="12" r="1.5" />
            <circle cx="9" cy="18" r="1.5" />
            <circle cx="15" cy="18" r="1.5" />
          </svg>
        </div>
      )}
      <div className="track-info">
        <div className="track-header">
          <h4 className="track-name">{track.name}</h4>
          {isProOnly && <span className="pro-badge">PRO</span>}
        </div>
        
        {track.artist && (
          <p className="track-artist">{track.artist}</p>
        )}
        
        <div className="track-meta">
          <span className="track-bpm">{track.bpm} BPM</span>
          {track.key && <span className="track-key">{track.key}</span>}
        </div>

        {genresText && (
          <p className="track-genres" title={genresText}>
            {genresText}
          </p>
        )}
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
            style={{ color: 'white', fontSize: '18px', fontWeight: 'bold' }}
          >
            +
          </button>
        ) : (
          <button
            onClick={handleAddToStudio}
            className="add-button locked"
            title="Sign up to add this track to your studio"
            style={{ color: 'white', fontSize: '16px' }}
          >
            🔒
          </button>
        )}
      </div>
    </div>
  );
};

export default LibraryTrackItem; 