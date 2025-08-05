import React, { useState, useMemo, useEffect } from 'react';
import { LibraryPanelProps, LibraryTrack } from '../types/music';
import { useUserTier } from '../hooks/useUserTier';
import { useAccessControl } from '../hooks/useAccessControl';
import { usePreviewAudio } from '../hooks/usePreviewAudio';
import { trackEvent } from '../services/analyticsService';
import { LibraryService } from '../services/libraryService';
import LibraryTrackItem from './LibraryTrackItem';

const LibraryPanel: React.FC<LibraryPanelProps> = ({
  isOpen,
  onToggle,
  onAddToStudio,
  onPreviewTrack,
  isLoading
}) => {
  const { tier } = useUserTier();
  const { canAccessFeature } = useAccessControl();
  const { togglePreview, isPreviewing } = usePreviewAudio();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  const [tracks, setTracks] = useState<LibraryTrack[]>([]);
  const [availableGenres, setAvailableGenres] = useState<string[]>(['all']);
  const [rotationInfo, setRotationInfo] = useState<{ weekNumber: number; trackCount: number } | null>(null);
  const [isLoadingTracks, setIsLoadingTracks] = useState(true);
  
  // Load tracks from Supabase
  useEffect(() => {
    const loadTracks = async () => {
      setIsLoadingTracks(true);
      try {
        const [tracksData, genresData, rotationData] = await Promise.all([
          LibraryService.getLibraryTracks(tier.id),
          LibraryService.getAvailableGenres(tier.id),
          LibraryService.getCurrentRotationInfo()
        ]);
        
        setTracks(tracksData);
        setAvailableGenres(['all', ...genresData]);
        setRotationInfo(rotationData);
      } catch (error) {
        console.error('Error loading library tracks:', error);
      } finally {
        setIsLoadingTracks(false);
      }
    };
    
    if (isOpen) {
      loadTracks();
    }
  }, [isOpen, tier.id]);
  
  // Filter tracks based on search and genre
  const filteredTracks = useMemo(() => {
    let filtered = tracks;
    
    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(track => 
        track.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        track.artist?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        track.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
    
    // Filter by genre
    if (selectedGenre !== 'all') {
      filtered = filtered.filter(track => track.genre === selectedGenre);
    }
    
    return filtered;
  }, [tracks, searchTerm, selectedGenre]);
  
  const handlePreviewTrack = async (track: LibraryTrack) => {
    await togglePreview(track);
  };
  
  const handleAddToStudio = (track: LibraryTrack) => {
    if (tier.id === 'guest') {
      // Dispatch custom event for signup modal
      window.dispatchEvent(new CustomEvent('showSignupModal', {
        detail: { trigger: 'add_library_track' }
      }));
      return;
    }
    
    onAddToStudio(track);
    
    // Track add to studio event
    trackEvent('library_track_added', {
      trackId: track.id,
      genre: track.genre,
      userTier: tier.id
    });
  };
  
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    
    if (value) {
      trackEvent('library_search_performed', {
        searchTerm: value,
        resultsCount: filteredTracks.length,
        userTier: tier.id
      });
    }
  };
  
  const handleGenreChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const genre = e.target.value;
    setSelectedGenre(genre);
    
    if (genre !== 'all') {
      trackEvent('library_genre_filtered', {
        genre,
        resultsCount: filteredTracks.length,
        userTier: tier.id
      });
    }
  };
  
  const formatRotationInfo = () => {
    if (!rotationInfo) return null;
    
    if (tier.id === 'free') {
      return (
        <div className="rotation-info">
          <span className="rotation-badge">
            🔄 Week {Math.floor(rotationInfo.weekNumber)} • {rotationInfo.trackCount} tracks available
          </span>
        </div>
      );
    }
    
    return null;
  };

  return (
    <div className={`library-panel ${isOpen ? 'open' : ''}`}>
      <div className="library-header">
        <h3>🎵 Track Library</h3>
        <button onClick={onToggle} className="close-button">
          ✕
        </button>
      </div>
      
      {formatRotationInfo()}
      
      <div className="library-filters">
        <div className="search-container">
          <input
            type="text"
            placeholder="Search tracks..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="search-input"
          />
        </div>
        
        <div className="genre-filter">
          <select
            value={selectedGenre}
            onChange={handleGenreChange}
            className="genre-select"
          >
            {availableGenres.map(genre => (
              <option key={genre} value={genre}>
                {genre === 'all' ? 'All Genres' : genre.charAt(0).toUpperCase() + genre.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>
      
      <div className="library-content">
        {isLoading || isLoadingTracks ? (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Loading library...</p>
          </div>
        ) : filteredTracks.length === 0 ? (
          <div className="empty-state">
            <p>No tracks found matching your criteria.</p>
            {tier.id === 'free' && (
              <p className="rotation-note">
                New tracks rotate weekly. Check back next week for fresh content!
              </p>
            )}
          </div>
        ) : (
          <div className="track-list">
            {filteredTracks.map(track => (
              <LibraryTrackItem
                key={track.id}
                track={track}
                isPreviewing={isPreviewing(track.id)}
                onPreview={() => handlePreviewTrack(track)}
                onAddToStudio={() => handleAddToStudio(track)}
                canAddToStudio={tier.id !== 'guest'}
                isProOnly={track.isProOnly || false}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default LibraryPanel; 