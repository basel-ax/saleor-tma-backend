# Technology Stack

**Analysis Date:** 2026-03-16

## Languages

**Primary:**
- TypeScript 5.5.0 - Core application logic in `worker/src/`

**Secondary:**
- JavaScript - For configuration and build scripts

## Runtime

**Environment:**
- Node.js - For development and testing
- Cloudflare Workers - Production runtime environment

**Package Manager:**
- npm/pnpm - Dependency management
- Lockfile: `worker/package-lock.json` or `pnpm-lock.yaml`

## Frameworks

**Core:**
- Cloudflare Workers - Serverless runtime platform
- wrangler 3.97.0 - Cloudflare Workers CLI tool

**Testing:**
- vitest 2.0.0 - Unit and integration testing framework
- Vitest - Test runner with watch mode support

**Build/Dev:**
- TypeScript 5.5.0 - Transpilation and type checking
- wrangler - Development server and deployment

## Key Dependencies

**Critical:**
- @cloudflare/workers-types - TypeScript definitions for Cloudflare Workers API
- wrangler - Cloudflare Workers development toolkit

**Infrastructure:**
- vitest - Testing framework
- typescript - Type checking and transpilation

## Configuration

**Environment:**
- Cloudflare Worker environment variables
- TELEGRAM_BOT_TOKEN for authentication
- SPEC_KIT_BASE_URL for test configuration

**Build:**
- `tsconfig.json` - TypeScript compilation options
- `wrangler.toml` - Cloudflare Workers configuration (not found in current files)

## Platform Requirements

**Development:**
- Node.js 18+
- TypeScript 5.5+
- Cloudflare account for deployment

**Production:**
- Cloudflare Workers account
- Telegram Bot API token for authentication

---

*Stack analysis: 2026-03-16*