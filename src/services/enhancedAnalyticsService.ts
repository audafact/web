import { PerformanceMonitor } from './performanceMonitor';
import { ErrorMonitor } from './errorMonitor';
import { AnalyticsReliabilityService } from './analyticsReliabilityService';
import { AnalyticsService } from './analyticsService';

export class EnhancedAnalyticsService {
  private static instance: EnhancedAnalyticsService;
  private reliabilityService: AnalyticsReliabilityService;
  private performanceMonitor: PerformanceMonitor;
  private errorMonitor: ErrorMonitor;
  private analyticsService: AnalyticsService;
  
  private constructor() {
    this.reliabilityService = AnalyticsReliabilityService.getInstance();
    this.performanceMonitor = PerformanceMonitor.getInstance();
    this.errorMonitor = ErrorMonitor.getInstance();
    this.analyticsService = AnalyticsService.getInstance();
    
    // Set up cross-service references
    this.performanceMonitor.setAnalyticsService(this);
    this.errorMonitor.setAnalyticsService(this);
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
  
  startPerformanceTimer(metric: string): () => void {
    return this.performanceMonitor.startTimer(metric);
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
    lastError?: any;
    performanceMetrics: any[];
  } {
    return {
      pendingEvents: this.reliabilityService.getPendingEventCount(),
      errorRate: this.errorMonitor.getErrorRate(),
      isOnline: navigator.onLine,
      lastError: this.errorMonitor.getErrors()[this.errorMonitor.getErrors().length - 1],
      performanceMetrics: this.performanceMonitor.getMetrics()
    };
  }
  
  // Get monitoring data
  getPerformanceMetrics() {
    return this.performanceMonitor.getMetrics();
  }
  
  getErrors() {
    return this.errorMonitor.getErrors();
  }
  
  // Clear monitoring data
  clearPerformanceMetrics() {
    this.performanceMonitor.clearMetrics();
  }
  
  clearErrors() {
    this.errorMonitor.clearErrors();
  }
  
  clearPendingEvents() {
    this.reliabilityService.clearPendingEvents();
  }
  
  // Cleanup
  destroy(): void {
    this.reliabilityService.destroy();
  }
} 