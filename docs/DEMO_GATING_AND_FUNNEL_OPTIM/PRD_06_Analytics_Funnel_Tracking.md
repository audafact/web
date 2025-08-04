# 📊 PRD 6: Analytics & Funnel Tracking

## 📋 Overview

**Scope:** Analytics schema and event emitter, funnel stage tracking (demo → signup → pro), local caching and offline sync

**Dependencies:** PRDs 1–5 (must emit events)  
**Parallelizable:** Yes  
**Estimated Timeline:** 1-2 weeks

---

## 🎯 Objectives

- Establish comprehensive analytics tracking system
- Monitor user journey through conversion funnel
- Enable data-driven optimization decisions
- Provide insights for feature and UX improvements

---

## 🏗️ Technical Requirements

### 6.1 Analytics Event Schema

#### Core Event Structure
```typescript
interface AnalyticsEvent {
  event: string;
  userId?: string;
  sessionId: string;
  timestamp: number;
  properties: Record<string, any>;
  userTier: 'guest' | 'free' | 'pro';
  version: string;
  platform: 'web' | 'mobile';
}

interface TrackingEvents {
  // Demo engagement
  'demo_track_loaded': { trackId: string; genre: string; bpm: number };
  'demo_mode_switched': { fromMode: string; toMode: string };
  'demo_cue_triggered': { cueIndex: number; trackId: string };
  'demo_next_track': { fromTrackId: string; toTrackId: string };
  'demo_session_started': { timestamp: number };
  'demo_session_ended': { duration: number; actions: string[] };
  
  // Feature gate interactions
  'feature_gate_clicked': { feature: string; userTier: string; gateType: string };
  'signup_modal_shown': { trigger: string; userTier: string };
  'signup_modal_dismissed': { trigger: string; userTier: string };
  
  // Conversion events
  'signup_completed': { method: 'email' | 'google'; trigger?: string; upgradeRequired: boolean };
  'upgrade_clicked': { feature: string; currentTier: string };
  'upgrade_completed': { plan: string; amount: number };
  
  // Library interactions
  'library_panel_opened': { userTier: string };
  'library_track_previewed': { trackId: string; genre: string; bpm: number; userTier: string };
  'library_track_added': { trackId: string; genre: string; userTier: string };
  'library_search_performed': { searchTerm: string; resultsCount: number; userTier: string };
  
  // Studio actions
  'track_uploaded': { fileName: string; fileSize: number; fileType: string; userTier: string };
  'session_saved': { sessionName?: string; userTier: string; isModified: boolean };
  'recording_started': { userTier: string };
  'recording_stopped': { userTier: string };
  'recording_downloaded': { fileName?: string; format: string; userTier: string };
  
  // Performance metrics
  'demo_load_time': { loadTime: number; userTier: string };
  'feature_gate_response_time': { feature: string; responseTime: number; userTier: string };
  'signup_flow_completion_time': { duration: number; method: string };
  
  // Error tracking
  'error_occurred': { error: string; context: string; userTier: string };
  'feature_error': { feature: string; error: string; userTier: string };
}
```

### 6.2 Analytics Service Implementation

