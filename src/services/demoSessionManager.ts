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

  private getScopedKey(scope: string = 'guest'): string {
    return `${DEMO_SESSION_KEY}:${scope}`;
  }
  
  saveDemoState(state: DemoSessionState, scope: string = 'guest'): void {
    try {
      const sessionData = {
        ...state,
        timestamp: Date.now()
      };
      localStorage.setItem(this.getScopedKey(scope), JSON.stringify(sessionData));
    } catch (error) {
      console.error('Failed to save demo state:', error);
    }
  }
  
  getDemoState(scope: string = 'guest'): DemoSessionState | null {
    try {
      const stored = localStorage.getItem(this.getScopedKey(scope));
      if (!stored) return null;
      
      const state: DemoSessionState = JSON.parse(stored);
      
      // Check if state is still valid (within 1 hour)
      const now = Date.now();
      const oneHour = 60 * 60 * 1000;
      
      if (now - state.timestamp > oneHour) {
        this.clearDemoState(scope);
        return null;
      }
      
      return state;
    } catch (error) {
      console.error('Failed to get demo state:', error);
      return null;
    }
  }
  
  clearDemoState(scope: string = 'guest'): void {
    try {
      localStorage.removeItem(this.getScopedKey(scope));
    } catch (error) {
      console.error('Failed to clear demo state:', error);
    }
  }
  
  restoreDemoState(scope: string = 'guest'): boolean {
    const state = this.getDemoState(scope);
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