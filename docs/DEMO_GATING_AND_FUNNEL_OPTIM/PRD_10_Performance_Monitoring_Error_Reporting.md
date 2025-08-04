# 📊 PRD 10: Performance, Monitoring & Error Reporting

## 📋 Overview

**Scope:** Performance metrics, global error tracking with context, analytics hooks and retry storage

**Dependencies:** PRD 6 (analytics integration), PRD 1 (session start)  
**Parallelizable:** Yes  
**Estimated Timeline:** 1 week

---

## 🎯 Objectives

- Monitor application performance and user experience metrics
- Capture and report errors with full context for debugging
- Ensure analytics data reliability with offline storage and retry logic
- Provide real-time insights into demo and gating funnel performance

---

## 🏗️ Technical Requirements

### 10.1 Performance Monitoring System

#### Performance Metrics Schema
```typescript
interface PerformanceMetrics {
  // Load time metrics
  demoLoadTime: number;
  featureGateResponseTime: number;
  signupFlowCompletionTime: number;
  audioLoadTime: number;
  
  // Session metrics
  sessionDuration: number;
  featureUsage: Record<string, number>;
  interactionLatency: Record<string, number>;
  
  // Resource metrics
  memoryUsage: number;
  cpuUsage: number;
  networkRequests: number;
  
  // User experience metrics
  timeToInteractive: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  
  // Custom metrics
  customMetrics: Record<string, number>;
}

interface PerformanceEvent {
  metric: string;
  value: number;
  timestamp: number;
  sessionId: string;
  userId?: string;
  userTier: string;
  context: Record<string, any>;
}
```

#### Performance Monitor Service
```typescript
class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Map<string, PerformanceMetrics> = new Map();
  private observers: Map<string, PerformanceObserver> = new Map();
  private analytics: AnalyticsService;
  
  private constructor() {
    this.analytics = AnalyticsService.getInstance();
    this.initializeObservers();
  }
  
  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }
  
  private initializeObservers(): void {
    // Navigation timing
    if ('PerformanceObserver' in window) {
      const navigationObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'navigation') {
            this.handleNavigationTiming(entry as PerformanceNavigationTiming);
          }
        }
      });
      navigationObserver.observe({ entryTypes: ['navigation'] });
      this.observers.set('navigation', navigationObserver);
    }
    
    // Paint timing
    if ('PerformanceObserver' in window) {
      const paintObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'paint') {
            this.handlePaintTiming(entry as PerformancePaintTiming);
          }
        }
      });
      paintObserver.observe({ entryTypes: ['paint'] });
      this.observers.set('paint', paintObserver);
    }
    
    // Resource timing
    if ('PerformanceObserver' in window) {
      const resourceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'resource') {
            this.handleResourceTiming(entry as PerformanceResourceTiming);
          }
        }
      });
      resourceObserver.observe({ entryTypes: ['resource'] });
      this.observers.set('resource', resourceObserver);
    }
  }
  
  private handleNavigationTiming(entry: PerformanceNavigationTiming): void {
    const metrics = {
      demoLoadTime: entry.loadEventEnd - entry.loadEventStart,
      timeToInteractive: entry.domInteractive - entry.fetchStart,
      firstContentfulPaint: entry.domContentLoadedEventEnd - entry.fetchStart
    };
    
    this.trackMetrics('navigation', metrics);
  }
  
  private handlePaintTiming(entry: PerformancePaintTiming): void {
    if (entry.name === 'first-paint') {
      this.trackMetric('firstPaint', entry.startTime);
    } else if (entry.name === 'first-contentful-paint') {
      this.trackMetric('firstContentfulPaint', entry.startTime);
    }
  }
  
  private handleResourceTiming(entry: PerformanceResourceTiming): void {
    if (entry.name.includes('.wav') || entry.name.includes('.mp3')) {
      this.trackMetric('audioLoadTime', entry.duration);
    }
  }
  
  trackMetric(metric: string, value: number, context: Record<string, any> = {}): void {
    const event: PerformanceEvent = {
      metric,
      value,
      timestamp: Date.now(),
      sessionId: this.analytics.getSessionId(),
      userId: this.getCurrentUserId(),
      userTier: this.getCurrentUserTier(),
      context
    };
    
    // Store locally
    this.storeMetric(event);
    
    // Send to analytics
    this.analytics.track('performance_metric', event);
  }
  
  trackMetrics(category: string, metrics: Record<string, number>, context: Record<string, any> = {}): void {
    Object.entries(metrics).forEach(([metric, value]) => {
      this.trackMetric(`${category}_${metric}`, value, context);
    });
  }
  
  startTimer(metric: string): () => void {
    const startTime = performance.now();
    return () => {
      const duration = performance.now() - startTime;
      this.trackMetric(metric, duration);
    };
  }
  
  private storeMetric(event: PerformanceEvent): void {
    try {
      const stored = JSON.parse(localStorage.getItem('performance_metrics') || '[]');
      stored.push(event);
      
      // Keep only last 100 metrics
      if (stored.length > 100) {
        stored.splice(0, stored.length - 100);
      }
      
      localStorage.setItem('performance_metrics', JSON.stringify(stored));
    } catch (error) {
      console.error('Failed to store performance metric:', error);
    }
  }
  
  private getCurrentUserId(): string | undefined {
    return localStorage.getItem('user_id') || undefined;
  }
  
  private getCurrentUserTier(): string {
    return localStorage.getItem('user_tier') || 'guest';
  }
  
  getMetrics(): PerformanceEvent[] {
    try {
      return JSON.parse(localStorage.getItem('performance_metrics') || '[]');
    } catch (error) {
      console.error('Failed to get performance metrics:', error);
      return [];
    }
  }
  
  clearMetrics(): void {
    try {
      localStorage.removeItem('performance_metrics');
    } catch (error) {
      console.error('Failed to clear performance metrics:', error);
    }
  }
}
```

