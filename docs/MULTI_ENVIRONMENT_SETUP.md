# Multi-Environment Configuration Management System

This document describes the multi-environment configuration system that allows seamless switching between development, staging, preview, and production environments without manual configuration updates.

## Overview

The system automatically detects the current environment based on:

- Git branch name (`main` → production, `develop` → staging, feature branches → preview)
- Explicit environment override via `VITE_APP_ENV` variable
- Build mode and deployment context

## Environment Types

### Development (`development`)

- **Branch**: Any local development branch
- **Domain**: `localhost:5173`
- **API**: `http://localhost:5173/api/staging` (proxy)
- **CORS**: Localhost origins
- **Stripe**: Test mode

### Staging (`staging`)

- **Branch**: `develop`
- **Domain**: `staging.audafact.com`
- **API**: `https://audafact-api-staging.david-g-cortinas.workers.dev`
- **CORS**: `staging.audafact.com`
- **Stripe**: Test mode

### Preview (`preview`)

- **Branch**: Feature branches (e.g., `feature/new-ui`)
- **Domain**: `{branch}.audafact-web-prod.pages.dev`
- **API**: `https://audafact-api.david-g-cortinas.workers.dev`
- **CORS**: `{branch}.audafact-web-prod.pages.dev`
- **Stripe**: Test mode

### Production (`production`)

- **Branch**: `main`
- **Domain**: `audafact.com`
- **API**: `https://audafact-api.david-g-cortinas.workers.dev`
- **CORS**: `audafact.com`, `www.audafact.com`
- **Stripe**: Live mode

## Quick Start

### 1. Environment Detection

The system automatically detects your environment based on the current Git branch:

```bash
# Check current environment
npm run env:current

# List all available environments
npm run env:list
```

### 2. Development

```bash
# Start development server (auto-detects environment)
npm run dev

# Start with specific environment
npm run dev:staging
npm run dev:preview
npm run dev:production
```

### 3. Building

```bash
# Build for current environment
npm run build

# Build for specific environment
npm run build:staging
npm run build:preview
npm run build:production
```

### 4. Deployment

```bash
# Deploy to current environment (auto-detects from branch)
npm run deploy:env

# Deploy to specific environment
npm run deploy:staging
npm run deploy:preview
npm run deploy:production
```

## Configuration Files

### Frontend Configuration

- `config/environments.ts` - TypeScript environment definitions
- `config/development.json` - Development-specific settings
- `config/staging.json` - Staging-specific settings
- `config/preview.json` - Preview-specific settings
- `config/production.json` - Production-specific settings

### Worker Configuration

- `worker/config/environments.ts` - Worker environment definitions
- `worker/wrangler.toml` - Production worker config
- `worker/wrangler.staging.toml` - Staging worker config
- `worker/wrangler.preview.toml` - Preview worker config

## Environment Variables

The system automatically generates environment variables based on the current environment:

```typescript
// Automatically set based on environment
VITE_API_BASE_URL;
VITE_TURNSTILE_SITE_KEY;
VITE_SUPABASE_URL;
VITE_SUPABASE_ANON_KEY;
VITE_STRIPE_MODE;
VITE_APP_ENV;
VITE_DOMAIN;
VITE_CORS_ORIGINS;
```

## CORS Configuration

CORS origins are automatically configured based on the environment:

- **Development**: `localhost:5173`, `localhost:3000`, `localhost:4173`
- **Staging**: `staging.audafact.com`
- **Preview**: `{branch}.audafact-web-prod.pages.dev`
- **Production**: `audafact.com`, `www.audafact.com`

## Deployment Workflow

### Automatic Deployment

```bash
# Deploy based on current branch
npm run deploy:env
```

This command:

1. Detects current Git branch
2. Determines target environment
3. Updates CORS configuration
4. Builds the project
5. Deploys to appropriate Cloudflare Pages project

### Manual Deployment

```bash
# Deploy to specific environment
npm run deploy:staging
npm run deploy:preview
npm run deploy:production
```

## Environment Utilities

### Generate Environment File

```bash
# Generate .env file for current environment
npm run env:generate

# Generate .env file for specific environment
npm run env:generate staging
```

### Validate Configuration

```bash
# Validate specific environment configuration
npm run env:validate staging
```

### List Environments

```bash
# List all available environments
npm run env:list
```

### Test Environment System

```bash
# Run comprehensive tests of the environment system
npm run env:test
```

## Branch-Based Deployment

The system automatically maps Git branches to environments:

| Branch Pattern | Environment | Cloudflare Project     |
| -------------- | ----------- | ---------------------- |
| `main`         | production  | `audafact-web-prod`    |
| `develop`      | staging     | `audafact-web-staging` |
| `feature/*`    | preview     | `audafact-web-prod`    |
| `bugfix/*`     | preview     | `audafact-web-prod`    |
| `hotfix/*`     | preview     | `audafact-web-prod`    |

## Worker Configuration

The worker automatically adapts its CORS configuration based on the environment:

- **Production**: Allows `audafact.com` and `www.audafact.com`
- **Staging**: Allows `staging.audafact.com`
- **Preview**: Allows `*.audafact-web-prod.pages.dev` (wildcard)
- **Development**: Allows localhost origins

## Troubleshooting

### Environment Not Detected

```bash
# Check current branch
git branch --show-current

# Force specific environment
VITE_APP_ENV=staging npm run dev
```

### CORS Issues

1. Check that the origin is in the environment's CORS configuration
2. Verify the worker is deployed with the correct environment
3. Check browser developer tools for CORS error details

### Build Issues

1. Ensure all environment variables are properly set
2. Check that the environment configuration is valid
3. Run `npm run env:validate <environment>` to check configuration

## Best Practices

1. **Always use the automatic deployment** (`npm run deploy:env`) for consistency
2. **Test in staging** before deploying to production
3. **Use feature branches** for development and testing
4. **Keep environment configurations in sync** across frontend and worker
5. **Monitor CORS errors** in production logs

## Migration from Manual Configuration

If you're migrating from manual configuration:

1. **Backup current configurations** before making changes
2. **Test each environment** thoroughly after migration
3. **Update deployment scripts** to use the new system
4. **Train team members** on the new workflow

## Support

For issues or questions about the multi-environment system:

1. Check this documentation
2. Run `npm run env:current` to verify environment detection
3. Check the environment configuration files
4. Review the deployment logs for errors
