#!/usr/bin/env node

/**
 * Environment Management Utilities
 *
 * This script provides utilities for managing environment configurations,
 * including branch detection, environment switching, and validation.
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Get current Git branch name
 */
function getCurrentBranch() {
  try {
    return execSync("git rev-parse --abbrev-ref HEAD", {
      encoding: "utf8",
    }).trim();
  } catch (error) {
    console.warn('Could not detect Git branch, using "development"');
    return "development";
  }
}

/**
 * Get environment based on branch
 */
function getEnvironmentFromBranch(branch) {
  if (branch === "main") return "production";
  if (branch === "develop") return "staging";
  return "preview"; // feature branches
}

/**
 * Load environment configuration
 */
function loadEnvironmentConfig(env) {
  const configPath = path.join(__dirname, "..", "config", `${env}.json`);

  if (!fs.existsSync(configPath)) {
    throw new Error(`Environment configuration not found: ${configPath}`);
  }

  return JSON.parse(fs.readFileSync(configPath, "utf8"));
}

/**
 * Substitute variables in configuration
 */
function substituteVariables(config, variables = {}) {
  const result = JSON.parse(JSON.stringify(config));

  function substitute(obj) {
    for (const key in obj) {
      if (typeof obj[key] === "string") {
        obj[key] = obj[key].replace(/\$\{(\w+)\}/g, (match, varName) => {
          return variables[varName] || match;
        });
      } else if (typeof obj[key] === "object" && obj[key] !== null) {
        substitute(obj[key]);
      }
    }
  }

  substitute(result);
  return result;
}

/**
 * Generate environment variables for Vite
 */
function generateViteEnvVars(config) {
  const stripeConfig =
    config.stripeMode === "live"
      ? config.stripeProducts
      : config.stripeProducts;

  return {
    VITE_API_BASE_URL: config.apiUrl,
    VITE_TURNSTILE_SITE_KEY: config.turnstileSiteKey,
    VITE_SUPABASE_URL: config.supabaseUrl,
    VITE_SUPABASE_ANON_KEY: config.supabaseAnonKey,
    VITE_STRIPE_MODE: config.stripeMode,
    VITE_STRIPE_TEST_PRODUCT_MONTHLY: config.stripeProducts.monthly,
    VITE_STRIPE_TEST_PRODUCT_YEARLY: config.stripeProducts.yearly,
    VITE_STRIPE_TEST_PRODUCT_EARLY_ADOPTER: config.stripeProducts.earlyAdopter,
    VITE_STRIPE_TEST_PRICE_MONTHLY: config.stripePrices.monthly,
    VITE_STRIPE_TEST_PRICE_YEARLY: config.stripePrices.yearly,
    VITE_STRIPE_TEST_PRICE_EARLY_ADOPTER: config.stripePrices.earlyAdopter,
    VITE_STRIPE_LIVE_PRODUCT_MONTHLY: config.stripeProducts.monthly,
    VITE_STRIPE_LIVE_PRODUCT_YEARLY: config.stripeProducts.yearly,
    VITE_STRIPE_LIVE_PRODUCT_EARLY_ADOPTER: config.stripeProducts.earlyAdopter,
    VITE_STRIPE_LIVE_PRICE_MONTHLY: config.stripePrices.monthly,
    VITE_STRIPE_LIVE_PRICE_YEARLY: config.stripePrices.yearly,
    VITE_STRIPE_LIVE_PRICE_EARLY_ADOPTER: config.stripePrices.earlyAdopter,
    VITE_APP_ENV: config.name.toLowerCase(),
    VITE_DOMAIN: config.domain,
    VITE_CORS_ORIGINS: JSON.stringify(config.corsOrigins),
  };
}

/**
 * Generate .env file for current environment
 */
function generateEnvFile(env = null) {
  const environment = env || getEnvironmentFromBranch(getCurrentBranch());
  const branch = getCurrentBranch();

  console.log(
    `Generating .env file for ${environment} environment (branch: ${branch})`
  );

  const config = loadEnvironmentConfig(environment);
  const variables = { branch };
  const resolvedConfig = substituteVariables(config, variables);
  const envVars = generateViteEnvVars(resolvedConfig);

  const envContent = Object.entries(envVars)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const envPath = path.join(__dirname, "..", ".env");
  fs.writeFileSync(envPath, envContent);

  console.log(`✅ Generated .env file at ${envPath}`);
  console.log(`Environment: ${resolvedConfig.name}`);
  console.log(`Domain: ${resolvedConfig.domain}`);
  console.log(`API URL: ${resolvedConfig.apiUrl}`);
}

/**
 * Validate environment configuration
 */
function validateEnvironment(env) {
  const config = loadEnvironmentConfig(env);
  const required = [
    "name",
    "domain",
    "apiUrl",
    "turnstileSiteKey",
    "corsOrigins",
  ];

  const missing = required.filter((key) => !config[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required configuration: ${missing.join(", ")}`);
  }

  console.log(`✅ Environment ${env} is valid`);
  return true;
}

/**
 * List available environments
 */
function listEnvironments() {
  const configDir = path.join(__dirname, "..", "config");
  const files = fs.readdirSync(configDir).filter((f) => f.endsWith(".json"));
  const environments = files.map((f) => f.replace(".json", ""));

  console.log("Available environments:");
  environments.forEach((env) => {
    const config = loadEnvironmentConfig(env);
    console.log(`  - ${env}: ${config.name} (${config.domain})`);
  });
}

/**
 * Main CLI interface
 */
function main() {
  const command = process.argv[2];
  const arg = process.argv[3];

  switch (command) {
    case "generate":
      generateEnvFile(arg);
      break;
    case "validate":
      if (!arg) {
        console.error("Please specify an environment to validate");
        process.exit(1);
      }
      validateEnvironment(arg);
      break;
    case "list":
      listEnvironments();
      break;
    case "current":
      const branch = getCurrentBranch();
      const env = getEnvironmentFromBranch(branch);
      console.log(`Current branch: ${branch}`);
      console.log(`Detected environment: ${env}`);
      break;
    default:
      console.log("Environment Management Utilities");
      console.log("");
      console.log("Usage:");
      console.log(
        "  node scripts/env-utils.js generate [environment]  - Generate .env file"
      );
      console.log(
        "  node scripts/env-utils.js validate <environment>  - Validate environment config"
      );
      console.log(
        "  node scripts/env-utils.js list                    - List available environments"
      );
      console.log(
        "  node scripts/env-utils.js current                 - Show current branch and environment"
      );
      break;
  }
}

// Run main function if this is the entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export {
  getCurrentBranch,
  getEnvironmentFromBranch,
  loadEnvironmentConfig,
  substituteVariables,
  generateViteEnvVars,
  generateEnvFile,
  validateEnvironment,
  listEnvironments,
};