#### Core Analytics Service
```typescript
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
      userTier: this.userTier,
      version: process.env.REACT_APP_VERSION || '1.0.0',
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
  }
  
  private async sendEvent(eventData: AnalyticsEvent) {
    try {
      const response = await fetch('/api/analytics', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify(eventData)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      // Remove from retry queue if it was there
      this.removeFromRetryQueue(eventData);
      
    } catch (error) {
      console.error('Analytics error:', error);
      this.storeForRetry(eventData);
    }
  }
  
  private storeForRetry(eventData: AnalyticsEvent) {
    this.retryQueue.push(eventData);
    this.saveRetryQueue();
  }
  
  private removeFromRetryQueue(eventData: AnalyticsEvent) {
    this.retryQueue = this.retryQueue.filter(event => 
      event.timestamp !== eventData.timestamp || 
      event.event !== eventData.event
    );
    this.saveRetryQueue();
  }
  
  private saveRetryQueue() {
    try {
      localStorage.setItem('analytics_retry_queue', JSON.stringify(this.retryQueue));
    } catch (error) {
      console.error('Failed to save retry queue:', error);
    }
  }
  
  private loadRetryQueue() {
    try {
      const stored = localStorage.getItem('analytics_retry_queue');
      if (stored) {
        this.retryQueue = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load retry queue:', error);
    }
  }
  
  private async processRetryQueue() {
    if (this.retryQueue.length === 0) return;
    
    const eventsToRetry = [...this.retryQueue];
    this.retryQueue = [];
    
    for (const event of eventsToRetry) {
      await this.sendEvent(event);
    }
  }
  
  private getAuthToken(): string | null {
    // Get auth token from your auth system
    return localStorage.getItem('auth_token');
  }
  
  setUser(userId: string, userTier: string) {
    this.userId = userId;
    this.userTier = userTier;
  }
  
  getSessionId(): string {
    return this.sessionId;
  }
  
  getEvents(): AnalyticsEvent[] {
    return [...this.events];
  }
  
  getRetryQueueLength(): number {
    return this.retryQueue.length;
  }
}
```

### 6.3 Funnel Tracking Implementation

#### Funnel Stage Definition
```typescript
interface FunnelStage {
  name: string;
  event: string;
  filters?: Record<string, any>;
  required?: boolean;
}

const FUNNEL_STAGES: FunnelStage[] = [
  { name: 'Demo Started', event: 'demo_track_loaded', required: true },
  { name: 'Feature Interaction', event: 'demo_mode_switched' },
  { name: 'Gate Clicked', event: 'feature_gate_clicked', required: true },
  { name: 'Signup Modal Shown', event: 'signup_modal_shown', required: true },
  { name: 'Signup Completed', event: 'signup_completed', required: true },
  { name: 'Upgrade Clicked', event: 'upgrade_clicked' },
  { name: 'Upgrade Completed', event: 'upgrade_completed', required: true }
];

class FunnelTracker {
  private static instance: FunnelTracker;
  private userProgress: Map<string, Set<string>> = new Map();
  private analytics: AnalyticsService;
  
  private constructor() {
    this.analytics = AnalyticsService.getInstance();
  }
  
  static getInstance(): FunnelTracker {
    if (!FunnelTracker.instance) {
      FunnelTracker.instance = new FunnelTracker();
    }
    return FunnelTracker.instance;
  }
  
  trackFunnelProgress(stage: string, properties: any) {
    const stageIndex = FUNNEL_STAGES.findIndex(s => s.name === stage);
    const userId = this.analytics.userId || 'anonymous';
    
    // Track user progress
    if (!this.userProgress.has(userId)) {
      this.userProgress.set(userId, new Set());
    }
    
    this.userProgress.get(userId)!.add(stage);
    
    // Track funnel progress event
    this.analytics.track('funnel_progress', {
      stage,
      stageIndex,
      properties,
      previousStages: FUNNEL_STAGES.slice(0, stageIndex).map(s => s.name),
      completedStages: Array.from(this.userProgress.get(userId) || [])
    });
    
    // Check if user completed the funnel
    this.checkFunnelCompletion(userId, stage);
  }
  
  private checkFunnelCompletion(userId: string, currentStage: string) {
    const userStages = this.userProgress.get(userId);
    if (!userStages) return;
    
    const requiredStages = FUNNEL_STAGES
      .filter(stage => stage.required)
      .map(stage => stage.name);
    
    const hasCompletedRequired = requiredStages.every(stage => 
      userStages.has(stage)
    );
    
    if (hasCompletedRequired) {
      this.analytics.track('funnel_completed', {
        userId,
        completedStages: Array.from(userStages),
        completionTime: this.calculateFunnelTime(userId)
      });
    }
  }
  
  private calculateFunnelTime(userId: string): number {
    // Implementation would track timestamps for each stage
    // and calculate total time from first to last stage
    return 0; // Placeholder
  }
  
  getFunnelConversionRate(): Record<string, number> {
    const rates: Record<string, number> = {};
    const totalUsers = this.userProgress.size;
    
    FUNNEL_STAGES.forEach((stage, index) => {
      const usersAtStage = Array.from(this.userProgress.values())
        .filter(stages => stages.has(stage.name)).length;
      
      rates[stage.name] = totalUsers > 0 ? (usersAtStage / totalUsers) * 100 : 0;
    });
    
    return rates;
  }
}
```

