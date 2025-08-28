# PRD: Phase 6 - Testing & Observability

## Overview

Establish comprehensive testing infrastructure and observability systems to ensure the media migration is reliable, performant, and maintainable. This phase focuses on quality assurance and monitoring capabilities.

## Objectives

- Implement comprehensive testing suite for all media operations
- Set up monitoring and alerting for Worker performance
- Establish cost tracking and usage analytics
- Implement error monitoring and performance dashboards
- Ensure mobile compatibility and edge case coverage

## Success Criteria

- [ ] Test suite covers all media operations (upload, preview, delete)
- [ ] Monitoring systems operational for Worker and R2
- [ ] Cost tracking implemented and functional
- [ ] Error monitoring catches issues early
- [ ] Performance metrics meet requirements
- [ ] Mobile compatibility validated

## Technical Requirements

### Testing Suite Implementation

#### Unit Tests

```typescript
// Test file structure
describe("Media Operations", () => {
  describe("Upload Flow", () => {
    it("should sign upload request successfully", async () => {
      // Test upload signing
    });

    it("should enforce upload quotas", async () => {
      // Test quota enforcement
    });

    it("should handle upload errors gracefully", async () => {
      // Test error handling
    });
  });

  describe("Preview Flow", () => {
    it("should sign preview requests", async () => {
      // Test preview signing
    });

    it("should enforce access controls", async () => {
      // Test access control
    });

    it("should handle rate limiting", async () => {
      // Test rate limiting
    });
  });

  describe("Delete Flow", () => {
    it("should delete files successfully", async () => {
      // Test file deletion
    });

    it("should enforce ownership validation", async () => {
      // Test ownership checks
    });
  });
});
```

#### Integration Tests

```typescript
describe("End-to-End Media Flow", () => {
  it("should complete full upload → preview → delete cycle", async () => {
    // 1. Upload file
    const uploadResult = await uploadFile(testFile);

    // 2. Preview file
    const previewUrl = await signFile(uploadResult.fileKey);
    const previewResult = await previewFile(previewUrl);

    // 3. Delete file
    const deleteResult = await deleteFile(uploadResult.fileKey);

    // Verify all operations succeeded
    expect(uploadResult.success).toBe(true);
    expect(previewResult.success).toBe(true);
    expect(deleteResult.success).toBe(true);
  });

  it("should handle concurrent operations correctly", async () => {
    // Test multiple simultaneous operations
    const operations = Array(10)
      .fill(null)
      .map(() => uploadFile(testFile));

    const results = await Promise.all(operations);
    expect(results.every((r) => r.success)).toBe(true);
  });
});
```

#### Mobile Compatibility Tests

```typescript
describe("Mobile Compatibility", () => {
  it("should work on iOS Safari", async () => {
    // Test iOS Safari specific behaviors
    // - Autoplay policies
    // - Touch interactions
    // - Audio context handling
  });

  it("should work on Android Chrome", async () => {
    // Test Android Chrome specific behaviors
    // - File upload handling
    // - Audio playback
    // - Touch gestures
  });

  it("should handle mobile network conditions", async () => {
    // Test slow network scenarios
    // - Large file uploads
    // - Audio streaming
    // - Error recovery
  });
});
```

### Monitoring and Alerting

#### Worker Performance Monitoring

```typescript
interface WorkerMetrics {
  requestCount: number;
  responseTime: number;
  errorRate: number;
  quotaExceededCount: number;
  rateLimitExceededCount: number;
  cacheHitRate: number;
}

class WorkerMonitor {
  async collectMetrics(): Promise<WorkerMetrics> {
    // Collect metrics from Worker
    const metrics = await this.getWorkerMetrics();

    // Store in monitoring system
    await this.storeMetrics(metrics);

    // Check for alerts
    await this.checkAlerts(metrics);

    return metrics;
  }

  async checkAlerts(metrics: WorkerMetrics): Promise<void> {
    // Check error rate
    if (metrics.errorRate > 0.05) {
      // 5%
      await this.triggerAlert("High error rate detected", metrics);
    }

    // Check response time
    if (metrics.responseTime > 1000) {
      // 1 second
      await this.triggerAlert("High response time detected", metrics);
    }

    // Check quota violations
    if (metrics.quotaExceededCount > 100) {
      // 100 per hour
      await this.triggerAlert("High quota violation rate", metrics);
    }
  }
}
```

#### R2 Storage Monitoring

```typescript
interface StorageMetrics {
  totalSize: number;
  objectCount: number;
  dailyUploads: number;
  dailyDownloads: number;
  costPerDay: number;
  storageClassDistribution: Record<string, number>;
}

class StorageMonitor {
  async collectStorageMetrics(): Promise<StorageMetrics> {
    // Collect R2 metrics
    const metrics = await this.getR2Metrics();

    // Calculate costs
    const costs = await this.calculateCosts(metrics);

    // Store metrics
    await this.storeStorageMetrics({ ...metrics, ...costs });

    return { ...metrics, ...costs };
  }

  async checkStorageAlerts(metrics: StorageMetrics): Promise<void> {
    // Check storage costs
    if (metrics.costPerDay > 50) {
      // $50 per day
      await this.triggerAlert("High storage costs detected", metrics);
    }

    // Check storage growth
    const growthRate = await this.calculateGrowthRate();
    if (growthRate > 0.2) {
      // 20% per day
      await this.triggerAlert("High storage growth rate", metrics);
    }
  }
}
```

