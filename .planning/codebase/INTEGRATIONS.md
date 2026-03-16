# External Integrations

**Analysis Date:** 2026-03-16

## APIs & External Services

**Telegram Bot API:**
- Telegram Mini Apps - User authentication via X-Telegram-Init-Data header
  - SDK/Client: Custom validation in `worker/src/auth.ts`
  - Auth: TELEGRAM_BOT_TOKEN environment variable

## Data Storage

**Databases:**
- Not implemented yet - Using in-memory data structures in `worker/src/resolvers.ts`
  - Connection: Not configured
  - Client: Not configured

**File Storage:**
- Local filesystem only - No external storage configured

**Caching:**
- None - Using in-memory storage in `worker/src/cart.ts`

## Authentication & Identity

**Auth Provider:**
- Telegram Mini Apps - Custom implementation
  - Implementation: HMAC-SHA256 validation of X-Telegram-Init-Data header in `worker/src/auth.ts`

## Monitoring & Observability

**Error Tracking:**
- Console logging - Basic logging implemented in `worker/src/auth.ts`
  - logger module in `worker/src/logger.ts` (referenced but not found)

**Logs:**
- Console output with structured logging for auth events

## CI/CD & Deployment

**Hosting:**
- Cloudflare Workers - Serverless deployment platform

**CI Pipeline:**
- Not configured - Manual deployment with wrangler

## Environment Configuration

**Required env vars:**
- TELEGRAM_BOT_TOKEN - Telegram bot token for init data validation
- SPEC_KIT_BASE_URL - Base URL for test configuration

**Secrets location:**
- Cloudflare Worker environment variables

## Webhooks & Callbacks

**Incoming:**
- GraphQL endpoint `/graphql` - Handles queries and mutations in `worker/src/index.ts` (not found but referenced in tests)

**Outgoing:**
- Saleor Order Creation - Mock implementation in `worker/src/saleorOrder.ts`

---

*Integration audit: 2026-03-16*