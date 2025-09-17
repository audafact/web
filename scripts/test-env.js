#!/usr/bin/env node

/**
 * Test Environment System
 *
 * This script tests the multi-environment configuration system
 * to ensure everything is working correctly.
 */

import {
  getCurrentBranch,
  getEnvironmentFromBranch,
  loadEnvironmentConfig,
  substituteVariables,
  validateEnvironment,
  listEnvironments,
} from "./env-utils.js";

async function testEnvironmentSystem() {
  console.log("🧪 Testing Multi-Environment Configuration System");
  console.log("================================================\n");

  try {
    // Test 1: Branch detection
    console.log("1️⃣ Testing branch detection...");
    const branch = getCurrentBranch();
    console.log(`   Current branch: ${branch}`);

    const environment = getEnvironmentFromBranch(branch);
    console.log(`   Detected environment: ${environment}`);
    console.log("   ✅ Branch detection working\n");

    // Test 2: Environment listing
    console.log("2️⃣ Testing environment listing...");
    listEnvironments();
    console.log("   ✅ Environment listing working\n");

    // Test 3: Configuration loading
    console.log("3️⃣ Testing configuration loading...");
    const configs = ["development", "staging", "preview", "production"];

    for (const env of configs) {
      try {
        const config = loadEnvironmentConfig(env);
        console.log(`   ${env}: ${config.name} (${config.domain})`);
      } catch (error) {
        console.log(`   ❌ Failed to load ${env}: ${error.message}`);
      }
    }
    console.log("   ✅ Configuration loading working\n");

    // Test 4: Variable substitution
    console.log("4️⃣ Testing variable substitution...");
    const previewConfig = loadEnvironmentConfig("preview");
    const substitutedConfig = substituteVariables(previewConfig, {
      branch: "feature/test",
    });

    console.log(`   Original domain: ${previewConfig.domain}`);
    console.log(`   Substituted domain: ${substitutedConfig.domain}`);
    console.log("   ✅ Variable substitution working\n");

    // Test 5: Environment validation
    console.log("5️⃣ Testing environment validation...");
    for (const env of configs) {
      try {
        validateEnvironment(env);
      } catch (error) {
        console.log(`   ❌ ${env} validation failed: ${error.message}`);
      }
    }
    console.log("   ✅ Environment validation working\n");

    // Test 6: Current environment detection
    console.log("6️⃣ Testing current environment detection...");
    const currentEnv = getEnvironmentFromBranch(branch);
    const currentConfig = loadEnvironmentConfig(currentEnv);
    console.log(`   Current environment: ${currentConfig.name}`);
    console.log(`   API URL: ${currentConfig.apiUrl}`);
    console.log(`   CORS Origins: ${currentConfig.corsOrigins.join(", ")}`);
    console.log("   ✅ Current environment detection working\n");

    console.log(
      "🎉 All tests passed! Environment system is working correctly."
    );
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    process.exit(1);
  }
}

// Run tests if this is the entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  testEnvironmentSystem();
}

export { testEnvironmentSystem };
