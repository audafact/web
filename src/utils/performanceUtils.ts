// Performance monitoring utilities

export const measureLoadTime = (name: string) => {
  const start = performance.now();
  return () => {
    const end = performance.now();
    const duration = end - start;
    console.log(`⏱️ ${name}: ${duration.toFixed(2)}ms`);
    
    // Track to analytics if available
    if (typeof window !== 'undefined') {
      // Lazy load analytics to avoid blocking
      setTimeout(async () => {
        try {
          const { EnhancedAnalyticsService } = await import('../services/enhancedAnalyticsService');
          const analytics = EnhancedAnalyticsService.getInstance();
          await analytics.track('performance_metric', { 
            metric: name, 
            value: duration,
            type: 'load_time'
          });
        } catch (error) {
          // Silently fail - analytics not critical for performance
        }
      }, 0);
    }
    
    return duration;
  };
};

export const measureAsyncOperation = async <T>(
  name: string, 
  operation: () => Promise<T>
): Promise<T> => {
  const start = performance.now();
  try {
    const result = await operation();
    const end = performance.now();
    const duration = end - start;
    console.log(`⏱️ ${name}: ${duration.toFixed(2)}ms`);
    
    // Track to analytics if available
    if (typeof window !== 'undefined') {
      setTimeout(async () => {
        try {
          const { EnhancedAnalyticsService } = await import('../services/enhancedAnalyticsService');
          const analytics = EnhancedAnalyticsService.getInstance();
          await analytics.track('performance_metric', { 
            metric: name, 
            value: duration,
            type: 'async_operation'
          });
        } catch (error) {
          // Silently fail
        }
      }, 0);
    }
    
    return result;
  } catch (error) {
    const end = performance.now();
    const duration = end - start;
    console.error(`❌ ${name} failed after ${duration.toFixed(2)}ms:`, error);
    throw error;
  }
};

export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

// Memory usage monitoring
export const logMemoryUsage = () => {
  if ('memory' in performance) {
    const memory = (performance as any).memory;
    console.log('🧠 Memory Usage:', {
      used: `${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB`,
      total: `${(memory.totalJSHeapSize / 1024 / 1024).toFixed(2)}MB`,
      limit: `${(memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)}MB`,
    });
  }
};

// Network monitoring
export const logNetworkInfo = () => {
  if ('connection' in navigator) {
    const connection = (navigator as any).connection;
    console.log('🌐 Network Info:', {
      effectiveType: connection.effectiveType,
      downlink: connection.downlink,
      rtt: connection.rtt,
      saveData: connection.saveData,
    });
  }
};

// Performance budget checking
export const checkPerformanceBudget = (metric: string, value: number, budget: number) => {
  if (value > budget) {
    console.warn(`⚠️ Performance budget exceeded for ${metric}: ${value}ms (budget: ${budget}ms)`);
    return false;
  }
  return true;
}; 