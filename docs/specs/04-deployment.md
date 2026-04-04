Deployment Guide: TypeScript GraphQL Worker (Cloudflare)

Overview
- GraphQL Worker written in TypeScript, deployed to Cloudflare Workers using Wrangler.
- Backend Saleor API URL is configurable via config/env.
- Frontend (Telegram WebApp) consumes GraphQL API; Telegram Init Data is validated per request.

Prerequisites
- Node.js (latest LTS)
- Wrangler v2+ installed: `npm i -g wrangler`
- Access to Cloudflare account with a zone configured for the Worker (or use dev mode).

Wrangler setup
- Initialize a new project (or adapt existing):
  wrangler init tma-graphql-worker --site none
- Configure wrangler.toml with TS build target and compatible environment variables:
  - ACCOUNT_ID, NAMESPACE_ID (if using KV), ZONE_ID (optional)
  - type = "javascript" or "webpack" depending on build; use TS build via wrangler's TS support
- Add environment for local dev and production in wrangler.toml.

Build and run locally
- Install dependencies
  ```bash
  npm ci
  ```
- Start local dev server
  ```bash
  wrangler dev
  # Access at http://localhost:8787/
  ```
- Run specs against local endpoint:
  ```bash
  SPEC_KIT_BASE_URL=http://localhost:8787 npx spec-kit run specs
  ```

Deployment to Cloudflare Workers
- Publish the worker:
  ```bash
  wrangler publish
  ```
- Verify the deployed endpoint is accessible and specs pass in CI.

Environment variables (example)
- SALEOR_API_URL: https://your-saleor/graphql/
- SALEOR_TOKEN: your-saleor-token
- BACKEND_BASE_URL: https://your-saleor/graphql/
- TELEGRAM_BOT_TOKEN: your-telegram-bot-token
- GRAPHQL_SCHEMA_LOC: optional path if you host a local schema for validations
