#!/usr/bin/env node

/**
 * Phase 6 Test Runner
 *
 * Runs comprehensive tests for the R2 + Worker API migration
 * Includes unit tests, integration tests, mobile compatibility, and performance tests
 */

import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const testSuites = [
  {
    name: "Worker API Integration Tests",
    pattern: "test/services/workerApiService.test.ts",
    description:
      "Tests for Worker API endpoints (sign-file, sign-upload, delete-file)",
  },
  {
    name: "Media Flow Integration Tests",
    pattern: "test/integration/mediaFlow.test.ts",
    description: "End-to-end tests for upload → preview → delete flows",
  },
  {
    name: "Mobile Compatibility Tests",
    pattern: "test/mobile/mobileCompatibility.test.ts",
    description:
      "Tests for iOS Safari, Android Chrome, and mobile network conditions",
  },
  {
    name: "Performance Monitoring Tests",
    pattern: "test/performance/workerPerformance.test.ts",
    description: "Tests for Worker response times, throughput, and error rates",
  },
  {
    name: "Cost Tracking Tests",
    pattern: "test/analytics/costTracking.test.ts",
    description: "Tests for storage costs, bandwidth costs, and request costs",
  },
  {
    name: "Analytics Service Tests",
    pattern: "test/services/analyticsService.test.ts",
    description: "Tests for core analytics functionality and funnel tracking",
  },
  {
    name: "Error Monitor Tests",
    pattern: "test/services/errorMonitor.test.ts",
    description: "Tests for error tracking and monitoring capabilities",
  },
  {
    name: "Performance Monitor Tests",
    pattern: "test/services/performanceMonitor.test.ts",
    description: "Tests for performance metrics collection and monitoring",
  },
  {
    name: "Updated Studio Tests",
    pattern: "test/views/Studio.test.tsx",
    description: "Updated Studio component tests with Worker API integration",
  },
  {
    name: "Waveform Display Tests",
    pattern: "test/views/WaveformDisplay.test.tsx",
    description: "Audio visualization component tests",
  },
  {
    name: "Track Controls Tests",
    pattern: "test/views/TrackControls.test.tsx",
    description: "Track control component tests",
  },
];

function runTestSuite(suite) {
  console.log(`\n🧪 Running ${suite.name}...`);
  console.log(`   ${suite.description}`);
  console.log("   " + "=".repeat(60));

  try {
    const command = `npx vitest run ${suite.pattern} --reporter=verbose`;
    execSync(command, {
      stdio: "inherit",
      cwd: path.join(__dirname, ".."),
      shell: true,
    });
    console.log(`✅ ${suite.name} - PASSED`);
    return true;
  } catch (error) {
    console.log(`❌ ${suite.name} - FAILED`);
    console.error(error.message);
    return false;
  }
}

function runAllTests() {
  console.log("🚀 Starting Phase 6 Test Suite");
  console.log("   Testing R2 + Worker API Migration");
  console.log("   " + "=".repeat(60));

  const results = [];

  for (const suite of testSuites) {
    const passed = runTestSuite(suite);
    results.push({ name: suite.name, passed });
  }

  // Summary
  console.log("\n📊 Test Results Summary");
  console.log("   " + "=".repeat(60));

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;

  results.forEach((result) => {
    const status = result.passed ? "✅ PASSED" : "❌ FAILED";
    console.log(`   ${result.name}: ${status}`);
  });

  console.log(`\n   Total: ${passed}/${total} test suites passed`);

  if (passed === total) {
    console.log(
      "\n🎉 All Phase 6 tests passed! Ready for production deployment."
    );
    process.exit(0);
  } else {
    console.log(
      "\n⚠️  Some tests failed. Please fix issues before proceeding."
    );
    process.exit(1);
  }
}

// Run specific test suite if argument provided
const args = process.argv.slice(2);
if (args.length > 0) {
  const suiteName = args[0];
  const suite = testSuites.find((s) =>
    s.name.toLowerCase().includes(suiteName.toLowerCase())
  );

  if (suite) {
    runTestSuite(suite);
  } else {
    console.log("Available test suites:");
    testSuites.forEach((s) => console.log(`  - ${s.name}`));
    process.exit(1);
  }
} else {
  runAllTests();
}
