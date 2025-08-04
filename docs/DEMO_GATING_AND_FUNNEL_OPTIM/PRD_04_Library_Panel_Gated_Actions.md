# 📚 PRD 4: Library Panel & Gated Actions

## 📋 Overview

**Scope:** Right-hand curated track panel, always-on preview button, "Add to Studio" gated behind signup, randomized track switching via UI

**Dependencies:** PRD 1 (track loading logic)  
**Parallelizable:** Yes  
**Estimated Timeline:** 1-2 weeks

---

## 🎯 Objectives

- Provide engaging library browsing experience for all users
- Enable track preview functionality for immediate value demonstration
- Gate "Add to Studio" actions behind signup to drive conversion
- Implement smart track switching to showcase variety

---

## 🏗️ Technical Requirements

### 4.1 Library Track Management

#### Track Data Structure
```typescript
interface LibraryTrack {
  id: string;
  name: string;
  artist?: string;
  genre: string;
  bpm: number;
  key?: string;
  duration: number;
  file: string;
  type: 'wav' | 'mp3';
  size: string;
  tags: string[];
  isProOnly?: boolean;
  previewUrl?: string;
}

interface LibraryPanelProps {
  isOpen: boolean;
  onToggle: () => void;
  onAddToStudio: (track: LibraryTrack) => void;
  onPreviewTrack: (track: LibraryTrack) => void;
  isLoading: boolean;
}
```

#### Library Track Collection
```typescript
const LIBRARY_TRACKS: LibraryTrack[] = [
  {
    id: 'ron-drums',
    name: 'RON Drums',
    artist: 'RON',
    genre: 'drum-n-bass',
    bpm: 140,
    key: 'Am',
    duration: 180,
    file: ronDrums,
    type: 'wav',
    size: '5.5MB',
    tags: ['drums', 'drum-n-bass', 'electronic'],
    previewUrl: '/previews/ron-drums-preview.mp3'
  },
  {
    id: 'secrets-of-the-heart',
    name: 'Secrets of the Heart',
    artist: 'Ambient Collective',
    genre: 'ambient',
    bpm: 120,
    key: 'Cm',
    duration: 240,
    file: secretsOfTheHeart,
    type: 'mp3',
    size: '775KB',
    tags: ['ambient', 'atmospheric', 'chill'],
    previewUrl: '/previews/secrets-preview.mp3'
  },
  {
    id: 'rhythm-revealed',
    name: 'The Rhythm Revealed (Drums)',
    artist: 'House Masters',
    genre: 'house',
    bpm: 128,
    key: 'Fm',
    duration: 200,
    file: rhythmRevealed,
    type: 'wav',
    size: '5.5MB',
    tags: ['house', 'drums', 'groove'],
    previewUrl: '/previews/rhythm-preview.mp3'
  },
  {
    id: 'unveiled-desires',
    name: 'Unveiled Desires',
    artist: 'Techno Collective',
    genre: 'techno',
    bpm: 135,
    key: 'Em',
    duration: 220,
    file: unveiledDesires,
    type: 'wav',
    size: '6.0MB',
    tags: ['techno', 'dark', 'industrial'],
    previewUrl: '/previews/unveiled-preview.mp3'
  },
  // Pro-only tracks
  {
    id: 'pro-exclusive-1',
    name: 'Pro Exclusive Track 1',
    artist: 'Premium Artist',
    genre: 'progressive-house',
    bpm: 128,
    key: 'Am',
    duration: 300,
    file: proTrack1,
    type: 'wav',
    size: '8.2MB',
    tags: ['progressive', 'house', 'premium'],
    isProOnly: true,
    previewUrl: '/previews/pro-1-preview.mp3'
  }
];
```

### 4.2 Library Panel Component