### 6.4 Event Tracking Hooks

#### Analytics Hook
```typescript
const useAnalytics = () => {
  const analytics = AnalyticsService.getInstance();
  const funnelTracker = FunnelTracker.getInstance();
  
  const trackEvent = useCallback(<K extends keyof TrackingEvents>(
    event: K, 
    properties: TrackingEvents[K]
  ) => {
    analytics.track(event, properties);
  }, [analytics]);
  
  const trackFunnelProgress = useCallback((stage: string, properties: any) => {
    funnelTracker.trackFunnelProgress(stage, properties);
  }, [funnelTracker]);
  
  const trackError = useCallback((error: string, context: string) => {
    analytics.track('error_occurred', {
      error,
      context,
      userTier: getCurrentUserTier()
    });
  }, [analytics]);
  
  return {
    trackEvent,
    trackFunnelProgress,
    trackError,
    getSessionId: () => analytics.getSessionId(),
    getRetryQueueLength: () => analytics.getRetryQueueLength()
  };
};
```

---

## 🎨 UI/UX Requirements

### Analytics Dashboard Components

```typescript
interface AnalyticsDashboardProps {
  isOpen: boolean;
  onClose: () => void;
}

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  isOpen,
  onClose
}) => {
  const [funnelData, setFunnelData] = useState<Record<string, number>>({});
  const [conversionRates, setConversionRates] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(false);
  
  useEffect(() => {
    if (isOpen) {
      loadAnalyticsData();
    }
  }, [isOpen]);
  
  const loadAnalyticsData = async () => {
    setIsLoading(true);
    try {
      // Load funnel data
      const funnelTracker = FunnelTracker.getInstance();
      const rates = funnelTracker.getFunnelConversionRate();
      setConversionRates(rates);
      
      // Load other analytics data
      // Implementation would fetch from analytics API
      
    } catch (error) {
      console.error('Failed to load analytics data:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="analytics-dashboard">
        <div className="dashboard-header">
          <h2>📊 Analytics Dashboard</h2>
          <button onClick={onClose} className="close-button">✕</button>
        </div>
        
        {isLoading ? (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Loading analytics data...</p>
          </div>
        ) : (
          <div className="dashboard-content">
            <div className="funnel-section">
              <h3>Conversion Funnel</h3>
              <div className="funnel-chart">
                {FUNNEL_STAGES.map((stage, index) => (
                  <div key={stage.name} className="funnel-stage">
                    <div className="stage-name">{stage.name}</div>
                    <div className="stage-rate">
                      {conversionRates[stage.name]?.toFixed(1)}%
                    </div>
                    {index < FUNNEL_STAGES.length - 1 && (
                      <div className="funnel-arrow">↓</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            
            <div className="metrics-section">
              <h3>Key Metrics</h3>
              <div className="metrics-grid">
                <div className="metric-card">
                  <div className="metric-value">15.2%</div>
                  <div className="metric-label">Demo to Signup</div>
                </div>
                <div className="metric-card">
                  <div className="metric-value">8.7%</div>
                  <div className="metric-label">Signup to Pro</div>
                </div>
                <div className="metric-card">
                  <div className="metric-value">3.2min</div>
                  <div className="metric-label">Avg Demo Session</div>
                </div>
                <div className="metric-card">
                  <div className="metric-value">32.1%</div>
                  <div className="metric-label">Feature Gate CTR</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
```

