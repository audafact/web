export interface AnalyticsEvent {
  event: string;
  properties: Record<string, any>;
  timestamp: number;
  sessionId: string;
  userId?: string;
  userTier: string;
  retryCount: number;
  maxRetries: number;
}

export class AnalyticsReliabilityService {
  private static instance: AnalyticsReliabilityService;
  private pendingEvents: AnalyticsEvent[] = [];
  private isOnline: boolean = navigator.onLine;
  private retryInterval: number = 5000; // 5 seconds
  private maxRetries: number = 3;
  private retryTimer?: NodeJS.Timeout;
  
  private constructor() {
    this.loadPendingEvents();
    this.setupNetworkListeners();
    this.startRetryTimer();
  }
  
  static getInstance(): AnalyticsReliabilityService {
    if (!AnalyticsReliabilityService.instance) {
      AnalyticsReliabilityService.instance = new AnalyticsReliabilityService();
    }
    return AnalyticsReliabilityService.instance;
  }
  
  private setupNetworkListeners(): void {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.processPendingEvents();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }
  
  private startRetryTimer(): void {
    this.retryTimer = setInterval(() => {
      if (this.isOnline && this.pendingEvents.length > 0) {
        this.processPendingEvents();
      }
    }, this.retryInterval);
  }
  
  queueEvent(event: string, properties: Record<string, any>): void {
    const analyticsEvent: AnalyticsEvent = {
      event,
      properties,
      timestamp: Date.now(),
      sessionId: this.getSessionId(),
      userId: this.getCurrentUserId(),
      userTier: this.getCurrentUserTier(),
      retryCount: 0,
      maxRetries: this.maxRetries
    };
    
    this.pendingEvents.push(analyticsEvent);
    this.savePendingEvents();
    
    // Try to send immediately if online
    if (this.isOnline) {
      this.processPendingEvents();
    }
  }
  
  private async processPendingEvents(): Promise<void> {
    const eventsToProcess = [...this.pendingEvents];
    
    for (const event of eventsToProcess) {
      try {
        await this.sendEvent(event);
        
        // Remove successfully sent event
        this.pendingEvents = this.pendingEvents.filter(e => e !== event);
        this.savePendingEvents();
        
      } catch (error) {
        event.retryCount++;
        
        // Remove events that have exceeded max retries
        if (event.retryCount >= event.maxRetries) {
          this.pendingEvents = this.pendingEvents.filter(e => e !== event);
          this.savePendingEvents();
          
          console.error(`Failed to send analytics event after ${event.maxRetries} retries:`, event);
        }
      }
    }
  }
  
  private async sendEvent(event: AnalyticsEvent): Promise<void> {
    // For now, we'll use a mock API endpoint
    // In production, this would be your actual analytics API
    const response = await fetch('/api/analytics', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event)
    });
    
    if (!response.ok) {
      throw new Error(`Analytics API returned ${response.status}`);
    }
  }
  
  private loadPendingEvents(): void {
    try {
      const stored = localStorage.getItem('pending_analytics_events');
      if (stored) {
        this.pendingEvents = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load pending analytics events:', error);
      this.pendingEvents = [];
    }
  }
  
  private savePendingEvents(): void {
    try {
      localStorage.setItem('pending_analytics_events', JSON.stringify(this.pendingEvents));
    } catch (error) {
      console.error('Failed to save pending analytics events:', error);
    }
  }
  
  private getSessionId(): string {
    return localStorage.getItem('session_id') || `session_${Date.now()}`;
  }
  
  private getCurrentUserId(): string | undefined {
    return localStorage.getItem('user_id') || undefined;
  }
  
  private getCurrentUserTier(): string {
    return localStorage.getItem('user_tier') || 'guest';
  }
  
  getPendingEventCount(): number {
    return this.pendingEvents.length;
  }
  
  clearPendingEvents(): void {
    this.pendingEvents = [];
    this.savePendingEvents();
  }
  
  // Cleanup method
  destroy(): void {
    if (this.retryTimer) {
      clearInterval(this.retryTimer);
    }
  }
} 