```typescript
const LibraryPanel: React.FC<LibraryPanelProps> = ({
  isOpen,
  onToggle,
  onAddToStudio,
  onPreviewTrack,
  isLoading
}) => {
  const { tier } = useUserTier();
  const { canAccessFeature } = useAccessControl();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  const [previewingTrack, setPreviewingTrack] = useState<string | null>(null);
  const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null);
  
  // Filter tracks based on user tier and search
  const filteredTracks = useMemo(() => {
    let tracks = LIBRARY_TRACKS;
    
    // Filter by pro access
    if (tier.id !== 'pro') {
      tracks = tracks.filter(track => !track.isProOnly);
    }
    
    // Filter by search term
    if (searchTerm) {
      tracks = tracks.filter(track => 
        track.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        track.artist?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        track.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
    
    // Filter by genre
    if (selectedGenre !== 'all') {
      tracks = tracks.filter(track => track.genre === selectedGenre);
    }
    
    return tracks;
  }, [searchTerm, selectedGenre, tier.id]);
  
  // Get unique genres for filter
  const availableGenres = useMemo(() => {
    const genres = [...new Set(LIBRARY_TRACKS.map(track => track.genre))];
    return ['all', ...genres];
  }, []);
  
  const handlePreviewTrack = async (track: LibraryTrack) => {
    // Stop current preview
    if (previewAudio) {
      previewAudio.pause();
      previewAudio.currentTime = 0;
    }
    
    if (previewingTrack === track.id) {
      setPreviewingTrack(null);
      setPreviewAudio(null);
      return;
    }
    
    try {
      const audio = new Audio(track.previewUrl || track.file);
      audio.volume = 0.7;
      
      audio.addEventListener('ended', () => {
        setPreviewingTrack(null);
        setPreviewAudio(null);
      });
      
      await audio.play();
      setPreviewingTrack(track.id);
      setPreviewAudio(audio);
      
      // Track preview event
      trackEvent('library_track_previewed', {
        trackId: track.id,
        genre: track.genre,
        bpm: track.bpm,
        userTier: tier.id
      });
      
    } catch (error) {
      console.error('Failed to preview track:', error);
    }
  };
  
  const handleAddToStudio = (track: LibraryTrack) => {
    if (tier.id === 'guest') {
      showSignupModal('add_library_track');
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
  
  return (
    <div className={`library-panel ${isOpen ? 'open' : ''}`}>
      <div className="library-header">
        <h3>🎵 Track Library</h3>
        <button onClick={onToggle} className="close-button">
          ✕
        </button>
      </div>
      
      <div className="library-filters">
        <div className="search-container">
          <input
            type="text"
            placeholder="Search tracks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        
        <div className="genre-filter">
          <select
            value={selectedGenre}
            onChange={(e) => setSelectedGenre(e.target.value)}
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
        {isLoading ? (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Loading library...</p>
          </div>
        ) : filteredTracks.length === 0 ? (
          <div className="empty-state">
            <p>No tracks found matching your criteria.</p>
          </div>
        ) : (
          <div className="track-list">
            {filteredTracks.map(track => (
              <LibraryTrackItem
                key={track.id}
                track={track}
                isPreviewing={previewingTrack === track.id}
                onPreview={() => handlePreviewTrack(track)}
                onAddToStudio={() => handleAddToStudio(track)}
                canAddToStudio={tier.id !== 'guest'}
                isProOnly={track.isProOnly}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
```

### 4.3 Library Track Item Component

```typescript
interface LibraryTrackItemProps {
  track: LibraryTrack;
  isPreviewing: boolean;
  onPreview: () => void;
  onAddToStudio: () => void;
  canAddToStudio: boolean;
  isProOnly: boolean;
}

const LibraryTrackItem: React.FC<LibraryTrackItemProps> = ({
  track,
  isPreviewing,
  onPreview,
  onAddToStudio,
  canAddToStudio,
  isProOnly
}) => {
  const { tier } = useUserTier();
  
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
          {isPreviewing ? '⏹️' : '🕃'}
        </button>
        
        {canAddToStudio ? (
          <button
            onClick={onAddToStudio}
            className="add-button"
            title="Add to studio"
          >
            ➕
          </button>
        ) : (
          <button
            onClick={() => showSignupModal('add_library_track')}
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
```

---

## 🎨 UI/UX Requirements

### Library Panel Styling

