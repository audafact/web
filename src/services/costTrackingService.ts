/**
 * Cost Tracking Service
 *
 * Tracks and calculates costs for R2 storage, bandwidth, and Worker API requests
 * Essential for Phase 6 observability and cost monitoring
 */

interface CostMetrics {
  storageUsed: number; // bytes
  bandwidthUsed: number; // bytes
  requestCount: number;
  errorCount: number;
  quotaExceededCount: number;
}

interface CostBreakdown {
  storageCost: number;
  bandwidthCost: number;
  requestCost: number;
  totalCost: number;
}

interface DailyCostRecord {
  date: string;
  storageCost: number;
  bandwidthCost: number;
  requestCost: number;
  totalCost: number;
}

export class CostTrackingService {
  private static instance: CostTrackingService;
  private metrics: CostMetrics = {
    storageUsed: 0,
    bandwidthUsed: 0,
    requestCount: 0,
    errorCount: 0,
    quotaExceededCount: 0,
  };
  private dailyRecords: DailyCostRecord[] = [];

  // R2 Pricing (as of 2024)
  private readonly PRICING = {
    storage: 0.015, // $0.015 per GB per month
    bandwidth: 0.09, // $0.09 per GB
    requests: 0.36, // $0.36 per million requests
  };

  private constructor() {
    this.loadDailyRecords();
  }

  static getInstance(): CostTrackingService {
    if (!CostTrackingService.instance) {
      CostTrackingService.instance = new CostTrackingService();
    }
    return CostTrackingService.instance;
  }

  /**
   * Track storage usage (file uploads)
   */
  trackStorageUsage(bytes: number): void {
    this.metrics.storageUsed += bytes;
    this.saveMetrics();
  }

  /**
   * Track bandwidth usage (file downloads)
   */
  trackBandwidthUsage(bytes: number): void {
    this.metrics.bandwidthUsed += bytes;
    this.saveMetrics();
  }

  /**
   * Track API requests
   */
  trackRequest(): void {
    this.metrics.requestCount++;
    this.saveMetrics();
  }

  /**
   * Track errors
   */
  trackError(): void {
    this.metrics.errorCount++;
    this.saveMetrics();
  }

  /**
   * Track quota exceeded events
   */
  trackQuotaExceeded(): void {
    this.metrics.quotaExceededCount++;
    this.saveMetrics();
  }

  /**
   * Get current metrics
   */
  getMetrics(): CostMetrics {
    return { ...this.metrics };
  }

  /**
   * Calculate costs based on current metrics
   */
  calculateCosts(): CostBreakdown {
    const storageCost =
      (this.metrics.storageUsed / (1024 * 1024 * 1024)) * this.PRICING.storage;
    const bandwidthCost =
      (this.metrics.bandwidthUsed / (1024 * 1024 * 1024)) *
      this.PRICING.bandwidth;
    const requestCost =
      (this.metrics.requestCount / 1000000) * this.PRICING.requests;

    return {
      storageCost,
      bandwidthCost,
      requestCost,
      totalCost: storageCost + bandwidthCost + requestCost,
    };
  }

  /**
   * Get estimated daily cost
   */
  getEstimatedDailyCost(): number {
    const costs = this.calculateCosts();
    return costs.totalCost;
  }

  /**
   * Record daily costs
   */
  recordDailyCosts(): void {
    const today = new Date().toISOString().split("T")[0];
    const costs = this.calculateCosts();

    const record: DailyCostRecord = {
      date: today,
      storageCost: costs.storageCost,
      bandwidthCost: costs.bandwidthCost,
      requestCost: costs.requestCost,
      totalCost: costs.totalCost,
    };

    // Remove existing record for today if it exists
    this.dailyRecords = this.dailyRecords.filter((r) => r.date !== today);
    this.dailyRecords.push(record);

    this.saveDailyRecords();
  }

  /**
   * Get cost trends over time
   */
  getCostTrends(): DailyCostRecord[] {
    return [...this.dailyRecords].sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Get high-cost areas
   */
  getHighCostAreas(): string[] {
    const costs = this.calculateCosts();
    const areas: string[] = [];

    if (
      costs.storageCost > costs.bandwidthCost &&
      costs.storageCost > costs.requestCost
    ) {
      areas.push("R2 Storage");
    }
    if (
      costs.bandwidthCost > costs.storageCost &&
      costs.bandwidthCost > costs.requestCost
    ) {
      areas.push("R2 Bandwidth");
    }
    if (
      costs.requestCost > costs.storageCost &&
      costs.requestCost > costs.bandwidthCost
    ) {
      areas.push("Worker API");
    }

    return areas;
  }

  /**
   * Reset metrics
   */
  reset(): void {
    this.metrics = {
      storageUsed: 0,
      bandwidthUsed: 0,
      requestCount: 0,
      errorCount: 0,
      quotaExceededCount: 0,
    };
    this.saveMetrics();
  }

  /**
   * Save metrics to localStorage
   */
  private saveMetrics(): void {
    try {
      localStorage.setItem("costTrackingMetrics", JSON.stringify(this.metrics));
    } catch (error) {
      console.warn("Failed to save cost tracking metrics:", error);
    }
  }

  /**
   * Load metrics from localStorage
   */
  private loadMetrics(): void {
    try {
      const saved = localStorage.getItem("costTrackingMetrics");
      if (saved) {
        this.metrics = { ...this.metrics, ...JSON.parse(saved) };
      }
    } catch (error) {
      console.warn("Failed to load cost tracking metrics:", error);
    }
  }

  /**
   * Save daily records to localStorage
   */
  private saveDailyRecords(): void {
    try {
      localStorage.setItem(
        "costTrackingDailyRecords",
        JSON.stringify(this.dailyRecords)
      );
    } catch (error) {
      console.warn("Failed to save daily cost records:", error);
    }
  }

  /**
   * Load daily records from localStorage
   */
  private loadDailyRecords(): void {
    try {
      const saved = localStorage.getItem("costTrackingDailyRecords");
      if (saved) {
        this.dailyRecords = JSON.parse(saved);
      }
    } catch (error) {
      console.warn("Failed to load daily cost records:", error);
    }
  }
}
