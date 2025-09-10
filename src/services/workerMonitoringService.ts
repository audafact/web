/**
 * Worker Monitoring Service
 * 
 * Monitors Worker API performance, error rates, and costs
 * Provides real-time metrics and alerting for production monitoring
 */

interface WorkerMetrics {
  requestCount: number;
  responseTime: number;
  errorRate: number;
  quotaExceededCount: number;
  rateLimitExceededCount: number;
  cacheHitRate: number;
  lastUpdated: number;
}

interface StorageMetrics {
  totalSize: number;
  objectCount: number;
  dailyUploads: number;
  dailyDownloads: number;
  costPerDay: number;
  storageClassDistribution: Record<string, number>;
}

interface CostMetrics {
  storageCost: number;
  bandwidthCost: number;
  requestCost: number;
  totalCost: number;
  dailyCost: number;
  monthlyCost: number;
}

interface AlertConfig {
  highErrorRate: number; // 5%
  highResponseTime: number; // 1000ms
  highCostRate: number; // $50/day
  quotaViolationThreshold: number; // 100/hour
}

export class WorkerMonitoringService {
  private static instance: WorkerMonitoringService;
  private metrics: WorkerMetrics;
  private storageMetrics: StorageMetrics;
  private costMetrics: CostMetrics;
  private alertConfig: AlertConfig;
  private alertCallbacks: Map<string, (message: string, data: any) => void>;

  private constructor() {
    this.metrics = {
      requestCount: 0,
      responseTime: 0,
      errorRate: 0,
      quotaExceededCount: 0,
      rateLimitExceededCount: 0,
      cacheHitRate: 0,
      lastUpdated: Date.now(),
    };

    this.storageMetrics = {
      totalSize: 0,
      objectCount: 0,
      dailyUploads: 0,
      dailyDownloads: 0,
      costPerDay: 0,
      storageClassDistribution: {},
    };

    this.costMetrics = {
      storageCost: 0,
      bandwidthCost: 0,
      requestCost: 0,
      totalCost: 0,
      dailyCost: 0,
      monthlyCost: 0,
    };

    this.alertConfig = {
      highErrorRate: 0.05, // 5%
      highResponseTime: 1000, // 1 second
      highCostRate: 50, // $50/day
      quotaViolationThreshold: 100, // 100/hour
    };

    this.alertCallbacks = new Map();
  }

  static getInstance(): WorkerMonitoringService {
    if (!WorkerMonitoringService.instance) {
      WorkerMonitoringService.instance = new WorkerMonitoringService();
    }
    return WorkerMonitoringService.instance;
  }

  /**
   * Track a Worker API request
   */
  trackRequest(responseTime: number, success: boolean, errorType?: string): void {
    this.metrics.requestCount++;
    this.metrics.responseTime = responseTime;
    this.metrics.lastUpdated = Date.now();

    if (!success) {
      this.metrics.errorRate = (this.metrics.errorRate * (this.metrics.requestCount - 1) + 1) / this.metrics.requestCount;
      
      if (errorType === 'quota_exceeded') {
        this.metrics.quotaExceededCount++;
      } else if (errorType === 'rate_limited') {
        this.metrics.rateLimitExceededCount++;
      }
    } else {
      this.metrics.errorRate = (this.metrics.errorRate * (this.metrics.requestCount - 1)) / this.metrics.requestCount;
    }

    // Check for alerts
    this.checkAlerts();
  }

  /**
   * Track storage usage
   */
  trackStorageUsage(bytes: number): void {
    this.storageMetrics.totalSize += bytes;
    this.storageMetrics.objectCount++;
    this.storageMetrics.dailyUploads++;
    
    this.updateCosts();
  }

  /**
   * Track bandwidth usage
   */
  trackBandwidthUsage(bytes: number): void {
    this.storageMetrics.dailyDownloads++;
    this.costMetrics.bandwidthCost += (bytes / (1024 * 1024 * 1024)) * 0.09; // $0.09 per GB
    
    this.updateCosts();
  }

  /**
   * Track cache hit rate
   */
  trackCacheHit(hit: boolean): void {
    const currentRate = this.metrics.cacheHitRate;
    const totalRequests = this.metrics.requestCount;
    
    if (totalRequests === 0) {
      this.metrics.cacheHitRate = hit ? 1 : 0;
    } else {
      this.metrics.cacheHitRate = (currentRate * (totalRequests - 1) + (hit ? 1 : 0)) / totalRequests;
    }
  }

  /**
   * Get current Worker metrics
   */
  getWorkerMetrics(): WorkerMetrics {
    return { ...this.metrics };
  }

  /**
   * Get current storage metrics
   */
  getStorageMetrics(): StorageMetrics {
    return { ...this.storageMetrics };
  }

  /**
   * Get current cost metrics
   */
  getCostMetrics(): CostMetrics {
    return { ...this.costMetrics };
  }

  /**
   * Get all metrics
   */
  getAllMetrics() {
    return {
      worker: this.getWorkerMetrics(),
      storage: this.getStorageMetrics(),
      cost: this.getCostMetrics(),
    };
  }

  /**
   * Update cost calculations
   */
  private updateCosts(): void {
    // R2 pricing (as of 2024)
    const storageCostPerGB = 0.015; // $0.015 per GB per month
    const bandwidthCostPerGB = 0.09; // $0.09 per GB
    const requestCostPerMillion = 0.36; // $0.36 per million requests

    this.costMetrics.storageCost = (this.storageMetrics.totalSize / (1024 * 1024 * 1024)) * storageCostPerGB;
    this.costMetrics.requestCost = (this.metrics.requestCount / 1000000) * requestCostPerMillion;
    this.costMetrics.totalCost = this.costMetrics.storageCost + this.costMetrics.bandwidthCost + this.costMetrics.requestCost;
    
    // Calculate daily and monthly costs
    this.costMetrics.dailyCost = this.costMetrics.totalCost / 30; // Rough estimate
    this.costMetrics.monthlyCost = this.costMetrics.totalCost;
  }

