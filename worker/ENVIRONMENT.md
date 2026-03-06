# Environment Variable Mapping

## Overview

This document maps the environment variables used by the Telegram Mini App GraphQL backend.

## Variable Reference

### SALEOR_API_URL

- **Description**: GraphQL endpoint URL for the Saleor e-commerce platform
- **Type**: `string`
- **Required**: Yes
- **Example**: `https://your-storefront.saleor.cloud/graphql/`
- **Set Command**: `wrangler secret put SALEOR_API_URL`
- **Used In**: 
  - [`worker/src/saleorClient.ts`](worker/src/saleorClient.ts) - Saleor API client initialization
  - GraphQL resolvers that fetch product/category data

### SALEOR_TOKEN

- **Description**: API token for authenticating with Saleor
- **Type**: `string` (secret)
- **Required**: Yes
- **Set Command**: `wrangler secret put SALEOR_TOKEN`
- **Used In**:
  - [`worker/src/saleorClient.ts`](worker/src/saleorClient.ts) - Saleor API client authentication
  - Order creation mutations

### BACKEND_BASE_URL

- **Description**: Base URL for the backend service (used for webhooks, redirects)
- **Type**: `string`
- **Required**: No
- **Default**: `https://your-worker.subdomain.workers.dev`
- **Set Command**: `wrangler secret put BACKEND_BASE_URL`
- **Used In**:
  - Webhook handlers
  - URL generation for redirects

### TELEGRAM_BOT_TOKEN

- **Description**: Bot token from @BotFather for HMAC-SHA256 validation of Telegram Init Data
- **Type**: `string` (secret)
- **Required**: Yes (production)
- **Set Command**: `wrangler secret put TELEGRAM_BOT_TOKEN`
- **Used In**:
  - [`worker/src/auth.ts`](worker/src/auth.ts) - Telegram Init Data validation
  - Security: Verifies request authenticity

### DEBUG

- **Description**: Enable debug logging
- **Type**: `boolean` or `string`
- **Required**: No
- **Default**: `false`
- **Set Method**: Add to `wrangler.toml` `[vars]` section
- **Used In**:
  - Console logging throughout the application

## Local Development

For local development, create a `.dev.vars` file in the `worker/` directory:

```bash
# worker/.dev.vars
SALEOR_API_URL=https://your-saleor-storefront.example.com/graphql/
SALEOR_TOKEN=your-test-token
BACKEND_BASE_URL=http://localhost:8787
TELEGRAM_BOT_TOKEN=your-test-bot-token
DEBUG=true
```

## Production Deployment

Set secrets using Wrangler CLI:

```bash
# Interactive secret creation
wrangler secret put SALEOR_API_URL
wrangler secret put SALEOR_TOKEN
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put BACKEND_BASE_URL
```

Or use Cloudflare Dashboard:
1. Navigate to Workers > Your Worker > Settings > Variables
2. Add each secret under "Secret text"

## Environment Variable Access in Code

```typescript
// Access environment variables in Cloudflare Worker
const saleorApiUrl = ENV.SALEOR_API_URL;
const telegramBotToken = ENV.TELEGRAM_BOT_TOKEN;

// In worker/src/auth.ts
const TELEGRAM_BOT_TOKEN = typeof globalThis !== 'undefined' 
  ? (globalThis as any)?.TELEGRAM_BOT_TOKEN || "" 
  : "";
```

## KV Storage (Optional - Phase 3+)

If using KV for persistent cart storage:

```bash
# Create KV namespace
wrangler kv:namespace create CARTS

# Add binding to wrangler.toml
# [[kv_namespaces]]
# binding = "CARTS"
# id = "your-kv-namespace-id"
```