```css
/* Library panel container */
.library-panel {
  position: fixed;
  top: 0;
  right: -400px;
  width: 400px;
  height: 100vh;
  background: white;
  border-left: 1px solid #e5e7eb;
  transition: right 0.3s ease;
  z-index: 1000;
  display: flex;
  flex-direction: column;
}

.library-panel.open {
  right: 0;
}

.library-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
}

.library-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
}

.close-button {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: #6b7280;
  padding: 4px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.close-button:hover {
  background: #e5e7eb;
}

/* Filters section */
.library-filters {
  padding: 16px 20px;
  border-bottom: 1px solid #e5e7eb;
  background: white;
}

.search-container {
  margin-bottom: 12px;
}

.search-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
}

.search-input:focus {
  outline: none;
  border-color: #3b82f6;
}

.genre-filter {
  margin-bottom: 8px;
}

.genre-select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  background: white;
}

/* Track list */
.library-content {
  flex: 1;
  overflow-y: auto;
  padding: 0 20px;
}

.track-list {
  padding: 16px 0;
}

.track-item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 16px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  margin-bottom: 12px;
  background: white;
  transition: all 0.2s;
}

.track-item:hover {
  border-color: #3b82f6;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.1);
}

.track-item.pro-only {
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  border-color: #f59e0b;
}

.track-info {
  flex: 1;
  margin-right: 12px;
}

.track-header {
  display: flex;
  align-items: center;
  margin-bottom: 4px;
}

.track-name {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
}

.pro-badge {
  background: #f59e0b;
  color: white;
  font-size: 10px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 10px;
  margin-left: 8px;
  text-transform: uppercase;
}

.track-artist {
  margin: 0 0 8px 0;
  font-size: 14px;
  color: #6b7280;
}

.track-meta {
  display: flex;
  gap: 12px;
  margin-bottom: 8px;
}

.track-genre,
.track-bpm,
.track-key {
  font-size: 12px;
  color: #6b7280;
  background: #f3f4f6;
  padding: 2px 6px;
  border-radius: 4px;
}

.track-tags {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.track-tag {
  font-size: 11px;
  color: #3b82f6;
  background: rgba(59, 130, 246, 0.1);
  padding: 2px 6px;
  border-radius: 10px;
}

.track-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.preview-button,
.add-button {
  width: 36px;
  height: 36px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  transition: all 0.2s;
}

.preview-button:hover,
.add-button:hover:not(.locked) {
  border-color: #3b82f6;
  background: #f0f9ff;
}

.preview-button.playing {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
}

.add-button.locked {
  opacity: 0.6;
  cursor: not-allowed;
}

.add-button.locked:hover {
  border-color: #d1d5db;
  background: white;
}

/* Loading and empty states */
.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
  color: #6b7280;
}

.loading-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid #e5e7eb;
  border-top: 2px solid #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 12px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
```

---

## 🔧 Implementation Details

### Track Switching Integration

```typescript
const useTrackSwitcher = () => {
  const { loadRandomDemoTrack } = useDemo();
  const [switchHistory, setSwitchHistory] = useState<string[]>([]);
  
  const switchToTrack = (trackId: string) => {
    // Add to history
    setSwitchHistory(prev => [...prev, trackId]);
    
    // Load the track
    loadTrackById(trackId);
    
    // Track switching event
    trackEvent('track_switched', {
      fromTrackId: switchHistory[switchHistory.length - 1] || 'none',
      toTrackId: trackId,
      userTier: getCurrentUserTier()
    });
  };
  
  const switchToRandomTrack = () => {
    const availableTracks = LIBRARY_TRACKS.filter(track => 
      !track.isProOnly || getCurrentUserTier() === 'pro'
    );
    
    const randomTrack = availableTracks[Math.floor(Math.random() * availableTracks.length)];
    switchToTrack(randomTrack.id);
  };
  
  return {
    switchToTrack,
    switchToRandomTrack,
    switchHistory
  };
};
```

### Preview Audio Management

```typescript
const usePreviewAudio = () => {
  const [currentPreview, setCurrentPreview] = useState<{
    trackId: string;
    audio: HTMLAudioElement;
  } | null>(null);
  
  const startPreview = async (track: LibraryTrack) => {
    // Stop current preview
    if (currentPreview) {
      currentPreview.audio.pause();
      currentPreview.audio.currentTime = 0;
    }
    
    try {
      const audio = new Audio(track.previewUrl || track.file);
      audio.volume = 0.7;
      audio.loop = false;
      
      // Set up event listeners
      audio.addEventListener('ended', () => {
        setCurrentPreview(null);
      });
      
      audio.addEventListener('error', () => {
        console.error('Failed to load preview audio');
        setCurrentPreview(null);
      });
      
      await audio.play();
      setCurrentPreview({ trackId: track.id, audio });
      
    } catch (error) {
      console.error('Failed to start preview:', error);
    }
  };
  
  const stopPreview = () => {
    if (currentPreview) {
      currentPreview.audio.pause();
      currentPreview.audio.currentTime = 0;
      setCurrentPreview(null);
    }
  };
  
  const isPreviewing = (trackId: string) => {
    return currentPreview?.trackId === trackId;
  };
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (currentPreview) {
        currentPreview.audio.pause();
      }
    };
  }, [currentPreview]);
  
  return {
    startPreview,
    stopPreview,
    isPreviewing,
    currentPreview
  };
};
```