### 10.2 Error Monitoring System

#### Error Context Schema
```typescript
interface ErrorContext {
  // User context
  userId?: string;
  userTier: string;
  sessionId: string;
  
  // Application context
  currentRoute: string;
  componentStack: string;
  featureGates: string[];
  
  // Browser context
  userAgent: string;
  screenSize: string;
  viewportSize: string;
  
  // Performance context
  memoryUsage?: number;
  networkStatus: string;
  
  // Custom context
  customContext: Record<string, any>;
}

interface ErrorEvent {
  id: string;
  message: string;
  stack: string;
  type: 'error' | 'unhandledrejection' | 'custom';
  timestamp: number;
  context: ErrorContext;
  severity: 'low' | 'medium' | 'high' | 'critical';
  fingerprint: string;
}
```

#### Error Monitor Service
```typescript
class ErrorMonitor {
  private static instance: ErrorMonitor;
  private errors: ErrorEvent[] = [];
  private analytics: AnalyticsService;
  private maxErrors = 50;
  
  private constructor() {
    this.analytics = AnalyticsService.getInstance();
    this.setupGlobalHandlers();
  }
  
  static getInstance(): ErrorMonitor {
    if (!ErrorMonitor.instance) {
      ErrorMonitor.instance = new ErrorMonitor();
    }
    return ErrorMonitor.instance;
  }
  
  private setupGlobalHandlers(): void {
    // Global error handler
    window.addEventListener('error', (event) => {
      this.captureError(event.error, 'global', {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
    });
    
    // Unhandled promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
      this.captureError(new Error(event.reason), 'unhandled_promise', {
        promise: event.promise
      });
    });
    
    // React error boundary fallback
    if (typeof window !== 'undefined') {
      (window as any).__REACT_ERROR_BOUNDARY__ = (error: Error, errorInfo: any) => {
        this.captureError(error, 'react_boundary', {
          componentStack: errorInfo.componentStack
        });
      };
    }
  }
  
  captureError(
    error: Error, 
    context: string, 
    additionalContext: Record<string, any> = {}
  ): void {
    const errorEvent: ErrorEvent = {
      id: this.generateErrorId(),
      message: error.message,
      stack: error.stack || '',
      type: 'error',
      timestamp: Date.now(),
      context: this.buildErrorContext(context, additionalContext),
      severity: this.determineSeverity(error, context),
      fingerprint: this.generateFingerprint(error, context)
    };
    
    // Store error locally
    this.storeError(errorEvent);
    
    // Send to analytics
    this.analytics.track('error_captured', errorEvent);
    
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error captured:', errorEvent);
    }
  }
  
  captureCustomError(
    message: string,
    context: string,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
    additionalContext: Record<string, any> = {}
  ): void {
    const errorEvent: ErrorEvent = {
      id: this.generateErrorId(),
      message,
      stack: new Error().stack || '',
      type: 'custom',
      timestamp: Date.now(),
      context: this.buildErrorContext(context, additionalContext),
      severity,
      fingerprint: this.generateFingerprint(new Error(message), context)
    };
    
    this.storeError(errorEvent);
    this.analytics.track('custom_error', errorEvent);
  }
  
  private buildErrorContext(
    context: string, 
    additionalContext: Record<string, any>
  ): ErrorContext {
    return {
      userId: this.getCurrentUserId(),
      userTier: this.getCurrentUserTier(),
      sessionId: this.analytics.getSessionId(),
      currentRoute: window.location.pathname,
      componentStack: additionalContext.componentStack || '',
      featureGates: this.getActiveFeatureGates(),
      userAgent: navigator.userAgent,
      screenSize: `${screen.width}x${screen.height}`,
      viewportSize: `${window.innerWidth}x${window.innerHeight}`,
      memoryUsage: (performance as any).memory?.usedJSHeapSize,
      networkStatus: navigator.onLine ? 'online' : 'offline',
      customContext: additionalContext
    };
  }
  
  private determineSeverity(error: Error, context: string): 'low' | 'medium' | 'high' | 'critical' {
    // Critical errors
    if (error.message.includes('Failed to fetch') || 
        error.message.includes('NetworkError') ||
        error.message.includes('QuotaExceededError')) {
      return 'critical';
    }
    
    // High severity errors
    if (error.message.includes('AudioContext') ||
        error.message.includes('WebAudio') ||
        context === 'react_boundary') {
      return 'high';
    }
    
    // Medium severity errors
    if (error.message.includes('localStorage') ||
        error.message.includes('IndexedDB')) {
      return 'medium';
    }
    
    return 'low';
  }
  
  private generateFingerprint(error: Error, context: string): string {
    const fingerprint = `${error.message}:${context}:${this.getCurrentUserTier()}`;
    return this.hashString(fingerprint);
  }
  
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }
  
  private generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private storeError(error: ErrorEvent): void {
    this.errors.push(error);
    
    // Keep only the most recent errors
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(-this.maxErrors);
    }
    
    // Store in localStorage
    try {
      localStorage.setItem('error_log', JSON.stringify(this.errors));
    } catch (error) {
      console.error('Failed to store error in localStorage:', error);
    }
  }
  
  private getCurrentUserId(): string | undefined {
    return localStorage.getItem('user_id') || undefined;
  }
  
  private getCurrentUserTier(): string {
    return localStorage.getItem('user_tier') || 'guest';
  }
  
  private getActiveFeatureGates(): string[] {
    try {
      const gates = JSON.parse(localStorage.getItem('active_feature_gates') || '[]');
      return gates;
    } catch (error) {
      return [];
    }
  }
  
  getErrors(): ErrorEvent[] {
    return [...this.errors];
  }
  
  clearErrors(): void {
    this.errors = [];
    try {
      localStorage.removeItem('error_log');
    } catch (error) {
      console.error('Failed to clear errors:', error);
    }
  }
  
  getErrorRate(): number {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    const recentErrors = this.errors.filter(error => 
      now - error.timestamp < oneHour
    );
    return recentErrors.length;
  }
}
```

