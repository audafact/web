import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DemoSessionManager } from '../../src/services/demoSessionManager';
import { DemoSessionState } from '../../src/types/postSignup';

describe('Demo Session Management', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  
  afterEach(() => {
    localStorage.clear();
  });
  
  it('should save and restore demo state', () => {
    const demoManager = DemoSessionManager.getInstance();
    
    const timestamp = Date.now();
    const state: DemoSessionState = {
      currentTrack: { id: 'test_track', name: 'Test Track' },
      playbackPosition: 30,
      cuePoints: [],
      loopRegions: [],
      mode: 'preview',
      volume: 0.8,
      tempo: 120,
      timestamp
    };
    
    demoManager.saveDemoState(state);
    
    const restored = demoManager.getDemoState();
    // Allow for small timestamp differences (within 10ms)
    expect(restored).toMatchObject({
      currentTrack: state.currentTrack,
      playbackPosition: state.playbackPosition,
      volume: state.volume,
      tempo: state.tempo,
      mode: state.mode,
      cuePoints: state.cuePoints,
      loopRegions: state.loopRegions
    });
    expect(restored?.timestamp).toBeCloseTo(timestamp, -1); // Within 10ms
  });
  
  it('should clear expired demo state', () => {
    const demoManager = DemoSessionManager.getInstance();
    
    const oldState: DemoSessionState = {
      currentTrack: null,
      playbackPosition: 0,
      cuePoints: [],
      loopRegions: [],
      mode: 'preview',
      volume: 1,
      tempo: 120,
      timestamp: Date.now() - (2 * 60 * 60 * 1000) // 2 hours ago
    };
    
    // Save with old timestamp
    localStorage.setItem('demo_session_state', JSON.stringify(oldState));
    
    const restored = demoManager.getDemoState();
    expect(restored).toBeNull();
  });
  
  it('should clear demo state', () => {
    const demoManager = DemoSessionManager.getInstance();
    
    const state: DemoSessionState = {
      currentTrack: null,
      playbackPosition: 0,
      cuePoints: [],
      loopRegions: [],
      mode: 'preview',
      volume: 1,
      tempo: 120,
      timestamp: Date.now()
    };
    
    demoManager.saveDemoState(state);
    demoManager.clearDemoState();
    
    const restored = demoManager.getDemoState();
    expect(restored).toBeNull();
  });
  
  it('should restore demo state successfully', () => {
    const demoManager = DemoSessionManager.getInstance();
    
    const state: DemoSessionState = {
      currentTrack: { id: 'test_track', name: 'Test Track' },
      playbackPosition: 45,
      cuePoints: [{ time: 10, label: 'Intro' }],
      loopRegions: [{ start: 20, end: 40 }],
      mode: 'loop',
      volume: 0.7,
      tempo: 140,
      timestamp: Date.now()
    };
    
    demoManager.saveDemoState(state);
    
    const restored = demoManager.restoreDemoState();
    expect(restored).toBe(true);
  });
  
  it('should handle invalid stored data gracefully', () => {
    const demoManager = DemoSessionManager.getInstance();
    
    // Store invalid JSON
    localStorage.setItem('demo_session_state', 'invalid json');
    
    const restored = demoManager.getDemoState();
    expect(restored).toBeNull();
  });
}); 