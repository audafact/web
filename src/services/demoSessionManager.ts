import { DemoSessionState, DEMO_SESSION_KEY } from '../types/postSignup';

export class DemoSessionManager {
  private static instance: DemoSessionManager;
  
  private constructor() {}
  
  static getInstance(): DemoSessionManager {
    if (!DemoSessionManager.instance) {
      DemoSessionManager.instance = new DemoSessionManager();
    }
    return DemoSessionManager.instance;
  }
  
  saveDemoState(state: DemoSessionState): void {
    try {
      const sessionData = {
        ...state,
        timestamp: Date.now()
      };
      localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(sessionData));
    } catch (error) {
      console.error('Failed to save demo state:', error);
    }
  }
  
  getDemoState(): DemoSessionState | null {
    try {
      const stored = localStorage.getItem(DEMO_SESSION_KEY);
      if (!stored) return null;
      
      const state: DemoSessionState = JSON.parse(stored);
      
      // Check if state is still valid (within 1 hour)
      const now = Date.now();
      const oneHour = 60 * 60 * 1000;
      
      if (now - state.timestamp > oneHour) {
        this.clearDemoState();
        return null;
      }
      
      return state;
    } catch (error) {
      console.error('Failed to get demo state:', error);
      return null;
    }
  }
  
  clearDemoState(): void {
    try {
      localStorage.removeItem(DEMO_SESSION_KEY);
    } catch (error) {
      console.error('Failed to clear demo state:', error);
    }
  }
  
  restoreDemoState(): boolean {
    const state = this.getDemoState();
    if (!state) return false;
    
    try {
      // Restore track
      if (state.currentTrack) {
        this.loadTrack(state.currentTrack);
      }
      
      // Restore playback position
      if (state.playbackPosition) {
        this.setPlaybackPosition(state.playbackPosition);
      }
      
      // Restore mode
      if (state.mode) {
        this.setPlaybackMode(state.mode);
      }
      
      // Restore volume and tempo
      if (state.volume) {
        this.setVolume(state.volume);
      }
      if (state.tempo) {
        this.setTempo(state.tempo);
      }
      
      // Restore cue points and loops (read-only for guests)
      if (state.cuePoints) {
        this.setCuePoints(state.cuePoints);
      }
      if (state.loopRegions) {
        this.setLoopRegions(state.loopRegions);
      }
      
      return true;
    } catch (error) {
      console.error('Failed to restore demo state:', error);
      return false;
    }
  }
  
  // Placeholder methods - these would be implemented to integrate with the actual audio system
  private loadTrack(track: any): void {
    // TODO: Integrate with actual audio system
    console.log('Loading track:', track);
  }
  
  private setPlaybackPosition(position: number): void {
    // TODO: Integrate with actual audio system
    console.log('Setting playback position:', position);
  }
  
  private setPlaybackMode(mode: 'preview' | 'loop' | 'cue'): void {
    // TODO: Integrate with actual audio system
    console.log('Setting playback mode:', mode);
  }
  
  private setVolume(volume: number): void {
    // TODO: Integrate with actual audio system
    console.log('Setting volume:', volume);
  }
  
  private setTempo(tempo: number): void {
    // TODO: Integrate with actual audio system
    console.log('Setting tempo:', tempo);
  }
  
  private setCuePoints(cuePoints: any[]): void {
    // TODO: Integrate with actual audio system
    console.log('Setting cue points:', cuePoints);
  }
  
  private setLoopRegions(loopRegions: any[]): void {
    // TODO: Integrate with actual audio system
    console.log('Setting loop regions:', loopRegions);
  }
} 