### 10.3 Analytics Reliability System

#### Offline Storage and Retry Logic
```typescript
interface AnalyticsEvent {
  event: string;
  properties: Record<string, any>;
  timestamp: number;
  sessionId: string;
  userId?: string;
  userTier: string;
  retryCount: number;
  maxRetries: number;
}

class AnalyticsReliabilityService {
  private static instance: AnalyticsReliabilityService;
  private pendingEvents: AnalyticsEvent[] = [];
  private isOnline: boolean = navigator.onLine;
  private retryInterval: number = 5000; // 5 seconds
  private maxRetries: number = 3;
  
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
    setInterval(() => {
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
}
```

### 10.4 Enhanced Analytics Service

#### Analytics Service with Reliability
```typescript
class EnhancedAnalyticsService {
  private static instance: EnhancedAnalyticsService;
  private reliabilityService: AnalyticsReliabilityService;
  private performanceMonitor: PerformanceMonitor;
  private errorMonitor: ErrorMonitor;
  
  private constructor() {
    this.reliabilityService = AnalyticsReliabilityService.getInstance();
    this.performanceMonitor = PerformanceMonitor.getInstance();
    this.errorMonitor = ErrorMonitor.getInstance();
  }
  
  static getInstance(): EnhancedAnalyticsService {
    if (!EnhancedAnalyticsService.instance) {
      EnhancedAnalyticsService.instance = new EnhancedAnalyticsService();
    }
    return EnhancedAnalyticsService.instance;
  }
  
  track(event: string, properties: Record<string, any> = {}): void {
    // Add common properties
    const enhancedProperties = {
      ...properties,
      timestamp: Date.now(),
      sessionId: this.getSessionId(),
      userId: this.getCurrentUserId(),
      userTier: this.getCurrentUserTier(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      screenSize: `${screen.width}x${screen.height}`,
      viewportSize: `${window.innerWidth}x${window.innerHeight}`,
      networkStatus: navigator.onLine ? 'online' : 'offline'
    };
    
    // Queue event for reliable delivery
    this.reliabilityService.queueEvent(event, enhancedProperties);
    
    // Track performance impact
    this.performanceMonitor.trackMetric('analytics_event_sent', 1, { event });
  }
  
  trackPerformance(metric: string, value: number, context: Record<string, any> = {}): void {
    this.performanceMonitor.trackMetric(metric, value, context);
  }
  
  trackError(error: Error, context: string, additionalContext: Record<string, any> = {}): void {
    this.errorMonitor.captureError(error, context, additionalContext);
  }
  
  trackCustomError(message: string, context: string, severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'): void {
    this.errorMonitor.captureCustomError(message, context, severity);
  }
  
  getSessionId(): string {
    return localStorage.getItem('session_id') || `session_${Date.now()}`;
  }
  
  private getCurrentUserId(): string | undefined {
    return localStorage.getItem('user_id') || undefined;
  }
  
  private getCurrentUserTier(): string {
    return localStorage.getItem('user_tier') || 'guest';
  }
  
  // Health check methods
  getHealthStatus(): {
    pendingEvents: number;
    errorRate: number;
    isOnline: boolean;
    lastError?: ErrorEvent;
  } {
    return {
      pendingEvents: this.reliabilityService.getPendingEventCount(),
      errorRate: this.errorMonitor.getErrorRate(),
      isOnline: navigator.onLine,
      lastError: this.errorMonitor.getErrors()[this.errorMonitor.getErrors().length - 1]
    };
  }
}
```