### Analytics Dashboard Styling

```css
/* Analytics dashboard */
.analytics-dashboard {
  background: white;
  border-radius: 12px;
  padding: 24px;
  max-width: 800px;
  width: 90vw;
  max-height: 80vh;
  overflow-y: auto;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid #e5e7eb;
}

.dashboard-header h2 {
  margin: 0;
  font-size: 20px;
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

/* Funnel chart */
.funnel-section {
  margin-bottom: 32px;
}

.funnel-section h3 {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
  color: #374151;
}

.funnel-chart {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.funnel-stage {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #f9fafb;
  border-radius: 8px;
  border-left: 4px solid #3b82f6;
}

.stage-name {
  flex: 1;
  font-size: 14px;
  font-weight: 500;
  color: #374151;
}

.stage-rate {
  font-size: 16px;
  font-weight: 600;
  color: #3b82f6;
  min-width: 60px;
  text-align: right;
}

.funnel-arrow {
  color: #9ca3af;
  font-size: 16px;
  margin: 0 8px;
}

/* Metrics grid */
.metrics-section h3 {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
  color: #374151;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 16px;
}

.metric-card {
  background: #f9fafb;
  border-radius: 8px;
  padding: 16px;
  text-align: center;
  border: 1px solid #e5e7eb;
}

.metric-value {
  font-size: 24px;
  font-weight: 700;
  color: #1f2937;
  margin-bottom: 4px;
}

.metric-label {
  font-size: 12px;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Loading state */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: #6b7280;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #e5e7eb;
  border-top: 3px solid #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
```

---

## 🔧 Implementation Details

### Performance Monitoring

```typescript
class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Map<string, number[]> = new Map();
  
  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }
  
  trackMetric(name: string, value: number) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    
    this.metrics.get(name)!.push(value);
    
    // Keep only last 100 values
    if (this.metrics.get(name)!.length > 100) {
      this.metrics.set(name, this.metrics.get(name)!.slice(-100));
    }
    
    // Send to analytics
    AnalyticsService.getInstance().track('performance_metric', {
      metric: name,
      value,
      userTier: getCurrentUserTier()
    });
  }
  
  getAverageMetric(name: string): number {
    const values = this.metrics.get(name);
    if (!values || values.length === 0) return 0;
    
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }
  
  trackPageLoadTime() {
    const startTime = performance.now();
    
    window.addEventListener('load', () => {
      const loadTime = performance.now() - startTime;
      this.trackMetric('page_load_time', loadTime);
    });
  }
  
  trackFeatureResponseTime(feature: string) {
    const startTime = performance.now();
    
    return () => {
      const responseTime = performance.now() - startTime;
      this.trackMetric(`${feature}_response_time`, responseTime);
    };
  }
}
```

### Error Tracking

```typescript
class ErrorTracker {
  private static instance: ErrorTracker;
  private analytics: AnalyticsService;
  
  private constructor() {
    this.analytics = AnalyticsService.getInstance();
    this.setupGlobalErrorHandling();
  }
  
  static getInstance(): ErrorTracker {
    if (!ErrorTracker.instance) {
      ErrorTracker.instance = new ErrorTracker();
    }
    return ErrorTracker.instance;
  }
  
  private setupGlobalErrorHandling() {
    window.addEventListener('error', (event) => {
      this.trackError(event.error, 'global_error');
    });
    
    window.addEventListener('unhandledrejection', (event) => {
      this.trackError(new Error(event.reason), 'unhandled_promise');
    });
  }
  
  trackError(error: Error, context: string) {
    this.analytics.track('error_occurred', {
      error: error.message,
      stack: error.stack,
      context,
      userTier: getCurrentUserTier(),
      url: window.location.href,
      userAgent: navigator.userAgent
    });
  }
  
  trackFeatureError(feature: string, error: Error) {
    this.analytics.track('feature_error', {
      feature,
      error: error.message,
      userTier: getCurrentUserTier()
    });
  }
}
```

