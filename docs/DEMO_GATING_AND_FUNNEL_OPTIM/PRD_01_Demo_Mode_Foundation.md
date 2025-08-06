# 🎮 PRD 1: Demo Mode Foundation & Track Playback

## 📋 Overview

**Scope:** Anonymous access via `/studio`, random track selection, demo autoplay config, cue/loop triggering (preset-only), waveform seek only

**Dependencies:** None  
**Parallelizable:** Yes  
**Estimated Timeline:** 1-2 weeks

---

## 🎯 Objectives

- Enable anonymous users to experience core Audafact functionality immediately
- Provide engaging demo experience with pre-configured tracks
- Allow basic interaction while gating advanced features
- Establish foundation for feature gating system

---

## 🏗️ Technical Requirements

### 3.1 Anonymous User Flow

#### Entry Point Configuration
```typescript
// Route configuration - no authentication required
{
  path: '/studio',
  element: <Studio />,
  // No ProtectedRoute wrapper
}
```

#### Demo Mode Detection
```typescript
const useDemoMode = () => {
  const { user } = useAuth();
  const isDemoMode = !user;
  
  return {
    isDemoMode,
    isAuthenticated: !!user
  };
};
```

### 3.2 Demo Track Management

#### Track Selection Strategy
```typescript
const demoTracks: AudioAsset[] = [
  { 
    id: 'ron-drums', 
    name: 'RON Drums',
    genre: 'drum-n-bass', 
    bpm: 140,
    file: ronDrums,
    type: 'wav',
    size: '5.5MB'
  },
  { 
    id: 'secrets-of-the-heart', 
    name: 'Secrets of the Heart',
    genre: 'ambient', 
    bpm: 120,
    file: secretsOfTheHeart,
    type: 'mp3',
    size: '775KB'
  },
  { 
    id: 'rhythm-revealed', 
    name: 'The Rhythm Revealed (Drums)',
    genre: 'house', 
    bpm: 128,
    file: rhythmRevealed,
    type: 'wav',
    size: '5.5MB'
  },
  { 
    id: 'unveiled-desires', 
    name: 'Unveiled Desires',
    genre: 'techno', 
    bpm: 135,
    file: unveiledDesires,
    type: 'wav',
    size: '6.0MB'
  }
];

// Random selection with genre rotation
const selectDemoTrack = (): AudioAsset => {
  const lastTrack = localStorage.getItem('lastDemoTrack');
  const availableTracks = demoTracks.filter(t => t.id !== lastTrack);
  const selected = availableTracks[Math.floor(Math.random() * availableTracks.length)];
  localStorage.setItem('lastDemoTrack', selected.id);
  return selected;
};
```

#### Demo Track Loading
```typescript
const useDemoTrackLoader = () => {
  const [currentDemoTrack, setCurrentDemoTrack] = useState<AudioAsset | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const loadRandomDemoTrack = useCallback(async () => {
    setIsLoading(true);
    try {
      const track = selectDemoTrack();
      setCurrentDemoTrack(track);
      
      // Track analytics event
      trackEvent('demo_track_loaded', { 
        trackId: track.id, 
        genre: track.genre, 
        bpm: track.bpm 
      });
      
    } catch (error) {
      console.error('Failed to load demo track:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  return {
    currentDemoTrack,
    isLoading,
    loadRandomDemoTrack
  };
};
```

### 3.3 Demo Feature Access Matrix

| Feature | Guest Access | Implementation |
|---------|-------------|----------------|
| **Studio View** | ✅ Full | No restrictions |
| **Playback Modes** | ✅ Preview, Loop, Cue | Pre-configured settings |
| **Cue/Loop Triggering** | ✅ Pre-set only | Disable drag handles |
| **Track Switching** | ✅ Random only | "Next Track" button |
| **Waveform Interaction** | ✅ Seek only | Disable cue/loop editing |
| **Zoom/Grid** | ✅ View only | No persistent settings |
| **Library Preview** | ✅ Listen only | Disable "Add to Studio" |
| **Upload** | ❌ Gated | Modal with signup CTA |
| **Save Session** | ❌ Gated | Disabled button |
| **Recording** | ❌ Gated | Free: 1 recording, Pro: unlimited |
| **Download** | ❌ Hidden | Completely hidden |

---

## 🎨 UI/UX Requirements

### Demo Mode Visual Indicators

```css
/* Demo mode indicator */
.demo-mode-indicator {
  position: fixed;
  top: 16px;
  right: 16px;
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 20px;
  padding: 4px 12px;
  font-size: 12px;
  color: #3b82f6;
  z-index: 1000;
}

/* Demo track info */
.demo-track-info {
  background: rgba(0, 0, 0, 0.05);
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 16px;
}

.demo-track-info h3 {
  margin: 0 0 4px 0;
  font-size: 16px;
  font-weight: 600;
}

.demo-track-info p {
  margin: 0;
  font-size: 14px;
  color: #6b7280;
}
```

### Next Track Button
```typescript
const NextTrackButton = () => {
  const { loadRandomDemoTrack, isLoading } = useDemoTrackLoader();
  
  return (
    <button
      onClick={loadRandomDemoTrack}
      disabled={isLoading}
      className="next-track-button"
      title="Try another demo track"
    >
      {isLoading ? '🔄 Loading...' : '⏭️ Next Track'}
    </button>
  );
};
```