  /**
   * Check for alert conditions
   */
  private checkAlerts(): void {
    // High error rate alert
    if (this.metrics.errorRate > this.alertConfig.highErrorRate) {
      this.triggerAlert('high_error_rate', {
        errorRate: this.metrics.errorRate,
        threshold: this.alertConfig.highErrorRate,
      });
    }

    // High response time alert
    if (this.metrics.responseTime > this.alertConfig.highResponseTime) {
      this.triggerAlert('high_response_time', {
        responseTime: this.metrics.responseTime,
        threshold: this.alertConfig.highResponseTime,
      });
    }

    // High cost rate alert
    if (this.costMetrics.dailyCost > this.alertConfig.highCostRate) {
      this.triggerAlert('high_cost_rate', {
        dailyCost: this.costMetrics.dailyCost,
        threshold: this.alertConfig.highCostRate,
      });
    }

    // Quota violation alert
    if (this.metrics.quotaExceededCount > this.alertConfig.quotaViolationThreshold) {
      this.triggerAlert('quota_violations', {
        quotaExceededCount: this.metrics.quotaExceededCount,
        threshold: this.alertConfig.quotaViolationThreshold,
      });
    }
  }

  /**
   * Trigger an alert
   */
  private triggerAlert(type: string, data: any): void {
    const message = this.getAlertMessage(type, data);
    
    // Call all registered alert callbacks
    this.alertCallbacks.forEach((callback, id) => {
      try {
        callback(message, data);
      } catch (error) {
        console.error(`Alert callback ${id} failed:`, error);
      }
    });

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.warn(`🚨 Alert: ${message}`, data);
    }
  }

  /**
   * Get alert message for type
   */
  private getAlertMessage(type: string, data: any): string {
    switch (type) {
      case 'high_error_rate':
        return `High error rate detected: ${(data.errorRate * 100).toFixed(2)}% (threshold: ${(data.threshold * 100).toFixed(2)}%)`;
      case 'high_response_time':
        return `High response time detected: ${data.responseTime}ms (threshold: ${data.threshold}ms)`;
      case 'high_cost_rate':
        return `High cost rate detected: $${data.dailyCost.toFixed(2)}/day (threshold: $${data.threshold}/day)`;
      case 'quota_violations':
        return `High quota violations: ${data.quotaExceededCount} (threshold: ${data.threshold})`;
      default:
        return `Unknown alert: ${type}`;
    }
  }

  /**
   * Register an alert callback
   */
  onAlert(callback: (message: string, data: any) => void): string {
    const id = Math.random().toString(36).substr(2, 9);
    this.alertCallbacks.set(id, callback);
    return id;
  }

  /**
   * Unregister an alert callback
   */
  offAlert(id: string): void {
    this.alertCallbacks.delete(id);
  }

  /**
   * Update alert configuration
   */
  updateAlertConfig(config: Partial<AlertConfig>): void {
    this.alertConfig = { ...this.alertConfig, ...config };
  }

  /**
   * Reset all metrics
   */
  resetMetrics(): void {
    this.metrics = {
      requestCount: 0,
      responseTime: 0,
      errorRate: 0,
      quotaExceededCount: 0,
      rateLimitExceededCount: 0,
      cacheHitRate: 0,
      lastUpdated: Date.now(),
    };

    this.storageMetrics = {
      totalSize: 0,
      objectCount: 0,
      dailyUploads: 0,
      dailyDownloads: 0,
      costPerDay: 0,
      storageClassDistribution: {},
    };

    this.costMetrics = {
      storageCost: 0,
      bandwidthCost: 0,
      requestCost: 0,
      totalCost: 0,
      dailyCost: 0,
      monthlyCost: 0,
    };
  }

  /**
   * Export metrics for external monitoring
   */
  exportMetrics(): string {
    return JSON.stringify(this.getAllMetrics(), null, 2);
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): {
    status: 'healthy' | 'warning' | 'critical';
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check error rate
    if (this.metrics.errorRate > 0.1) {
      issues.push('Critical error rate');
      recommendations.push('Investigate and fix error sources');
    } else if (this.metrics.errorRate > 0.05) {
      issues.push('Elevated error rate');
      recommendations.push('Monitor error patterns and consider optimizations');
    }

    // Check response time
    if (this.metrics.responseTime > 2000) {
      issues.push('Very slow response times');
      recommendations.push('Optimize Worker code and check R2 performance');
    } else if (this.metrics.responseTime > 1000) {
      issues.push('Slow response times');
      recommendations.push('Consider caching optimizations');
    }

    // Check cache hit rate
    if (this.metrics.cacheHitRate < 0.5) {
      issues.push('Low cache hit rate');
      recommendations.push('Review caching strategy and cache headers');
    }

    // Check costs
    if (this.costMetrics.dailyCost > 100) {
      issues.push('High daily costs');
      recommendations.push('Review storage usage and optimize file sizes');
    }

    const status = issues.length === 0 ? 'healthy' : 
                  issues.some(i => i.includes('Critical') || i.includes('Very slow')) ? 'critical' : 'warning';

    return { status, issues, recommendations };
  }
}

// Export singleton instance
export const workerMonitoring = WorkerMonitoringService.getInstance();
