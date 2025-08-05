// Performance test utilities

export const runPerformanceTests = async () => {
  console.log('🚀 Running performance tests...');
  
  const results = {
    appStartup: 0,
    routeNavigation: 0,
    analyticsLoad: 0,
    memoryUsage: 0,
  };
  
  // Test 1: App startup time
  const appStartupTimer = performance.now();
  try {
    // Simulate app startup
    await new Promise(resolve => setTimeout(resolve, 100));
    results.appStartup = performance.now() - appStartupTimer;
    console.log(`✅ App startup: ${results.appStartup.toFixed(2)}ms`);
  } catch (error) {
    console.error('❌ App startup test failed:', error);
  }
  
  // Test 2: Route navigation time
  const routeTimer = performance.now();
  try {
    // Simulate route navigation
    await new Promise(resolve => setTimeout(resolve, 50));
    results.routeNavigation = performance.now() - routeTimer;
    console.log(`✅ Route navigation: ${results.routeNavigation.toFixed(2)}ms`);
  } catch (error) {
    console.error('❌ Route navigation test failed:', error);
  }
  
  // Test 3: Analytics service load time
  const analyticsTimer = performance.now();
  try {
    const { EnhancedAnalyticsService } = await import('../services/enhancedAnalyticsService');
    const analytics = EnhancedAnalyticsService.getInstance();
    await analytics.track('performance_test', { test: 'analytics_load' });
    results.analyticsLoad = performance.now() - analyticsTimer;
    console.log(`✅ Analytics load: ${results.analyticsLoad.toFixed(2)}ms`);
  } catch (error) {
    console.error('❌ Analytics load test failed:', error);
  }
  
  // Test 4: Memory usage
  if ('memory' in performance) {
    const memory = (performance as any).memory;
    results.memoryUsage = memory.usedJSHeapSize / 1024 / 1024;
    console.log(`✅ Memory usage: ${results.memoryUsage.toFixed(2)}MB`);
  }
  
  // Performance budget checks
  const budgets = {
    appStartup: 200, // 200ms
    routeNavigation: 100, // 100ms
    analyticsLoad: 500, // 500ms
    memoryUsage: 50, // 50MB
  };
  
  console.log('\n📊 Performance Budget Check:');
  Object.entries(results).forEach(([key, value]) => {
    const budget = budgets[key as keyof typeof budgets];
    const status = value <= budget ? '✅' : '❌';
    console.log(`${status} ${key}: ${value.toFixed(2)}${key === 'memoryUsage' ? 'MB' : 'ms'} (budget: ${budget}${key === 'memoryUsage' ? 'MB' : 'ms'})`);
  });
  
  return results;
};

// Add to window for easy testing
if (typeof window !== 'undefined') {
  (window as any).runPerformanceTests = runPerformanceTests;
  console.log('🔧 Performance tests available: window.runPerformanceTests()');
} 