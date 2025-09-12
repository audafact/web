/**
 * Run staging validation tests
 * This script can be executed to validate the staging environment
 */

import { stagingValidator } from "./test-staging-validation";

async function runStagingTests() {
  console.log("🚀 Starting Staging Environment Validation...\n");

  try {
    await stagingValidator.runAllTests();
  } catch (error) {
    console.error("❌ Error running staging tests:", error);
  }
}

// Run the tests
runStagingTests();
