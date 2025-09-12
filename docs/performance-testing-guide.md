# Performance Testing Guide

## Overview

This guide covers the performance testing strategy for Audafact, focusing on load testing, memory usage, and response times.

## Test Structure

### Directory Organization

```
tests/playwright/
├── performance/
│   ├── load-testing.spec.ts
│   ├── memory-usage.spec.ts
│   └── response-times.spec.ts
└── integration/
    └── test-utils.ts
```

## Test Categories

### 1. Load Testing

Tests the application's ability to handle high load and concurrent users:

**Key Scenarios:**

- Multiple concurrent users
- High frequency API calls
- Large dataset loading
- Memory usage efficiency
- Concurrent recording sessions
- Rapid user interactions
- Large file uploads
- Database query optimization
- Real-time updates
- Error recovery under load

**Test File:** `load-testing.spec.ts`

### 2. Memory Usage Testing

Tests memory efficiency and leak prevention:

**Key Scenarios:**

- Memory leaks during normal usage
- Large audio file handling
- Resource cleanup on navigation
- Multiple recording sessions
- Waveform rendering
- Audio playback
- Chart rendering
- Modal operations
- Form input handling
- Real-time updates

**Test File:** `memory-usage.spec.ts`

### 3. Response Time Testing

Tests response times for various operations:

**Key Scenarios:**

- Page load times
- API response times
- User interaction response
- Form submission times
- Audio playback start
- Waveform rendering
- Chart rendering
- Search performance
- File upload times
- Navigation performance
- Modal operations
- Real-time updates
- Concurrent operations
- Performance under load

**Test File:** `response-times.spec.ts`

## Performance Benchmarks

### Page Load Times

| Page         | Target | Acceptable | Critical |
| ------------ | ------ | ---------- | -------- |
| Main Page    | < 1s   | < 2s       | > 3s     |
| Studio Page  | < 1.5s | < 2.5s     | > 4s     |
| Library Page | < 2s   | < 3s       | > 5s     |
| Dashboard    | < 2.5s | < 4s       | > 6s     |

### API Response Times

| Endpoint       | Target  | Acceptable | Critical |
| -------------- | ------- | ---------- | -------- |
| Authentication | < 200ms | < 500ms    | > 1s     |
| Recording CRUD | < 300ms | < 800ms    | > 1.5s   |
| Audio Playback | < 100ms | < 300ms    | > 500ms  |
| Dashboard Data | < 500ms | < 1s       | > 2s     |

### Memory Usage

| Operation         | Target          | Acceptable      | Critical        |
| ----------------- | --------------- | --------------- | --------------- |
| Initial Load      | < 50MB          | < 100MB         | > 200MB         |
| After 5min Usage  | < 100MB         | < 150MB         | > 300MB         |
| Large File Upload | < 200MB         | < 300MB         | > 500MB         |
| Memory Leak Test  | < 10MB increase | < 20MB increase | > 50MB increase |

## Test Examples

### Load Testing Example

```typescript
test("should handle multiple concurrent users", async ({ page }) => {
  // Mock multiple users accessing the same recording
  await testUtils.mockApiResponse("**/recordings/123", {
    success: true,
    recording: {
      id: "123",
      name: "Shared Recording",
      audioUrl: "https://example.com/audio.mp3",
      duration: 120,
      status: "active",
      concurrentUsers: 5,
    },
  });

  await page.goto("/studio/123");

  // Verify recording loads with multiple users
  await testUtils.expectElementVisible('[data-testid="recording-loaded"]');
  await testUtils.expectElementVisible('[data-testid="concurrent-users"]');
  await testUtils.expectElementText(
    '[data-testid="concurrent-users"]',
    "5 users viewing"
  );
});
```

### Memory Usage Example