---

## 🧪 Testing Requirements

### Unit Tests
```typescript
describe('Library Panel & Gated Actions', () => {
  describe('LibraryPanel Component', () => {
    it('should filter tracks by search term', () => {
      const { getByPlaceholderText, getByText } = render(
        <LibraryPanel
          isOpen={true}
          onToggle={jest.fn()}
          onAddToStudio={jest.fn()}
          onPreviewTrack={jest.fn()}
          isLoading={false}
        />
      );
      
      const searchInput = getByPlaceholderText('Search tracks...');
      fireEvent.change(searchInput, { target: { value: 'drums' } });
      
      expect(getByText('RON Drums')).toBeInTheDocument();
      expect(queryByText('Secrets of the Heart')).not.toBeInTheDocument();
    });
    
    it('should filter tracks by genre', () => {
      const { getByText } = render(
        <LibraryPanel
          isOpen={true}
          onToggle={jest.fn()}
          onAddToStudio={jest.fn()}
          onPreviewTrack={jest.fn()}
          isLoading={false}
        />
      );
      
      const genreSelect = getByText('All Genres').parentElement;
      fireEvent.change(genreSelect, { target: { value: 'ambient' } });
      
      expect(getByText('Secrets of the Heart')).toBeInTheDocument();
      expect(queryByText('RON Drums')).not.toBeInTheDocument();
    });
    
    it('should show locked add button for guest users', () => {
      const { getByTitle } = render(
        <LibraryTrackItem
          track={LIBRARY_TRACKS[0]}
          isPreviewing={false}
          onPreview={jest.fn()}
          onAddToStudio={jest.fn()}
          canAddToStudio={false}
          isProOnly={false}
        />
      );
      
      const addButton = getByTitle('Sign up to add this track to your studio');
      expect(addButton).toHaveClass('locked');
    });
  });
  
  describe('Preview Audio Management', () => {
    it('should start and stop preview audio', async () => {
      const { result } = renderHook(() => usePreviewAudio());
      
      const track = LIBRARY_TRACKS[0];
      await result.current.startPreview(track);
      
      expect(result.current.isPreviewing(track.id)).toBe(true);
      
      result.current.stopPreview();
      expect(result.current.isPreviewing(track.id)).toBe(false);
    });
  });
});
```

---

## 📊 Analytics Events

### Library Interaction Events
```typescript
interface LibraryEvents {
  'library_panel_opened': { userTier: string };
  'library_track_previewed': { trackId: string; genre: string; bpm: number; userTier: string };
  'library_track_added': { trackId: string; genre: string; userTier: string };
  'library_search_performed': { searchTerm: string; resultsCount: number; userTier: string };
  'library_genre_filtered': { genre: string; resultsCount: number; userTier: string };
  'track_switched': { fromTrackId: string; toTrackId: string; userTier: string };
}
```

---

## 🚀 Success Criteria

- [ ] Library panel displays curated tracks with proper filtering
- [ ] Track preview functionality works for all users
- [ ] "Add to Studio" button is gated for guest users
- [ ] Pro-only tracks are clearly marked and restricted
- [ ] Search and genre filtering work correctly
- [ ] Track switching integrates with demo mode
- [ ] Preview audio management handles multiple tracks
- [ ] Analytics events track library interactions
- [ ] UI is responsive and accessible

---

## 🔄 Dependencies & Integration

### Input Dependencies
- PRD 1: Demo Mode Foundation (for track loading logic)

### Output Dependencies
- PRD 2: Feature Gating Architecture (for access control)
- PRD 3: Signup Flow & Modal Triggers (for gated actions)
- PRD 6: Analytics & Funnel Tracking (for interaction tracking)

### Integration Points
- `useDemo` hook for track loading
- `useUserTier` hook for access control
- `showSignupModal` for gated actions
- Audio API for preview functionality
- Analytics service for interaction tracking 