### Cost Tracking and Analytics

#### Usage Analytics Dashboard

```typescript
interface UsageAnalytics {
  topTracksByPlays: Array<{
    trackId: string;
    title: string;
    playCount: number;
    totalBandwidth: number;
  }>;

  topUsersByActivity: Array<{
    userId: string;
    email: string;
    tier: string;
    uploadCount: number;
    previewCount: number;
    totalBandwidth: number;
  }>;

  dailyUsageTrends: Array<{
    date: string;
    uploads: number;
    previews: number;
    downloads: number;
    bandwidth: number;
    cost: number;
  }>;
}

class AnalyticsService {
  async generateUsageReport(): Promise<UsageAnalytics> {
    // Query database for usage data
    const topTracks = await this.getTopTracksByPlays();
    const topUsers = await this.getTopUsersByActivity();
    const dailyTrends = await this.getDailyUsageTrends();

    return {
      topTracksByPlays: topTracks,
      topUsersByActivity: topUsers,
      dailyUsageTrends: dailyTrends,
    };
  }

  async exportReport(format: "csv" | "json"): Promise<string> {
    const report = await this.generateUsageReport();

    switch (format) {
      case "csv":
        return this.exportToCSV(report);
      case "json":
        return JSON.stringify(report, null, 2);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }
}
```

### Error Monitoring

#### Error Tracking System

```typescript
interface ErrorEvent {
  id: string;
  timestamp: string;
  error: string;
  stack?: string;
  userId?: string;
  requestId: string;
  endpoint: string;
  userAgent: string;
  ipAddress: string;
  metadata: Record<string, any>;
}

class ErrorMonitor {
  async captureError(error: Error, context: ErrorContext): Promise<void> {
    const errorEvent: ErrorEvent = {
      id: generateId(),
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: error.stack,
      userId: context.userId,
      requestId: context.requestId,
      endpoint: context.endpoint,
      userAgent: context.userAgent,
      ipAddress: context.ipAddress,
      metadata: context.metadata,
    };

    // Store error in database
    await this.storeError(errorEvent);

    // Send to external monitoring service
    await this.sendToMonitoringService(errorEvent);

    // Check for alert conditions
    await this.checkErrorAlerts(errorEvent);
  }

  async checkErrorAlerts(errorEvent: ErrorEvent): Promise<void> {
    // Check error frequency
    const recentErrors = await this.getRecentErrors(5); // Last 5 minutes
    if (recentErrors.length > 10) {
      await this.triggerAlert("High error rate detected", {
        count: recentErrors.length,
      });
    }

    // Check for specific error patterns
    if (errorEvent.error.includes("quota exceeded")) {
      await this.triggerAlert("Quota exceeded errors detected", errorEvent);
    }
  }
}
```

## Implementation Steps

### Step 1: Testing Infrastructure

1. Set up testing framework and configuration
2. Implement unit tests for all media operations
3. Create integration tests for end-to-end flows
4. Add mobile compatibility tests
5. Set up test data and fixtures

### Step 2: Monitoring Implementation

1. Implement Worker performance monitoring
2. Add R2 storage monitoring
3. Set up error tracking system
4. Configure alerting rules
5. Test monitoring systems

### Step 3: Analytics and Cost Tracking

1. Implement usage analytics collection
2. Create cost calculation logic
3. Build analytics dashboard
4. Add report export functionality
5. Test analytics accuracy

### Step 4: Performance Validation

1. Run performance tests
2. Validate mobile compatibility
3. Test error scenarios
4. Verify monitoring accuracy
5. Document performance baselines

## Dependencies

- Phase 3: Worker API Core (for testing endpoints)
- Phase 4: Frontend Integration (for testing user flows)
- Phase 5: Security & Entitlements (for testing security measures)

## Risks & Mitigation

- **Risk**: Testing gaps leading to production issues
  - **Mitigation**: Comprehensive test coverage and automated testing
- **Risk**: Monitoring overhead impacting performance
  - **Mitigation**: Efficient monitoring implementation and sampling
- **Risk**: False alerts causing alert fatigue
  - **Mitigation**: Careful alert tuning and validation

## Testing Requirements

- [ ] All media operations covered by tests
- [ ] Integration tests validate end-to-end flows
- [ ] Mobile compatibility verified
- [ ] Error scenarios tested
- [ ] Performance requirements met
- [ ] Security measures validated

## Performance Requirements

- Test execution time: <5 minutes for full suite
- Monitoring overhead: <5% performance impact
- Error detection latency: <1 minute
- Alert response time: <5 minutes

## Definition of Done

- [ ] Comprehensive test suite implemented
- [ ] Monitoring systems operational
- [ ] Analytics dashboard functional
- [ ] Error tracking operational
- [ ] All tests passing
- [ ] Performance validated
- [ ] Mobile compatibility verified
- [ ] Documentation updated
- [ ] Monitoring alerts tested