---

## 🔧 Implementation Details

### Demo Context Provider
```typescript
interface DemoContextType {
  isDemoMode: boolean;
  currentDemoTrack: AudioAsset | null;
  loadRandomDemoTrack: () => void;
  trackDemoEvent: (event: string, properties: any) => void;
}

const DemoContext = createContext<DemoContextType | null>(null);

const DemoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isDemoMode } = useDemoMode();
  const { currentDemoTrack, loadRandomDemoTrack } = useDemoTrackLoader();
  
  const trackDemoEvent = useCallback((event: string, properties: any) => {
    if (isDemoMode) {
      // Track demo-specific events
      analytics.track(`demo_${event}`, {
        ...properties,
        userTier: 'guest',
        isDemo: true
      });
    }
  }, [isDemoMode]);
  
  const value = {
    isDemoMode,
    currentDemoTrack,
    loadRandomDemoTrack,
    trackDemoEvent
  };
  
  return (
    <DemoContext.Provider value={value}>
      {children}
    </DemoContext.Provider>
  );
};

export const useDemo = () => {
  const context = useContext(DemoContext);
  if (!context) {
    throw new Error('useDemo must be used within DemoProvider');
  }
  return context;
};
```

### Studio Component Integration
```typescript
const Studio = () => {
  const { isDemoMode, currentDemoTrack, loadRandomDemoTrack } = useDemo();
  
  useEffect(() => {
    if (isDemoMode && !currentDemoTrack) {
      loadRandomDemoTrack();
    }
  }, [isDemoMode, currentDemoTrack, loadRandomDemoTrack]);
  
  return (
    <div className="studio-container">
      {isDemoMode && (
        <>
          <div className="demo-mode-indicator">
            🎮 Demo Mode
          </div>
          <div className="demo-track-info">
            <h3>{currentDemoTrack?.name}</h3>
            <p>{currentDemoTrack?.genre} • {currentDemoTrack?.bpm} BPM</p>
          </div>
        </>
      )}
      
      {/* Existing studio components */}
      <WaveformDisplay 
        isDemoMode={isDemoMode}
        demoTrack={currentDemoTrack}
      />
      <TrackControls 
        isDemoMode={isDemoMode}
        onNextTrack={loadRandomDemoTrack}
      />
    </div>
  );
};
```

---

## 🧪 Testing Requirements

### Unit Tests
```typescript
describe('Demo Mode Foundation', () => {
  it('should load random demo track on mount', async () => {
    const { getByText } = render(<Studio />);
    
    await waitFor(() => {
      expect(getByText(/RON Drums|Secrets of the Heart/)).toBeInTheDocument();
    });
  });
  
  it('should show demo mode indicator for anonymous users', () => {
    const { getByText } = render(<Studio />);
    
    expect(getByText('🎮 Demo Mode')).toBeInTheDocument();
  });
  
  it('should allow track switching in demo mode', async () => {
    const { getByText } = render(<Studio />);
    
    const nextButton = getByText('⏭️ Next Track');
    fireEvent.click(nextButton);
    
    await waitFor(() => {
      expect(getByText('🔄 Loading...')).toBeInTheDocument();
    });
  });
});
```

### Integration Tests
```typescript
describe('Demo Track Selection', () => {
  it('should avoid repeating the same track', () => {
    const tracks = ['ron-drums', 'secrets-of-the-heart', 'rhythm-revealed'];
    const selected = selectDemoTrack();
    
    // Should not be the last track
    expect(selected.id).not.toBe(localStorage.getItem('lastDemoTrack'));
  });
});
```

---

## 📊 Analytics Events

### Demo-Specific Events
```typescript
interface DemoEvents {
  'demo_track_loaded': { trackId: string; genre: string; bpm: number };
  'demo_next_track': { fromTrackId: string; toTrackId: string };
  'demo_mode_switched': { fromMode: string; toMode: string };
  'demo_cue_triggered': { cueIndex: number; trackId: string };
  'demo_session_started': { timestamp: number };
  'demo_session_ended': { duration: number; actions: string[] };
}
```

---

## 🚀 Success Criteria

- [ ] Anonymous users can access `/studio` without authentication
- [ ] Random demo track loads automatically on page visit
- [ ] Demo mode indicator is visible to anonymous users
- [ ] Next track button allows switching between demo tracks
- [ ] Pre-configured cue/loop points work without editing
- [ ] Waveform seeking is functional but editing is disabled
- [ ] Analytics events are tracked for demo interactions
- [ ] Demo session duration is measured and reported

---

## 🔄 Dependencies & Integration

### Input Dependencies
- None (foundational PRD)

### Output Dependencies
- PRD 2: Feature Gating Architecture (for user tier integration)
- PRD 4: Library Panel & Gated Actions (for track loading logic)
- PRD 6: Analytics & Funnel Tracking (for event tracking)

### Integration Points
- `useAuth` hook for user detection
- `WaveformDisplay` component for demo track rendering
- `TrackControls` component for demo-specific controls
- Analytics service for demo event tracking 