---

## 🎨 UI/UX Requirements

### Performance Dashboard Component

#### Performance Dashboard
```typescript
interface PerformanceDashboardProps {
  isVisible: boolean;
  onClose: () => void;
}

const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({
  isVisible,
  onClose
}) => {
  const [metrics, setMetrics] = useState<PerformanceEvent[]>([]);
  const [errors, setErrors] = useState<ErrorEvent[]>([]);
  const [healthStatus, setHealthStatus] = useState<any>(null);
  
  useEffect(() => {
    if (isVisible) {
      const performanceMonitor = PerformanceMonitor.getInstance();
      const errorMonitor = ErrorMonitor.getInstance();
      const analytics = EnhancedAnalyticsService.getInstance();
      
      setMetrics(performanceMonitor.getMetrics());
      setErrors(errorMonitor.getErrors());
      setHealthStatus(analytics.getHealthStatus());
    }
  }, [isVisible]);
  
  const getAverageMetric = (metricName: string): number => {
    const relevantMetrics = metrics.filter(m => m.metric.includes(metricName));
    if (relevantMetrics.length === 0) return 0;
    
    const sum = relevantMetrics.reduce((acc, m) => acc + m.value, 0);
    return sum / relevantMetrics.length;
  };
  
  return (
    <Modal isOpen={isVisible} onClose={onClose}>
      <div className="performance-dashboard">
        <div className="dashboard-header">
          <h2>Performance & Error Dashboard</h2>
          <button onClick={onClose} className="close-button">✕</button>
        </div>
        
        <div className="dashboard-content">
          {/* Health Status */}
          <div className="health-status">
            <h3>System Health</h3>
            <div className="health-grid">
              <div className="health-item">
                <span className="label">Online Status</span>
                <span className={`value ${healthStatus?.isOnline ? 'online' : 'offline'}`}>
                  {healthStatus?.isOnline ? '🟢 Online' : '🔴 Offline'}
                </span>
              </div>
              <div className="health-item">
                <span className="label">Pending Events</span>
                <span className="value">{healthStatus?.pendingEvents || 0}</span>
              </div>
              <div className="health-item">
                <span className="label">Error Rate (1h)</span>
                <span className="value">{healthStatus?.errorRate || 0}</span>
              </div>
            </div>
          </div>
          
          {/* Performance Metrics */}
          <div className="performance-metrics">
            <h3>Performance Metrics</h3>
            <div className="metrics-grid">
              <div className="metric-item">
                <span className="label">Demo Load Time</span>
                <span className="value">{getAverageMetric('demoLoadTime').toFixed(2)}ms</span>
              </div>
              <div className="metric-item">
                <span className="label">Feature Gate Response</span>
                <span className="value">{getAverageMetric('featureGateResponseTime').toFixed(2)}ms</span>
              </div>
              <div className="metric-item">
                <span className="label">Audio Load Time</span>
                <span className="value">{getAverageMetric('audioLoadTime').toFixed(2)}ms</span>
              </div>
              <div className="metric-item">
                <span className="label">Time to Interactive</span>
                <span className="value">{getAverageMetric('timeToInteractive').toFixed(2)}ms</span>
              </div>
            </div>
          </div>
          
          {/* Recent Errors */}
          <div className="recent-errors">
            <h3>Recent Errors</h3>
            <div className="errors-list">
              {errors.slice(-5).map(error => (
                <div key={error.id} className="error-item">
                  <div className="error-header">
                    <span className={`severity ${error.severity}`}>{error.severity}</span>
                    <span className="timestamp">
                      {new Date(error.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="error-message">{error.message}</div>
                  <div className="error-context">{error.context.currentRoute}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
```

