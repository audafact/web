// Analytics service for tracking user interactions and conversion events

export interface AnalyticsEvent {
  event: string;
  userId?: string;
  sessionId: string;
  timestamp: number;
  properties: Record<string, any>;
  userTier: 'guest' | 'free' | 'pro';
  version: string;
  platform: 'web' | 'mobile';
}

export interface TrackingEvents {
  // Signup flow events
  'signup_modal_shown': { trigger: string; userTier: string };
  'signup_modal_dismissed': { trigger: string; userTier: string };
  'signup_completed': { method: 'email' | 'google'; trigger: string; upgradeRequired: boolean };
  'signup_error': { trigger: string; error: string };
  'post_signup_action': { action: string; userTier: string };
  
  // Feature gate interactions
  'feature_gate_clicked': { feature: string; userTier: string; gateType: string };
  
  // Demo engagement
  'demo_track_loaded': { trackId: string; genre: string; bpm: number };
  'demo_mode_switched': { fromMode: string; toMode: string };
  'demo_cue_triggered': { cueIndex: number; trackId: string };
  'demo_next_track': { fromTrackId: string; toTrackId: string };
  
  // Conversion events
  'upgrade_clicked': { feature: string; currentTier: string };
  'upgrade_completed': { plan: string; amount: number };
}

class AnalyticsService {
  private static instance: AnalyticsService;
  private events: AnalyticsEvent[] = [];
  private isOnline: boolean = navigator.onLine;
  private sessionId: string;
  private userId?: string;
  private userTier: string = 'guest';
  private retryQueue: AnalyticsEvent[] = [];
  
  private constructor() {
    this.sessionId = this.generateSessionId();
    this.setupOnlineOfflineHandling();
    this.loadRetryQueue();
  }
  
  static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService();
    }
    return AnalyticsService.instance;
  }
  
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private setupOnlineOfflineHandling() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.processRetryQueue();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }
  
  setUser(userId: string, userTier: string) {
    this.userId = userId;
    this.userTier = userTier;
  }
  
  track<K extends keyof TrackingEvents>(
    event: K, 
    properties: TrackingEvents[K]
  ) {
    const eventData: AnalyticsEvent = {
      event,
      userId: this.userId,
      sessionId: this.sessionId,
      timestamp: Date.now(),
      properties,
      userTier: this.userTier as 'guest' | 'free' | 'pro',
      version: '1.0.0',
      platform: 'web'
    };
    
    // Store locally
    this.events.push(eventData);
    
    // Send immediately if online
    if (this.isOnline) {
      this.sendEvent(eventData);
    } else {
      // Store for retry
      this.storeForRetry(eventData);
    }
    
    // Keep only last 100 events in memory
    if (this.events.length > 100) {
      this.events = this.events.slice(-100);
    }
    
    // Log for development
    console.log(`Analytics: ${event}`, eventData);
  }
  
  private async sendEvent(eventData: AnalyticsEvent) {
    try {
      // TODO: Replace with actual analytics endpoint
      const response = await fetch('/api/analytics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData),
      });
      
      if (!response.ok) {
        throw new Error(`Analytics request failed: ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to send analytics event:', error);
      this.storeForRetry(eventData);
    }
  }
  
  private storeForRetry(eventData: AnalyticsEvent) {
    this.retryQueue.push(eventData);
    localStorage.setItem('analytics_retry_queue', JSON.stringify(this.retryQueue));
  }
  
  private loadRetryQueue() {
    try {
      const stored = localStorage.getItem('analytics_retry_queue');
      if (stored) {
        this.retryQueue = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load analytics retry queue:', error);
    }
  }
  
  private async processRetryQueue() {
    if (this.retryQueue.length === 0) return;
    
    const eventsToRetry = [...this.retryQueue];
    this.retryQueue = [];
    
    for (const eventData of eventsToRetry) {
      await this.sendEvent(eventData);
    }
    
    localStorage.setItem('analytics_retry_queue', JSON.stringify(this.retryQueue));
  }
  
  getEvents(): AnalyticsEvent[] {
    return [...this.events];
  }
  
  clearEvents() {
    this.events = [];
  }
}

// Global analytics instance
export const analytics = AnalyticsService.getInstance();

// Convenience function for tracking events
export const trackEvent = <K extends keyof TrackingEvents>(
  event: K, 
  properties: TrackingEvents[K]
) => {
  analytics.track(event, properties);
}; 