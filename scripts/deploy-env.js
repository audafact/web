#!/usr/bin/env node

/**
 * Environment-Aware Deployment Script
 *
 * This script automatically detects the current environment based on the Git branch
 * and deploys to the appropriate Cloudflare Pages project.
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import environment utilities
import {
  getCurrentBranch,
  getEnvironmentFromBranch,
  loadEnvironmentConfig,
  substituteVariables,
} from "./env-utils.js";

/**
 * Deploy to Cloudflare Pages
 */
function deployToCloudflare(environment, projectName) {
  console.log(`🚀 Deploying to ${environment} environment...`);
  console.log(`📦 Project: ${projectName}`);

  try {
    // Build the project for the specific environment
    console.log("🔨 Building project...");
    execSync(`VITE_APP_ENV=${environment} npm run build`, {
      stdio: "inherit",
      cwd: process.cwd(),
    });

    // Deploy to Cloudflare Pages
    console.log("☁️  Deploying to Cloudflare Pages...");
    execSync(`wrangler pages deploy dist --project-name=${projectName}`, {
      stdio: "inherit",
      cwd: process.cwd(),
    });

    console.log(`✅ Successfully deployed to ${environment}!`);
  } catch (error) {
    console.error(`❌ Deployment failed: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Update CORS configuration for the worker
 */
function updateCorsConfig(environment, config) {
  console.log(`🔧 Updating CORS configuration for ${environment}...`);

  const corsConfig = {
    rules: [
      {
        AllowedOrigins: config.corsOrigins,
        AllowedMethods: ["GET", "HEAD"],
        AllowedHeaders: ["*"],
        MaxAgeSeconds: 86400,
      },
    ],
  };

  const corsPath = path.join(__dirname, "..", "..", "worker", "cors.json");
  fs.writeFileSync(corsPath, JSON.stringify(corsConfig, null, 2));

  console.log(
    `✅ CORS configuration updated for origins: ${config.corsOrigins.join(
      ", "
    )}`
  );
}

/**
 * Update worker configuration
 */
function updateWorkerConfig(environment, config) {
  console.log(`🔧 Updating worker configuration for ${environment}...`);

  const wranglerPath = path.join(
    __dirname,
    "..",
    "..",
    "worker",
    "wrangler.toml"
  );
  let wranglerContent = fs.readFileSync(wranglerPath, "utf8");

  // Update worker name based on environment
  const workerName =
    environment === "production"
      ? "audafact-api"
      : `audafact-api-${environment}`;
  wranglerContent = wranglerContent.replace(
    /^name = ".*"$/m,
    `name = "${workerName}"`
  );

  fs.writeFileSync(wranglerPath, wranglerContent);

  console.log(`✅ Worker configuration updated: ${workerName}`);
}

/**
 * Main deployment function
 */
function main() {
  const args = process.argv.slice(2);
  const forceEnvironment = args[0];

  console.log("🌍 Multi-Environment Deployment System");
  console.log("=====================================");

  // Get current branch and environment
  const branch = getCurrentBranch();
  const environment = forceEnvironment || getEnvironmentFromBranch(branch);

  console.log(`📍 Current branch: ${branch}`);
  console.log(`🎯 Target environment: ${environment}`);

  // Load environment configuration
  const config = loadEnvironmentConfig(environment);
  const branchConfig = substituteVariables(config, { branch });

  console.log(`🏠 Domain: ${branchConfig.domain}`);
  console.log(`🔗 API URL: ${branchConfig.apiUrl}`);

  // Validate configuration
  if (!branchConfig.apiUrl || !branchConfig.corsOrigins.length) {
    console.error("❌ Invalid environment configuration");
    process.exit(1);
  }

  // Update configurations
  updateCorsConfig(environment, branchConfig);
  updateWorkerConfig(environment, branchConfig);

  // Determine project name based on environment
  let projectName;
  switch (environment) {
    case "production":
      projectName = "audafact-web-prod";
      break;
    case "staging":
      projectName = "audafact-web-staging";
      break;
    case "preview":
      projectName = "audafact-web-prod"; // Preview uses production project
      break;
    default:
      console.error(`❌ Unknown environment: ${environment}`);
      process.exit(1);
  }

  // Deploy
  deployToCloudflare(environment, projectName);

  // Show deployment info
  console.log("\n📋 Deployment Summary");
  console.log("====================");
  console.log(`Environment: ${environment}`);
  console.log(`Branch: ${branch}`);
  console.log(`Domain: ${branchConfig.domain}`);
  console.log(`API: ${branchConfig.apiUrl}`);
  console.log(`Project: ${projectName}`);

  if (environment === "preview") {
    console.log(
      `\n🔗 Preview URL: https://${branch}.audafact-web-prod.pages.dev`
    );
  }
}

// Run main function if this is the entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { deployToCloudflare, updateCorsConfig, updateWorkerConfig };