### Dashboard Styling
```css
.performance-dashboard {
  background: white;
  border-radius: 12px;
  padding: 24px;
  max-width: 800px;
  width: 90vw;
  max-height: 90vh;
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

.dashboard-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.health-status,
.performance-metrics,
.recent-errors {
  background: #f9fafb;
  border-radius: 8px;
  padding: 16px;
}

.health-status h3,
.performance-metrics h3,
.recent-errors h3 {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
  color: #374151;
}

.health-grid,
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.health-item,
.metric-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: white;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
}

.health-item .label,
.metric-item .label {
  font-size: 14px;
  color: #6b7280;
}

.health-item .value,
.metric-item .value {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}

.value.online {
  color: #059669;
}

.value.offline {
  color: #dc2626;
}

.errors-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.error-item {
  background: white;
  border-radius: 6px;
  padding: 12px;
  border: 1px solid #e5e7eb;
}

.error-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.severity {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
}

.severity.critical {
  background: #fef2f2;
  color: #dc2626;
}

.severity.high {
  background: #fff7ed;
  color: #ea580c;
}

.severity.medium {
  background: #fffbeb;
  color: #d97706;
}

.severity.low {
  background: #f0fdf4;
  color: #059669;
}

.timestamp {
  font-size: 12px;
  color: #6b7280;
}

.error-message {
  font-size: 14px;
  color: #374151;
  margin-bottom: 4px;
  font-weight: 500;
}

.error-context {
  font-size: 12px;
  color: #9ca3af;
}
```

