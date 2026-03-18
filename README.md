# Telegram TMA GraphQL Backend - Documentation Index

## Overview

This is the central documentation hub for the Telegram Mini App GraphQL backend built on Cloudflare Workers. The backend serves as a BFF (Backend-for-Frontend) between the Telegram Mini App frontend and Saleor's order-management API.

## Core Features

- Restaurant browsing with categories and dishes
- Cart management with single-restaurant constraint
- Order placement with delivery location support
- Telegram authentication with proper error handling
- Saleor integration for order processing
- Cloudflare KV persistence for production deployment

## Development Setup

### Prerequisites
- Node.js (latest LTS)
- Wrangler CLI (`npm install -g wrangler`) - optional, see below

### Local Development

> **Note**: This project uses [pnpm](https://pnpm.io/) for dependency management due to link: dependencies in the worker directory. Using `npm install` will cause errors. Please use pnpm instead.

```bash
# Install dependencies (requires pnpm)
cd worker && pnpm install

# Copy environment template
cp worker/.dev.vars.example worker/.dev.vars
```

#### Option 1: Using Node.js (Recommended - works everywhere)

If `wrangler dev` doesn't work on your system (e.g., port binding issues), use this alternative:

```bash
# Build the worker
cd worker && pnpm run build

# Start local dev server (alternative to wrangler dev)
cd worker && pnpm run dev:local
```

The server will start at `http://localhost:8787`

**Example requests:**
```bash
# Restaurants
curl -X POST http://localhost:8787/graphql \
  -H "Content-Type: application/json" \
  -H "X-Telegram-Init-Data: hash=test&auth_date=$(date +%s)&user={\"id\":\"12345\",\"first_name\":\"Test\"}" \
  -d '{"query": "{ restaurants { id name } }"}'

# Categories
curl -X POST http://localhost:8787/graphql \
  -H "Content-Type: application/json" \
  -H "X-Telegram-Init-Data: hash=test&auth_date=$(date +%s)&user={\"id\":\"12345\",\"first_name\":\"Test\"}" \
  -d '{"query": "{ restaurantCategories(restaurantId: \"rest1\") { id name } }"}'

# Dishes
curl -X POST http://localhost:8787/graphql \
  -H "Content-Type: application/json" \
  -H "X-Telegram-Init-Data: hash=test&auth_date=$(date +%s)&user={\"id\":\"12345\",\"first_name\":\"Test\"}" \
  -d '{"query": "{ categoryDishes(restaurantId: \"rest1\", categoryId: \"cat1\") { id name price } }"}'
```

#### Option 2: Using Wrangler (Original)

```bash
# Start local dev server
wrangler dev
```

> **Note**: If wrangler dev fails with "Address already in use" errors, use Option 1 instead.

GraphQL endpoint: `http://localhost:8787/graphql`

### Running Tests

```bash
# Contract tests with spec-kit
cd worker && pnpm test

# Or with custom URL
SPEC_KIT_BASE_URL=http://localhost:8787 pnpm test
```

### Deployment

```bash
# Set production secrets
wrangler secret put SALEOR_API_URL
wrangler secret put SALEOR_TOKEN
wrangler secret put TELEGRAM_BOT_TOKEN

# Deploy manually
wrangler deploy
```

#### Auto-deploy on Push to Main Branch

To set up automatic deployment when pushing to the main branch:

1. **Connect your GitHub/GitLab repository to Cloudflare:**
   - Go to Cloudflare Dashboard → Workers & Pages
   - Select your worker (`tma-graphql-worker` or similar)
   - Go to "Settings" → "Git integration"
   - Connect your GitHub/GitLab account and select this repository
   - Set the production branch to `main`
   - Set the build command to `npm run build` (if using npm) or `pnpm run build` (if using pnpm)
   - Set the build output directory to `./worker` (if not already set)

2. **Configure environment variables in Cloudflare Dashboard:**
   - Go to your worker's "Settings" → "Variables"
   - Under "Secrets", add:
     - `SALEOR_API_URL`
     - `SALEOR_TOKEN`
     - `TELEGRAM_BOT_TOKEN`
   - Under "Environment Variables" (if needed):
     - `BACKEND_BASE_URL` (optional)
     - `DEBUG` (optional, set to `false` for production)

3. **Enable automatic deployments:**
   - In the Git integration settings, ensure "Deploy on push to main branch" is enabled
   - Optionally enable preview deployments for pull requests

4. **Verify the setup:**
   - Push a commit to the main branch
   - Cloudflare will automatically build and deploy your worker
   - Check the deployment logs in the Cloudflare dashboard for any issues

> **Note**: For local development, continue using `wrangler dev` as described in the Development Setup section.

---

## Spec-to-Code Reference

This section maps each specification document to its corresponding implementation.

| Category | Documentation |
|----------|---------------|
| **Project Planning** | [.planning/PROJECT.md](.planning/PROJECT.md), [.planning/ROADMAP.md](.planning/ROADMAP.md) |
| **Requirements** | [.planning/REQUIREMENTS.md](.planning/REQUIREMENTS.md), [.planning/STATE.md](.planning/STATE.md) |
| **Getting Started** | [README.md](README.md), [IMPLEMENTATION.md](IMPLEMENTATION.md) |
| **Architecture** | [worker/ARCHITECTURE.md](worker/ARCHITECTURE.md) |
| **API Contract** | [specs/01-api-contract.md](specs/01-api-contract.md) |
| **Testing** | [worker/TESTING.md](worker/TESTING.md) |
| **Deployment** | [worker/DEPLOYMENT.md](worker/DEPLOYMENT.md) |
| **Environment** | [worker/ENVIRONMENT.md](worker/ENVIRONMENT.md) |
| **Decision Log** | [DECISION_LOG.md](DECISION_LOG.md) |
| **Agent Guides** | [AGENTS.md](AGENTS.md) |

---

### Phase 1: Contract & API Skeleton

| Spec Document | Implementation File | Description |
|---------------|---------------------|-------------|
| [`specs/01-api-contract.md`](specs/01-api-contract.md) | [`worker/schema.graphql`](worker/schema.graphql) | GraphQL SDL schema definition |
| [`specs/01-api-contract.md`](specs/01-api-contract.md) | [`worker/src/contracts.ts`](worker/src/contracts.ts) | TypeScript interfaces for all types |
| [`specs/01-api-contract.md`](specs/01-api-contract.md) | [`worker/src/resolvers.ts`](worker/src/resolvers.ts) | Query and mutation resolvers |

### Phase 2: Telegram Auth & Context

| Spec Document | Implementation File | Description |
|---------------|---------------------|-------------|
| [`specs/05-telegram-auth.md`](specs/05-telegram-auth.md) | [`worker/src/auth.ts`](worker/src/auth.ts) | Telegram Init Data validation |
| [`specs/05-telegram-auth.md`](specs/05-telegram-auth.md) | [`worker/src/index.ts`](worker/src/index.ts) | GraphQL context creation with auth |
| [`specs/05-telegram-auth.md`](specs/05-telegram-auth.md) | [`worker/src/contracts.ts`](worker/src/contracts.ts) | `AuthContext`, `GraphQLContext` types |

### Phase 3: In-Memory Cart & State

| Spec Document | Implementation File | Description |
|---------------|---------------------|-------------|
| [`specs/02-interaction-flow.md`](specs/02-interaction-flow.md) | [`worker/src/cart.ts`](worker/src/cart.ts) | In-memory cart operations |
| [`specs/02-interaction-flow.md`](specs/02-interaction-flow.md) | [`worker/src/index.ts`](worker/src/index.ts) | Cart query/mutation handlers |
| [`specs/02-interaction-flow.md`](specs/02-interaction-flow.md) | [`worker/src/contracts.ts`](worker/src/contracts.ts) | `CartItem`, `CartState` types |

### Phase 4: Place Order Flow

| Spec Document | Implementation File | Description |
|---------------|---------------------|-------------|
| [`specs/02-interaction-flow.md`](specs/02-interaction-flow.md) | [`worker/src/saleorOrder.ts`](worker/src/saleorOrder.ts) | Saleor order creation |
| [`specs/02-interaction-flow.md`](specs/02-interaction-flow.md) | [`worker/src/index.ts`](worker/src/index.ts) | `placeOrder` mutation resolver |
| [`specs/01-api-contract.md`](specs/01-api-contract.md) | [`worker/src/contracts.ts`](worker/src/contracts.ts) | `PlaceOrderInput`, `PlaceOrderPayload` |

### Phase 5: Speckit Autotests

| Spec Document | Implementation File | Description |
|---------------|---------------------|-------------|
| [`specs/03-autotests-speckit.md`](specs/03-autotests-speckit.md) | [`worker/src/graphql.test.ts`](worker/src/graphql.test.ts) | Contract test suite |
| [`specs/03-autotests.md`](specs/03-autotests.md) | [`worker/src/testHelpers.ts`](worker/src/testHelpers.ts) | Test utilities and fixtures |
| [`specs/00-speckit-setup.md`](specs/00-speckit-setup.md) | [`specs/spec-kit.config.md`](specs/spec-kit.config.md) | Speckit configuration |

### Phase 6: Deployment Scaffolding

| Spec Document | Implementation File | Description |
|---------------|---------------------|-------------|
| [`specs/04-deployment.md`](specs/04-deployment.md) | [`worker/DEPLOYMENT.md`](worker/DEPLOYMENT.md) | Deployment guide |
| [`specs/04-deployment.md`](specs/04-deployment.md) | [`worker/ENVIRONMENT.md`](worker/ENVIRONMENT.md) | Environment variables |
| [`specs/04-deployment.md`](specs/04-deployment.md) | [`wrangler.toml`](wrangler.toml) | Worker configuration |

### Phase 7: Security Review & Hardening

| Spec Document | Implementation File | Description |
|---------------|---------------------|-------------|
| - | [`worker/src/errors.ts`](worker/src/errors.ts) | Standardized error codes |
| - | [`worker/src/logger.ts`](worker/src/logger.ts) | Structured logging |
| [`SEC_AGENT.md`](SEC_AGENT.md) | - | Security audit template |

---

## GraphQL Schema Reference

### Queries

| Operation | Spec Reference | Implementation |
|-----------|---------------|----------------|
| `restaurants(search: String)` | [`specs/01-api-contract.md`](specs/01-api-contract.md) | [`worker/src/index.ts:resolveRestaurants`](worker/src/index.ts) |
| `restaurantCategories(restaurantId: ID!)` | [`specs/01-api-contract.md`](specs/01-api-contract.md) | [`worker/src/index.ts:resolveCategories`](worker/src/index.ts) |
| `categoryDishes(restaurantId: ID!, categoryId: ID!)` | [`specs/01-api-contract.md`](specs/01-api-contract.md) | [`worker/src/index.ts:resolveDishes`](worker/src/index.ts) |
| `cart` | [`specs/02-interaction-flow.md`](specs/02-interaction-flow.md) | [`worker/src/index.ts:resolveCart`](worker/src/index.ts) |

### Mutations

| Operation | Spec Reference | Implementation |
|-----------|---------------|----------------|
| `placeOrder(input: PlaceOrderInput!)` | [`specs/01-api-contract.md`](specs/01-api-contract.md) | [`worker/src/index.ts:resolvePlaceOrder`](worker/src/index.ts) |
| `addToCart(input: AddToCartInput!)` | [`specs/02-interaction-flow.md`](specs/02-interaction-flow.md) | [`worker/src/index.ts:resolveAddToCart`](worker/src/index.ts) |
| `updateCartItem(input: UpdateCartItemInput!)` | [`specs/02-interaction-flow.md`](specs/02-interaction-flow.md) | [`worker/src/index.ts:resolveUpdateCartItem`](worker/src/index.ts) |
| `removeCartItem(dishId: ID!)` | [`specs/02-interaction-flow.md`](specs/02-interaction-flow.md) | [`worker/src/index.ts:resolveRemoveCartItem`](worker/src/index.ts) |
| `clearCart` | [`specs/02-interaction-flow.md`](specs/02-interaction-flow.md) | [`worker/src/index.ts:resolveClearCart`](worker/src/index.ts) |

---

## Data Flow Reference

```
Telegram Mini App
        │
        │ HTTP POST /graphql
        │ X-Telegram-Init-Data header
        ▼
┌───────────────────────────────────────┐
│ worker/src/index.ts                   │
│ - Validates auth (auth.ts)            │
│ - Routes to resolvers                 │
└───────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────┐
│ GraphQL Resolvers                     │
│ - Query: restaurants, categories...   │
│ - Mutation: placeOrder, cart ops      │
└───────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────┐
│ Data Sources                          │
│ - Cart: cart.ts (in-memory)           │
│ - Saleor: saleorClient.ts             │
└───────────────────────────────────────┘
```

---

## Key Concepts

- **GraphQL API Surface**: Exposed by the Worker at `/graphql`
- **Telegram Authentication**: Validates `X-Telegram-Init-Data` header
- **In-Memory Cart**: Per-user cart with single-restaurant constraint
- **Saleor Integration**: Thin HTTP client for order management
- **Production Ready**: Cloudflare KV persistence and Wrangler deployment

---

## What's Next

- Review [DECISION_LOG.md](DECISION_LOG.md) for architectural decisions
- Check [worker/ARCHITECTURE.md](worker/ARCHITECTURE.md) for detailed system design
- See [.planning/ROADMAP.md](.planning/ROADMAP.md) for v1.0 milestone progress
- See [task/phase-9-improve-code.md](task/phase-9-improve-code.md) for current improvements