```typescript
test("should not have memory leaks during normal usage", async ({ page }) => {
  await page.goto("/studio");

  // Get initial memory usage
  const initialMemory = await testUtils.getMemoryUsage();

  // Simulate normal usage for 5 minutes
  for (let i = 0; i < 30; i++) {
    await page.click('[data-testid="new-recording-button"]');
    await page.fill('[data-testid="recording-name-input"]', `Recording ${i}`);
    await page.click('[data-testid="create-recording-button"]');
    await page.waitForTimeout(1000);

    await page.click('[data-testid="record-button"]');
    await page.waitForTimeout(2000);
    await page.click('[data-testid="stop-button"]');
    await page.waitForTimeout(1000);
  }

  // Force garbage collection
  await page.evaluate(() => {
    if (window.gc) {
      window.gc();
    }
  });

  // Get final memory usage
  const finalMemory = await testUtils.getMemoryUsage();

  if (initialMemory && finalMemory) {
    const memoryIncrease =
      finalMemory.usedJSHeapSize - initialMemory.usedJSHeapSize;
    expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // Should not increase by more than 10MB
  }
});
```

### Response Time Example

```typescript
test("should load main page within acceptable time", async ({ page }) => {
  const startTime = Date.now();
  await page.goto("/");
  const endTime = Date.now();

  const loadTime = endTime - startTime;
  expect(loadTime).toBeLessThan(2000); // Should load within 2 seconds

  // Verify page is fully loaded
  await testUtils.expectElementVisible('[data-testid="app-loaded"]');
});
```

## Running Performance Tests

### Run All Performance Tests

```bash
npm run test:performance
```

### Run Specific Test Category

```bash
# Load testing
npx playwright test tests/playwright/performance/load-testing.spec.ts

# Memory usage
npx playwright test tests/playwright/performance/memory-usage.spec.ts

# Response times
npx playwright test tests/playwright/performance/response-times.spec.ts
```

### Run Tests with Performance Monitoring

```bash
npx playwright test --project=performance-tests --headed
```

## Performance Monitoring

### Metrics Collection

The `TestUtils` class provides performance monitoring utilities:

```typescript
// Get performance metrics
const metrics = await testUtils.getPerformanceMetrics();
console.log("Load time:", metrics.loadTime);
console.log("DOM content loaded:", metrics.domContentLoaded);
console.log("First paint:", metrics.firstPaint);

// Get memory usage
const memory = await testUtils.getMemoryUsage();
console.log("Used JS heap size:", memory.usedJSHeapSize);
console.log("Total JS heap size:", memory.totalJSHeapSize);
```

### Performance Reports

Performance tests generate detailed reports including:

- Response time graphs
- Memory usage charts
- Load test results
- Performance benchmarks

## Best Practices

### 1. Test Design

- Use realistic test data
- Simulate real user behavior
- Test edge cases and error conditions
- Monitor performance over time

### 2. Test Execution

- Run tests in isolated environments
- Use consistent test conditions
- Monitor system resources
- Document performance baselines

### 3. Test Maintenance

- Update benchmarks regularly
- Monitor performance trends
- Investigate performance regressions
- Optimize slow tests

### 4. Test Data

- Use appropriate test data sizes
- Simulate realistic load patterns
- Test with various data types
- Clean up test data

## Performance Optimization

### Common Optimizations

1. **Lazy Loading**

   - Load components on demand
   - Defer non-critical resources
   - Use code splitting

2. **Caching**

   - Cache API responses
   - Use browser caching
   - Implement service workers

3. **Bundle Optimization**

   - Minimize bundle size
   - Remove unused code
   - Optimize images and assets

4. **Database Optimization**

   - Optimize queries
   - Use indexes
   - Implement pagination

5. **Memory Management**
   - Clean up event listeners
   - Dispose of resources
   - Use weak references

## Continuous Integration

### Performance Monitoring

Performance tests run automatically on:

- Pull requests
- Main branch pushes
- Release tags
- Scheduled runs

### Performance Alerts

Set up alerts for:

- Performance regressions
- Memory leaks
- Slow response times
- High resource usage

## Troubleshooting

### Common Issues

1. **Slow Tests**

   - Optimize test data
   - Reduce test complexity
   - Use parallel execution
   - Check system resources

2. **Memory Leaks**

   - Check event listeners
   - Verify resource cleanup
   - Monitor garbage collection
   - Use memory profiling

3. **Flaky Tests**

   - Add proper waits
   - Use stable selectors
   - Check for race conditions
   - Monitor test environment

4. **Performance Regressions**
   - Compare with baselines
   - Check recent changes
   - Monitor system resources
   - Investigate bottlenecks

### Getting Help

- Check performance test logs
- Use browser dev tools
- Monitor system resources
- Ask team members for assistance