---

## 🔧 Implementation Details

### Integration with Existing Services

#### Enhanced Studio Component with Monitoring
```typescript
const MonitoredStudio: React.FC = () => {
  const performanceMonitor = PerformanceMonitor.getInstance();
  const errorMonitor = ErrorMonitor.getInstance();
  const analytics = EnhancedAnalyticsService.getInstance();
  
  useEffect(() => {
    // Track demo load performance
    const stopTimer = performanceMonitor.startTimer('demo_load_time');
    
    return () => {
      stopTimer();
    };
  }, []);
  
  useEffect(() => {
    // Monitor for errors in audio context
    const handleAudioError = (error: Event) => {
      errorMonitor.captureError(
        new Error('Audio context error'),
        'audio_context',
        { originalError: error }
      );
    };
    
    const audioContext = getAudioContext();
    if (audioContext) {
      audioContext.addEventListener('error', handleAudioError);
      return () => audioContext.removeEventListener('error', handleAudioError);
    }
  }, []);
  
  const handleFeatureGateClick = (feature: string) => {
    const stopTimer = performanceMonitor.startTimer('feature_gate_response');
    
    // Existing gate logic
    showSignupModal(feature);
    
    // Track performance
    setTimeout(stopTimer, 100);
  };
  
  return (
    <div className="studio">
      {/* Existing studio content with monitoring hooks */}
    </div>
  );
};
```

#### Error Boundary Component
```typescript
interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: any;
}

class ErrorBoundary extends React.Component<
  React.PropsWithChildren<{}>,
  ErrorBoundaryState
> {
  constructor(props: React.PropsWithChildren<{}>) {
    super(props);
    this.state = { hasError: false };
  }
  
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }
  
  componentDidCatch(error: Error, errorInfo: any): void {
    const errorMonitor = ErrorMonitor.getInstance();
    errorMonitor.captureError(error, 'react_boundary', {
      componentStack: errorInfo.componentStack
    });
  }
  
  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h2>Something went wrong</h2>
          <p>We've been notified and are working to fix this issue.</p>
          <button onClick={() => window.location.reload()}>
            Reload Page
          </button>
        </div>
      );
    }
    
    return this.props.children;
  }
}
```

### Performance Hooks

#### Performance Tracking Hook
```typescript
const usePerformanceTracking = (metricName: string) => {
  const performanceMonitor = PerformanceMonitor.getInstance();
  
  const trackMetric = useCallback((value: number, context: Record<string, any> = {}) => {
    performanceMonitor.trackMetric(metricName, value, context);
  }, [metricName]);
  
  const startTimer = useCallback(() => {
    return performanceMonitor.startTimer(metricName);
  }, [metricName]);
  
  return { trackMetric, startTimer };
};
```

#### Error Tracking Hook
```typescript
const useErrorTracking = () => {
  const errorMonitor = ErrorMonitor.getInstance();
  
  const trackError = useCallback((
    error: Error, 
    context: string, 
    additionalContext: Record<string, any> = {}
  ) => {
    errorMonitor.captureError(error, context, additionalContext);
  }, []);
  
  const trackCustomError = useCallback((
    message: string,
    context: string,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ) => {
    errorMonitor.captureCustomError(message, context, severity);
  }, []);
  
  return { trackError, trackCustomError };
};
```

---

## 🧪 Testing Requirements

