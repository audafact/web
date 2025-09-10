/**
 * R2 Storage Service
 *
 * Direct interaction with Cloudflare R2 storage
 * Used for monitoring, analytics, and direct operations
 */

interface R2UsageStats {
  totalSizeBytes: number;
  objectCount: number;
  dailyUploadBytes: number;
  dailyDownloadBytes: number;
  lastUpdated: string;
}

interface R2ObjectInfo {
  key: string;
  size: number;
  lastModified: string;
  etag: string;
}

export class R2StorageService {
  private static instance: R2StorageService;
  private usageStats: R2UsageStats = {
    totalSizeBytes: 0,
    objectCount: 0,
    dailyUploadBytes: 0,
    dailyDownloadBytes: 0,
    lastUpdated: new Date().toISOString(),
  };

  private constructor() {
    this.loadUsageStats();
  }

  static getInstance(): R2StorageService {
    if (!R2StorageService.instance) {
      R2StorageService.instance = new R2StorageService();
    }
    return R2StorageService.instance;
  }

  /**
   * Get current storage usage statistics
   */
  getStorageUsage(): R2UsageStats {
    return { ...this.usageStats };
  }

  /**
   * Update storage usage (called by Worker API or direct operations)
   */
  updateStorageUsage(
    sizeBytes: number,
    operation: "upload" | "download" | "delete"
  ): void {
    switch (operation) {
      case "upload":
        this.usageStats.totalSizeBytes += sizeBytes;
        this.usageStats.objectCount += 1;
        this.usageStats.dailyUploadBytes += sizeBytes;
        break;
      case "download":
        this.usageStats.dailyDownloadBytes += sizeBytes;
        break;
      case "delete":
        this.usageStats.totalSizeBytes = Math.max(
          0,
          this.usageStats.totalSizeBytes - sizeBytes
        );
        this.usageStats.objectCount = Math.max(
          0,
          this.usageStats.objectCount - 1
        );
        break;
    }

    this.usageStats.lastUpdated = new Date().toISOString();
    this.saveUsageStats();
  }

  /**
   * Get storage usage in human-readable format
   */
  getStorageUsageFormatted(): {
    totalSize: string;
    objectCount: string;
    dailyUpload: string;
    dailyDownload: string;
  } {
    return {
      totalSize: this.formatBytes(this.usageStats.totalSizeBytes),
      objectCount: this.usageStats.objectCount.toLocaleString(),
      dailyUpload: this.formatBytes(this.usageStats.dailyUploadBytes),
      dailyDownload: this.formatBytes(this.usageStats.dailyDownloadBytes),
    };
  }

  /**
   * Get storage efficiency metrics
   */
  getStorageEfficiency(): {
    averageObjectSize: number;
    dailyUploadRate: number;
    dailyDownloadRate: number;
    storageUtilization: number; // percentage
  } {
    const averageObjectSize =
      this.usageStats.objectCount > 0
        ? this.usageStats.totalSizeBytes / this.usageStats.objectCount
        : 0;

    const dailyUploadRate = this.usageStats.dailyUploadBytes / (1024 * 1024); // MB
    const dailyDownloadRate =
      this.usageStats.dailyDownloadBytes / (1024 * 1024); // MB

    // Assume 100GB as a reasonable storage limit for calculation
    const storageLimit = 100 * 1024 * 1024 * 1024; // 100GB
    const storageUtilization =
      (this.usageStats.totalSizeBytes / storageLimit) * 100;

    return {
      averageObjectSize,
      dailyUploadRate,
      dailyDownloadRate,
      storageUtilization: Math.min(storageUtilization, 100),
    };
  }

  /**
   * Reset daily counters (call this daily)
   */
  resetDailyCounters(): void {
    this.usageStats.dailyUploadBytes = 0;
    this.usageStats.dailyDownloadBytes = 0;
    this.usageStats.lastUpdated = new Date().toISOString();
    this.saveUsageStats();
  }

  /**
   * Get storage health status
   */
  getStorageHealth(): {
    status: "healthy" | "warning" | "critical";
    message: string;
    recommendations: string[];
  } {
    const efficiency = this.getStorageEfficiency();
    const recommendations: string[] = [];
    let status: "healthy" | "warning" | "critical" = "healthy";
    let message = "Storage is operating normally";

    // Check storage utilization
    if (efficiency.storageUtilization > 90) {
      status = "critical";
      message = "Storage is nearly full";
      recommendations.push(
        "Consider archiving old files or upgrading storage plan"
      );
    } else if (efficiency.storageUtilization > 75) {
      status = "warning";
      message = "Storage utilization is high";
      recommendations.push("Monitor storage usage closely");
    }

    // Check daily upload rate
    if (efficiency.dailyUploadRate > 1000) {
      // > 1GB per day
      if (status === "healthy") status = "warning";
      recommendations.push("High daily upload volume detected");
    }

    // Check object count
    if (this.usageStats.objectCount > 100000) {
      if (status === "healthy") status = "warning";
      recommendations.push("Large number of objects - consider cleanup");
    }

    return {
      status,
      message,
      recommendations,
    };
  }

  /**
   * Format bytes to human-readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";

    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  /**
   * Save usage stats to localStorage
   */
  private saveUsageStats(): void {
    try {
      localStorage.setItem(
        "r2StorageUsageStats",
        JSON.stringify(this.usageStats)
      );
    } catch (error) {
      console.warn("Failed to save R2 storage usage stats:", error);
    }
  }

  /**
   * Load usage stats from localStorage
   */
  private loadUsageStats(): void {
    try {
      const saved = localStorage.getItem("r2StorageUsageStats");
      if (saved) {
        this.usageStats = { ...this.usageStats, ...JSON.parse(saved) };
      }
    } catch (error) {
      console.warn("Failed to load R2 storage usage stats:", error);
    }
  }
}
