export interface PerformanceMetrics {
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

export interface PerformanceEvent {
  metric: string;
  value: number;
  timestamp: number;
  sessionId: string;
  userId?: string;
  userTier: string;
  context: Record<string, any>;
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Map<string, PerformanceMetrics> = new Map();
  private observers: Map<string, PerformanceObserver> = new Map();
  private analytics: any; // Will be imported from analyticsService
  private isEnabled: boolean = false;
  
  private constructor() {
    // Don't initialize observers immediately - wait for enable()
  }
  
  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }
  
  enable(): void {
    if (this.isEnabled) return;
    this.isEnabled = true;
    this.initializeObservers();
  }
  
  disable(): void {
    if (!this.isEnabled) return;
    this.isEnabled = false;
    this.disposeObservers();
  }
  
  private disposeObservers(): void {
    this.observers.forEach(observer => observer.disconnect());
    this.observers.clear();
  }
  
  private initializeObservers(): void {
    // Only initialize if PerformanceObserver is supported and enabled
    if (!('PerformanceObserver' in window) || !this.isEnabled) return;
    
    try {
      // Navigation timing
      const navigationObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'navigation') {
            this.handleNavigationTiming(entry as PerformanceNavigationTiming);
          }
        }
      });
      navigationObserver.observe({ entryTypes: ['navigation'] });
      this.observers.set('navigation', navigationObserver);
    } catch (error) {
      console.warn('Failed to initialize navigation observer:', error);
    }
    
    try {
      // Paint timing
      const paintObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'paint') {
            this.handlePaintTiming(entry as PerformancePaintTiming);
          }
        }
      });
      paintObserver.observe({ entryTypes: ['paint'] });
      this.observers.set('paint', paintObserver);
    } catch (error) {
      console.warn('Failed to initialize paint observer:', error);
    }
    
    try {
      // Resource timing - only for critical resources
      const resourceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'resource') {
            this.handleResourceTiming(entry as PerformanceResourceTiming);
          }
        }
      });
      resourceObserver.observe({ entryTypes: ['resource'] });
      this.observers.set('resource', resourceObserver);
    } catch (error) {
      console.warn('Failed to initialize resource observer:', error);
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
      sessionId: this.getSessionId(),
      userId: this.getCurrentUserId(),
      userTier: this.getCurrentUserTier(),
      context
    };
    
    // Store locally
    this.storeMetric(event);
    
    // Send to analytics if available
    if (this.analytics) {
      this.analytics.track('performance_metric', event);
    }
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
  
  private getSessionId(): string {
    return localStorage.getItem('session_id') || `session_${Date.now()}`;
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
  
  // Set analytics service reference
  setAnalyticsService(analytics: any): void {
    this.analytics = analytics;
  }
} 