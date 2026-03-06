# Phase 6: Deployment Scaffolding Guide

## Overview

This document provides Cloudflare Workers deployment scaffolding and local dev/test workflow for the Telegram Mini App GraphQL backend.

## Prerequisites

- Node.js 18+ 
- npm or pnpm
- Wrangler CLI (`npm install -g wrangler`)
- Cloudflare account

## Quick Start

### 1. Local Development

```bash
# Navigate to worker directory
cd worker

# Install dependencies
npm install

# Copy environment variables template
cp .dev.vars.example .dev.vars

# Edit .dev.vars with your values (see Environment Variables section)

# Start local development server
wrangler dev
```

The worker will be available at `http://localhost:8787`

### 2. Run Tests Against Local Endpoint

```bash
# In worker directory, with wrangler dev running in another terminal:
SPEC_KIT_BASE_URL=http://localhost:8787 npm test
```

### 3. Deploy to Cloudflare Workers

```bash
# Deploy to production
wrangler deploy

# Or with environment-specific configuration
wrangler deploy --env production
```

## Environment Variables

### Required Variables

| Variable | Description | How to Set |
|----------|-------------|------------|
| `SALEOR_API_URL` | GraphQL endpoint for Saleor e-commerce platform | `wrangler secret put SALEOR_API_URL` |
| `SALEOR_TOKEN` | API token for Saleor authentication | `wrangler secret put SALEOR_TOKEN` |
| `TELEGRAM_BOT_TOKEN` | Bot token for HMAC validation of Telegram Init Data | `wrangler secret put TELEGRAM_BOT_TOKEN` |

### Optional Variables

| Variable | Description | How to Set |
|----------|-------------|------------|
| `BACKEND_BASE_URL` | Base URL for the backend (webhooks, redirects) | `wrangler secret put BACKEND_BASE_URL` |
| `DEBUG` | Enable debug logging (`true`/`false`) | Add to wrangler.toml `[vars]` |

## Wrangler Configuration

The project uses `wrangler.toml` at the root with TypeScript build target:

```toml
name = "tma-graphql-worker"
main = "src/index.ts"
compatibility_date = "2026-03-06"
workers_dev = true

[build]
command = "npm run build"
cwd = "./worker"

[build.upload]
format = "modules"
```

## Production Deployment Steps

1. **Set secrets** (required for production):
   ```bash
   wrangler secret put SALEOR_API_URL
   wrangler secret put SALEOR_TOKEN
   wrangler secret put TELEGRAM_BOT_TOKEN
   ```

2. **Deploy**:
   ```bash
   wrangler deploy
   ```

3. **Verify deployment**:
   ```bash
   # Test the deployed endpoint
   curl -X POST https://your-worker.subdomain.workers.dev/graphql \
     -H "Content-Type: application/json" \
     -H "X-Telegram-Init-Data: auth_date=1700000000&hash=test_hash&user={\"id\":\"123456789\",\"first_name\":\"Test\"}" \
     -d '{"query":"{ restaurants { id name } }"}'
   ```

## Test Harness Integration

The project uses spec-kit for contract testing. Set `SPEC_KIT_BASE_URL` to point to your worker:

```bash
# For local testing
SPEC_KIT_BASE_URL=http://localhost:8787 npm test

# For production testing
SPEC_KIT_BASE_URL=https://your-worker.subdomain.workers.dev npm test
```

## Troubleshooting

### Worker not starting
- Ensure Wrangler is installed: `npm install -g wrangler`
- Verify wrangler.toml configuration
- Check that .dev.vars exists in worker directory

### Environment variables not loaded
- Ensure `.dev.vars` is in the worker directory (not root)
- Restart wrangler dev after modifying .dev.vars
- For production, use `wrangler secret put` commands

### TypeScript errors
- Run `npm run build` to see detailed errors
- Check tsconfig.json configuration

### Tests failing
- Verify worker is running on correct port (8787)
- Check that Telegram init data is valid
- Ensure all required headers are included
