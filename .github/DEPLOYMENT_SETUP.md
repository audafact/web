# GitHub Actions Deployment Setup

This project has separate GitHub Actions workflows for the frontend (Cloudflare Pages) and worker (Cloudflare Workers) deployments.

## Frontend Workflows (web/.github/workflows/)

### 1. Production Deployment (`deploy-frontend.yml`)

- **Trigger**: Pushes to `main` branch
- **Target**: Production Cloudflare Pages (`audafact-web-prod`)
- **Build**: Uses `npm run build:production`
- **Manual**: Can be triggered manually via GitHub Actions UI

### 2. Staging Deployment (`deploy-frontend-staging.yml`)

- **Trigger**: Pushes to `develop` or `staging` branches, PRs to `main`
- **Target**: Staging Cloudflare Pages (`audafact-web-staging`)
- **Build**: Uses `npm run build:staging`
- **Manual**: Can be triggered manually via GitHub Actions UI

## Worker Workflows (worker/.github/workflows/)

### 1. Production Deployment (`deploy-worker.yml`)

- **Trigger**: Pushes to `main` branch
- **Target**: Production worker using `wrangler.toml`
- **Manual**: Can be triggered manually via GitHub Actions UI

### 2. Staging Deployment (`deploy-staging.yml`)

- **Trigger**: Pushes to `develop` or `staging` branches, PRs to `main`
- **Target**: Staging worker using `wrangler.staging.toml`
- **Manual**: Can be triggered manually via GitHub Actions UI

## Repository Structure

```
project-root/
├── web/                    # Frontend application
│   ├── .github/
│   │   └── workflows/
│   │       ├── deploy-frontend.yml
│   │       ├── deploy-frontend-staging.yml
│   │       └── visual-regression.yml
│   ├── src/
│   ├── package.json
│   └── ...
└── worker/                # Cloudflare Worker (separate deployment)
    ├── .github/
    │   └── workflows/
    │       ├── deploy-worker.yml
    │       └── deploy-staging.yml
    ├── src/
    ├── package.json
    ├── wrangler.toml
    ├── wrangler.staging.toml
    └── wrangler.preview.toml
```

Each directory has its own GitHub Actions workflows and deployment process.

## Required GitHub Secrets

Both the frontend and worker repositories need the following secrets:

### Setting up secrets:

1. Go to your GitHub repository
2. Navigate to **Settings** > **Secrets and variables** > **Actions**
3. Click **New repository secret** for each of the following:

#### `CLOUDFLARE_API_TOKEN`

- **Value**: Your Cloudflare API token with the following permissions:
  - `Cloudflare Workers:Edit` (for worker deployments)
  - `Cloudflare Pages:Edit` (for frontend deployments)
  - `Account:Read`
  - `Zone:Read` (if using custom domains)
- **How to get it**:
  1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/profile/api-tokens)
  2. Click "Create Token"
  3. Use "Custom token" template
  4. Add the permissions listed above
  5. Set Account Resources to "Include - Your Account"
  6. Set Zone Resources to "Include - All zones" (or specific zones if preferred)

#### `CLOUDFLARE_ACCOUNT_ID`

- **Value**: Your Cloudflare Account ID (`829b50f2f5c67ed26ec5cc89af772064`)
- **How to get it**:
  1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
  2. Select any domain or go to the Workers & Pages section
  3. Copy the Account ID from the right sidebar

## Deployment Process

### Frontend Deployments

- **Production**: Push to `main` branch in web repository → deploys to `audafact-web-prod`
- **Staging**: Push to `develop`/`staging` branches → deploys to `audafact-web-staging`

### Worker Deployments

- **Production**: Push to `main` branch in worker repository → deploys using `wrangler.toml`
- **Staging**: Push to `develop`/`staging` branches → deploys using `wrangler.staging.toml`

### Manual Deployments

1. Go to **Actions** tab in the respective GitHub repository
2. Select the workflow you want to run
3. Click **Run workflow**
4. Choose the branch and click **Run workflow**

## Environment Configuration

### Frontend (Cloudflare Pages)

- Uses your existing multi-environment system with `npm run build:production`, `npm run build:staging`
- Automatically detects environment and configures API URLs, Stripe keys, etc.

### Worker (Cloudflare Workers)

- **Production**: `wrangler.toml` (audafact-api-preview)
- **Staging**: `wrangler.staging.toml` (audafact-api-staging)
- **Preview**: `wrangler.preview.toml` (audafact-api-preview)

## Troubleshooting

### Common Issues:

1. **Authentication Failed**: Check that your API token has the correct permissions for both Pages and Workers
2. **Account ID Mismatch**: Verify the Account ID in your secrets matches your Cloudflare account
3. **Build Failures**: Check the Actions logs for specific error messages
4. **Project Names**: Ensure Cloudflare Pages project names match (`audafact-web-prod`, `audafact-web-staging`)

### Checking Deployment Status:

1. Go to **Actions** tab in GitHub to see workflow runs
2. Check [Cloudflare Pages Dashboard](https://dash.cloudflare.com/pages) for frontend deployments
3. Check [Cloudflare Workers Dashboard](https://dash.cloudflare.com/workers) for worker deployments
4. Monitor logs in Cloudflare Dashboard for runtime issues

## Local Development

### Frontend

```bash
cd web
npm install
npm run dev                    # Development
npm run build:production      # Build for production
npm run deploy:production     # Deploy using your existing script
```

### Worker

```bash
cd worker
npm install
npm run dev                   # Local development
npm run deploy               # Deploy to production
wrangler deploy --config wrangler.staging.toml  # Deploy to staging
```