---

## 🧪 Testing Requirements

### Unit Tests
```typescript
describe('Analytics & Funnel Tracking', () => {
  describe('AnalyticsService', () => {
    beforeEach(() => {
      // Clear localStorage
      localStorage.clear();
      // Reset singleton
      (AnalyticsService as any).instance = null;
    });
    
    it('should track events correctly', () => {
      const analytics = AnalyticsService.getInstance();
      const mockFetch = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true
      } as Response);
      
      analytics.track('demo_track_loaded', {
        trackId: 'test-track',
        genre: 'house',
        bpm: 128
      });
      
      expect(mockFetch).toHaveBeenCalledWith('/api/analytics', expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('demo_track_loaded')
      }));
    });
    
    it('should store events for retry when offline', () => {
      const analytics = AnalyticsService.getInstance();
      
      // Mock offline state
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false
      });
      
      analytics.track('demo_track_loaded', {
        trackId: 'test-track',
        genre: 'house',
        bpm: 128
      });
      
      expect(analytics.getRetryQueueLength()).toBe(1);
    });
  });
  
  describe('FunnelTracker', () => {
    beforeEach(() => {
      (FunnelTracker as any).instance = null;
    });
    
    it('should track funnel progress', () => {
      const funnelTracker = FunnelTracker.getInstance();
      const analytics = AnalyticsService.getInstance();
      
      const mockTrack = jest.spyOn(analytics, 'track');
      
      funnelTracker.trackFunnelProgress('Demo Started', {
        trackId: 'test-track'
      });
      
      expect(mockTrack).toHaveBeenCalledWith('funnel_progress', expect.objectContaining({
        stage: 'Demo Started'
      }));
    });
    
    it('should calculate conversion rates', () => {
      const funnelTracker = FunnelTracker.getInstance();
      
      // Mock user progress
      const mockProgress = new Map();
      mockProgress.set('user1', new Set(['Demo Started', 'Feature Interaction']));
      mockProgress.set('user2', new Set(['Demo Started']));
      
      (funnelTracker as any).userProgress = mockProgress;
      
      const rates = funnelTracker.getFunnelConversionRate();
      
      expect(rates['Demo Started']).toBe(100);
      expect(rates['Feature Interaction']).toBe(50);
    });
  });
});
```

---

## 📊 Analytics Events

### Core Analytics Events
```typescript
interface CoreAnalyticsEvents {
  'funnel_progress': { stage: string; stageIndex: number; properties: any; previousStages: string[]; completedStages: string[] };
  'funnel_completed': { userId: string; completedStages: string[]; completionTime: number };
  'performance_metric': { metric: string; value: number; userTier: string };
  'error_occurred': { error: string; stack?: string; context: string; userTier: string; url: string; userAgent: string };
  'feature_error': { feature: string; error: string; userTier: string };
}
```

---

## 🚀 Success Criteria

- [ ] Analytics events are tracked for all user interactions
- [ ] Funnel progression is monitored accurately
- [ ] Offline event caching and retry mechanism works
- [ ] Performance metrics are collected and reported
- [ ] Error tracking captures all application errors
- [ ] Analytics dashboard displays key metrics
- [ ] Conversion rates are calculated correctly
- [ ] Data is sent to analytics backend reliably
- [ ] Session tracking works across page reloads
- [ ] User privacy is maintained in analytics data

---

## 🔄 Dependencies & Integration

### Input Dependencies
- PRDs 1–5 (must emit events)

### Output Dependencies
- PRD 7: A/B Testing & Feature Flags (for experiment tracking)
- PRD 10: Performance & Error Monitoring (for metrics collection)

### Integration Points
- All feature components for event emission
- Authentication system for user identification
- Backend analytics API for data collection
- Performance monitoring for metrics
- Error handling system for error tracking
- Local storage for offline caching
- Network status detection for retry logic 