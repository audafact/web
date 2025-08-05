import { PerformanceMonitor } from './performanceMonitor';
import { ErrorMonitor } from './errorMonitor';
import { AnalyticsReliabilityService } from './analyticsReliabilityService';
import { AnalyticsService } from './analyticsService';

export class EnhancedAnalyticsService {
  private static instance: EnhancedAnalyticsService;
  private reliabilityService: AnalyticsReliabilityService | null = null;
  private performanceMonitor: PerformanceMonitor | null = null;
  private errorMonitor: ErrorMonitor | null = null;
  private analyticsService: AnalyticsService | null = null;
  private isInitialized: boolean = false;
  
  private constructor() {
    // Don't initialize services immediately
  }
  
  static getInstance(): EnhancedAnalyticsService {
    if (!EnhancedAnalyticsService.instance) {
      EnhancedAnalyticsService.instance = new EnhancedAnalyticsService();
    }
    return EnhancedAnalyticsService.instance;
  }
  
  private async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    // Lazy load services
    this.reliabilityService = AnalyticsReliabilityService.getInstance();
    this.performanceMonitor = PerformanceMonitor.getInstance();
    this.errorMonitor = ErrorMonitor.getInstance();
    this.analyticsService = AnalyticsService.getInstance();
    
    // Only enable performance monitoring in development or when explicitly requested
    if (process.env.NODE_ENV === 'development') {
      this.performanceMonitor.enable();
    }
    
    // Set up cross-service references
    if (this.performanceMonitor) {
      this.performanceMonitor.setAnalyticsService(this);
    }
    if (this.errorMonitor) {
      this.errorMonitor.setAnalyticsService(this);
    }
    
    this.isInitialized = true;
  }
  
  async track(event: string, properties: Record<string, any> = {}): Promise<void> {
    await this.initialize();
    
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
    if (this.reliabilityService) {
      this.reliabilityService.queueEvent(event, enhancedProperties);
    }
    
    // Track performance impact
    if (this.performanceMonitor) {
      this.performanceMonitor.trackMetric('analytics_event_sent', 1, { event });
    }
  }
  
  async trackPerformance(metric: string, value: number, context: Record<string, any> = {}): Promise<void> {
    await this.initialize();
    if (this.performanceMonitor) {
      this.performanceMonitor.trackMetric(metric, value, context);
    }
  }
  
  async trackError(error: Error, context: string, additionalContext: Record<string, any> = {}): Promise<void> {
    await this.initialize();
    if (this.errorMonitor) {
      this.errorMonitor.captureError(error, context, additionalContext);
    }
  }
  
  async trackCustomError(message: string, context: string, severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'): Promise<void> {
    await this.initialize();
    if (this.errorMonitor) {
      this.errorMonitor.captureCustomError(message, context, severity);
    }
  }
  
  async startPerformanceTimer(metric: string): Promise<() => void> {
    await this.initialize();
    if (this.performanceMonitor) {
      return this.performanceMonitor.startTimer(metric);
    }
    return () => {}; // No-op if not initialized
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
      pendingEvents: this.reliabilityService?.getPendingEventCount() || 0,
      errorRate: this.errorMonitor?.getErrorRate() || 0,
      isOnline: navigator.onLine,
      lastError: this.errorMonitor?.getErrors()[this.errorMonitor?.getErrors().length - 1],
      performanceMetrics: this.performanceMonitor?.getMetrics() || []
    };
  }
  
  // Get monitoring data
  getPerformanceMetrics() {
    return this.performanceMonitor?.getMetrics() || [];
  }
  
  getErrors() {
    return this.errorMonitor?.getErrors() || [];
  }
  
  // Clear monitoring data
  clearPerformanceMetrics() {
    this.performanceMonitor?.clearMetrics();
  }
  
  clearErrors() {
    this.errorMonitor?.clearErrors();
  }
  
  clearPendingEvents() {
    this.reliabilityService?.clearPendingEvents();
  }
  
  // Cleanup
  destroy(): void {
    this.reliabilityService?.destroy();
  }
} 