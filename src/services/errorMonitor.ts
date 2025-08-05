export interface ErrorContext {
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

export interface ErrorEvent {
  id: string;
  message: string;
  stack: string;
  type: 'error' | 'unhandledrejection' | 'custom';
  timestamp: number;
  context: ErrorContext;
  severity: 'low' | 'medium' | 'high' | 'critical';
  fingerprint: string;
}

export class ErrorMonitor {
  private static instance: ErrorMonitor;
  private errors: ErrorEvent[] = [];
  private analytics: any; // Will be imported from analyticsService
  private maxErrors = 50;
  
  private constructor() {
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
    
    // Send to analytics if available
    if (this.analytics) {
      this.analytics.track('error_captured', errorEvent);
    }
    
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
    if (this.analytics) {
      this.analytics.track('custom_error', errorEvent);
    }
  }
  
  private buildErrorContext(
    context: string, 
    additionalContext: Record<string, any>
  ): ErrorContext {
    return {
      userId: this.getCurrentUserId(),
      userTier: this.getCurrentUserTier(),
      sessionId: this.getSessionId(),
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
  
  private getSessionId(): string {
    return localStorage.getItem('session_id') || `session_${Date.now()}`;
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
  
  // Set analytics service reference
  setAnalyticsService(analytics: any): void {
    this.analytics = analytics;
  }
} 