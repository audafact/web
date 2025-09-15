/**
 * Multi-Environment Configuration Management System
 *
 * This file defines environment-specific configurations that automatically
 * adapt based on the current Git branch and deployment context.
 */

export type Environment = "development" | "staging" | "preview" | "production";

export interface EnvironmentConfig {
  name: string;
  domain: string;
  apiUrl: string;
  turnstileSiteKey: string;
  corsOrigins: string[];
  stripeMode: "test" | "live";
  supabaseUrl: string;
  supabaseAnonKey: string;
  mediaBase: string;
  r2AccountId: string;
  r2Bucket: string;
}

/**
 * Environment configurations for each deployment context
 */
export const environments: Record<Environment, EnvironmentConfig> = {
  development: {
    name: "Development",
    domain: "localhost:5173",
    apiUrl: "http://localhost:5173/api/staging", // Use proxy for staging
    turnstileSiteKey: "0x4AAAAAABpJ3cypikhi7CPU",
    corsOrigins: [
      "http://localhost:5173",
      "http://localhost:3000",
      "http://localhost:4173",
    ],
    stripeMode: "test",
    supabaseUrl: "https://julxtxaspzhwbylnqkkj.supabase.co",
    supabaseAnonKey:
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1bHh0eGFzcHpod2J5bG5xa2tqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM3MzU3NzcsImV4cCI6MjA2OTMxMTc3N30.0KKAyMEeLFD3ZXq0REC_1Hp8G_cEO5igfHFW6YLzA4A",
    mediaBase: "https://media.audafact.com",
    r2AccountId: "829b50f2f5c67ed26ec5cc89af772064",
    r2Bucket: "audafact",
  },

  staging: {
    name: "Staging",
    domain: "staging.audafact.com",
    apiUrl: "https://audafact-api-staging.david-g-cortinas.workers.dev",
    turnstileSiteKey: "0x4AAAAAABpJ3cypikhi7CPU",
    corsOrigins: ["https://staging.audafact.com"],
    stripeMode: "test",
    supabaseUrl: "https://julxtxaspzhwbylnqkkj.supabase.co",
    supabaseAnonKey:
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1bHh0eGFzcHpod2J5bG5xa2tqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM3MzU3NzcsImV4cCI6MjA2OTMxMTc3N30.0KKAyMEeLFD3ZXq0REC_1Hp8G_cEO5igfHFW6YLzA4A",
    mediaBase: "https://media.audafact.com",
    r2AccountId: "829b50f2f5c67ed26ec5cc89af772064",
    r2Bucket: "audafact",
  },

  preview: {
    name: "Preview",
    domain: "${branch}.audafact-web-prod.pages.dev",
    apiUrl: "https://audafact-api.david-g-cortinas.workers.dev",
    turnstileSiteKey: "0x4AAAAAABpJ3cypikhi7CPU",
    corsOrigins: ["https://${branch}.audafact-web-prod.pages.dev"],
    stripeMode: "test",
    supabaseUrl: "https://julxtxaspzhwbylnqkkj.supabase.co",
    supabaseAnonKey:
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1bHh0eGFzcHpod2J5bG5xa2tqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM3MzU3NzcsImV4cCI6MjA2OTMxMTc3N30.0KKAyMEeLFD3ZXq0REC_1Hp8G_cEO5igfHFW6YLzA4A",
    mediaBase: "https://media.audafact.com",
    r2AccountId: "829b50f2f5c67ed26ec5cc89af772064",
    r2Bucket: "audafact",
  },

  production: {
    name: "Production",
    domain: "audafact.com",
    apiUrl: "https://audafact-api.david-g-cortinas.workers.dev",
    turnstileSiteKey: "0x4AAAAAABpJ3cypikhi7CPU",
    corsOrigins: ["https://audafact.com", "https://www.audafact.com"],
    stripeMode: "live",
    supabaseUrl: "https://julxtxaspzhwbylnqkkj.supabase.co",
    supabaseAnonKey:
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1bHh0eGFzcHpod2J5bG5xa2tqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM3MzU3NzcsImV4cCI6MjA2OTMxMTc3N30.0KKAyMEeLFD3ZXq0REC_1Hp8G_cEO5igfHFW6YLzA4A",
    mediaBase: "https://media.audafact.com",
    r2AccountId: "829b50f2f5c67ed26ec5cc89af772064",
    r2Bucket: "audafact",
  },
};

/**
 * Stripe configuration for different environments
 */
export const stripeConfig = {
  test: {
    productMonthly: "prod_test_monthly",
    productYearly: "prod_test_yearly",
    productEarlyAdopter: "prod_test_early_adopter",
    priceMonthly: "price_test_monthly",
    priceYearly: "price_test_yearly",
    priceEarlyAdopter: "price_test_early_adopter",
  },
  live: {
    productMonthly: "prod_live_monthly",
    productYearly: "prod_live_yearly",
    productEarlyAdopter: "prod_live_early_adopter",
    priceMonthly: "price_live_monthly",
    priceYearly: "price_live_yearly",
    priceEarlyAdopter: "price_live_early_adopter",
  },
};

/**
 * Auto-detect environment based on Git branch and build context
 */
export function getEnvironment(): Environment {
  // Check for explicit environment override
  const envOverride = process.env.VITE_APP_ENV as Environment;
  if (envOverride && environments[envOverride]) {
    return envOverride;
  }

  // Check for Vite mode
  const mode = process.env.NODE_ENV || process.env.MODE;
  if (mode === "staging") return "staging";
  if (mode === "production") return "production";

  // Auto-detect based on Git branch (if available)
  try {
    const branch = getCurrentBranch();
    if (branch === "main") return "production";
    if (branch === "develop") return "staging";
    return "preview"; // feature branches
  } catch (error) {
    // Fallback to development if Git detection fails
    return "development";
  }
}

/**
 * Get current Git branch name
 */
function getCurrentBranch(): string {
  try {
    const { execSync } = require("child_process");
    return execSync("git rev-parse --abbrev-ref HEAD", {
      encoding: "utf8",
    }).trim();
  } catch (error) {
    console.warn(
      "Could not detect Git branch, falling back to development environment"
    );
    return "development";
  }
}

/**
 * Get environment configuration with variable substitution
 */
export function getEnvironmentConfig(branch?: string): EnvironmentConfig {
  const env = getEnvironment();
  const config = { ...environments[env] };

  // Substitute branch variables for preview environment
  if (env === "preview" && branch) {
    config.domain = config.domain.replace("${branch}", branch);
    config.corsOrigins = config.corsOrigins.map((origin) =>
      origin.replace("${branch}", branch)
    );
  }

  return config;
}

/**
 * Get Stripe configuration for current environment
 */
export function getStripeConfig() {
  const env = getEnvironment();
  const config = getEnvironmentConfig();
  return stripeConfig[config.stripeMode];
}

/**
 * Validate environment configuration
 */
export function validateEnvironmentConfig(config: EnvironmentConfig): boolean {
  const required = [
    "name",
    "domain",
    "apiUrl",
    "turnstileSiteKey",
    "corsOrigins",
  ];
  return required.every((key) => config[key as keyof EnvironmentConfig]);
}