### Performance Monitoring Tests
```typescript
describe('Performance Monitoring', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  
  it('should track performance metrics', () => {
    const performanceMonitor = PerformanceMonitor.getInstance();
    
    performanceMonitor.trackMetric('test_metric', 100);
    
    const metrics = performanceMonitor.getMetrics();
    expect(metrics).toHaveLength(1);
    expect(metrics[0].metric).toBe('test_metric');
    expect(metrics[0].value).toBe(100);
  });
  
  it('should measure timing accurately', () => {
    const performanceMonitor = PerformanceMonitor.getInstance();
    
    const stopTimer = performanceMonitor.startTimer('test_timer');
    
    // Simulate some work
    setTimeout(() => {
      stopTimer();
    }, 100);
    
    // Wait for timer to complete
    setTimeout(() => {
      const metrics = performanceMonitor.getMetrics();
      const timerMetric = metrics.find(m => m.metric === 'test_timer');
      expect(timerMetric).toBeDefined();
      expect(timerMetric!.value).toBeGreaterThan(90);
    }, 200);
  });
});
```

### Error Monitoring Tests
```typescript
describe('Error Monitoring', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  
  it('should capture errors with context', () => {
    const errorMonitor = ErrorMonitor.getInstance();
    
    const error = new Error('Test error');
    errorMonitor.captureError(error, 'test_context', { custom: 'data' });
    
    const errors = errorMonitor.getErrors();
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toBe('Test error');
    expect(errors[0].context.customContext.custom).toBe('data');
  });
  
  it('should determine error severity correctly', () => {
    const errorMonitor = ErrorMonitor.getInstance();
    
    const networkError = new Error('Failed to fetch');
    errorMonitor.captureError(networkError, 'network');
    
    const errors = errorMonitor.getErrors();
    expect(errors[0].severity).toBe('critical');
  });
});
```

### Analytics Reliability Tests
```typescript
describe('Analytics Reliability', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  
  it('should queue events when offline', () => {
    const reliabilityService = AnalyticsReliabilityService.getInstance();
    
    // Mock offline state
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false
    });
    
    reliabilityService.queueEvent('test_event', { data: 'test' });
    
    expect(reliabilityService.getPendingEventCount()).toBe(1);
  });
  
  it('should retry failed events', async () => {
    const reliabilityService = AnalyticsReliabilityService.getInstance();
    
    // Mock fetch to fail
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
    
    reliabilityService.queueEvent('test_event', { data: 'test' });
    
    // Wait for retry
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(global.fetch).toHaveBeenCalled();
  });
});
```

---

## 📊 Analytics Events

### Performance Events
```typescript
interface PerformanceEvents {
  'performance_metric': PerformanceEvent;
  'demo_load_time': { loadTime: number; userTier: string; sessionId: string };
  'feature_gate_response': { responseTime: number; feature: string; userTier: string };
  'audio_load_time': { loadTime: number; trackId: string; userTier: string };
  'session_duration': { duration: number; userTier: string; featuresUsed: string[] };
}

interface ErrorEvents {
  'error_captured': ErrorEvent;
  'custom_error': ErrorEvent;
  'error_rate_high': { errorCount: number; timeWindow: number; userTier: string };
  'performance_degraded': { metric: string; value: number; threshold: number };
}
```

---

## 🚀 Success Criteria

- [ ] Performance metrics are accurately tracked and reported
- [ ] Errors are captured with full context for debugging
- [ ] Analytics events are reliably delivered even when offline
- [ ] Performance dashboard provides actionable insights
- [ ] Error rates are monitored and alerts are triggered
- [ ] System health is continuously monitored
- [ ] Performance impact of monitoring is minimal
- [ ] Error boundaries prevent application crashes
- [ ] Retry logic handles network failures gracefully
- [ ] All monitoring data is properly anonymized and secure

---

## 🔄 Dependencies & Integration

### Input Dependencies
- PRD 6: Analytics & Funnel Tracking (for analytics integration)
- PRD 1: Demo Mode Foundation (for session start monitoring)

### Output Dependencies
- None (final PRD in the series)

### Integration Points
- Analytics service for event tracking
- Performance API for timing measurements
- Error boundaries for React error handling
- Local storage for offline data persistence
- Network API for online/offline detection
- Browser performance APIs for metrics collection
- Error reporting services for production monitoring 