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

### Quick Start

```bash
# Terminal 1: Build and start dev server
cd worker
pnpm install
pnpm run build
pnpm run dev:local

# Terminal 2: Run tests (in a new terminal while server is running)
cd worker
pnpm test
```

### Running Tests

```bash
# Option 1: Start server and run tests in separate terminals
# Terminal 1: Start the dev server
cd worker && pnpm run dev:local

# Terminal 2: Run tests
cd worker && pnpm test

# Option 2: Run tests with explicitly set server URL
SPEC_KIT_BASE_URL=http://localhost:8787 pnpm test

# Option 3: Run specific test file
npx vitest run src/graphql.test.ts
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

#### Auto-deploy on Push to Main Branch (Git Repository)

To set up automatic deployment when pushing to the main branch via GitHub/GitLab/Bitbucket:

**1. Connect Repository to Cloudflare:**
- Go to Cloudflare Dashboard → Workers & Pages → Create Application → Connect to Git
- Select your Git provider and authorize Cloudflare
- Select your repository (`saleor-tma-backend`)

**2. Configure Build Settings:**

| Setting | Value |
|---------|-------|
| **Production branch** | `main` |
| **Build command** | `pnpm install` |
| **Build output directory** | `worker/dist` |

> **Note**: The project has a root `package.json` that orchestrates the `worker/` subdirectory. If using npm instead of pnpm, use `npm install`.

**3. Configure Environment Variables:**
In Cloudflare Dashboard → Your Worker → Settings → Environment Variables:

| Variable | Value | Type |
|----------|-------|------|
| `DEBUG` | `false` | Variable |
| `SALEOR_API_URL` | (your Saleor API URL) | Secret |
| `SALEOR_TOKEN` | (your Saleor token) | Secret |
| `TELEGRAM_BOT_TOKEN` | (your Telegram bot token) | Secret |

**4. Set KV Namespace for Production:**
Create a KV namespace in Cloudflare Dashboard:
```bash
wrangler kv:namespace create CARTS
```
Then update the `wrangler.toml` with the production KV namespace ID.

**5. Verify Deployment:**
- Push a commit to the main branch
- Cloudflare will automatically build and deploy
- Check deployment status in Cloudflare Dashboard → Workers & Pages

**6. Alternative: Deployments Tab (Pages)**
If using Cloudflare Pages instead of Workers:
- Go to Cloudflare Dashboard → Workers & Pages → Select your project
- Go to "Deployments" tab
- Click "Retry deployment" to re-deploy from a specific commit

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

## GraphQL Error Reference

All GraphQL responses that encounter errors follow a standardized format. Errors are returned in the `errors` array of the response.

### Error Response Format

```json
{
  "errors": [
    {
      "message": "Human-readable error description",
      "code": "ERROR_CODE",
      "field": "optional_field_name",
      "internalId": "optional_internal_trace_id"
    }
  ]
}
```

### Error Codes

| Code | HTTP Status | Description | Common Causes |
|------|-------------|-------------|--------------|
| `UNAUTHENTICATED` | 401 | Authentication required | Missing or invalid `X-Telegram-Init-Data` header |
| `FORBIDDEN` | 403 | Permission denied | Valid auth but user lacks required permissions |
| `BAD_USER_INPUT` | 400 | Invalid input | Malformed request body, missing required fields, invalid values |
| `NOT_FOUND` | 404 | Resource not found | Requested restaurant, category, or dish ID doesn't exist |
| `RATE_LIMITED` | 429 | Too many requests | (Reserved for future use) |
| `INTERNAL_ERROR` | 500 | Server error | Unexpected failures with internal tracking ID |

### Error Fields

| Field | Type | Description |
|-------|------|-------------|
| `message` | string | Human-readable description of what went wrong |
| `code` | enum | Standardized error code (see table above) |
| `field` | string? | Which input field caused the error (for `BAD_USER_INPUT`) |
| `internalId` | string? | Internal tracking ID for support (for `INTERNAL_ERROR`) |

### Example Error Responses

**Missing Authentication:**
```json
{
  "errors": [
    {
      "message": "Authentication required. Please refresh the page.",
      "code": "UNAUTHENTICATED"
    }
  ]
}
```

**Invalid Input:**
```json
{
  "errors": [
    {
      "message": "Invalid quantity",
      "code": "BAD_USER_INPUT",
      "field": "quantity"
    }
  ]
}
```

**Resource Not Found:**
```json
{
  "errors": [
    {
      "message": "The requested item was not found.",
      "code": "NOT_FOUND"
    }
  ]
}
```

**Internal Server Error:**
```json
{
  "errors": [
    {
      "message": "Something went wrong. Please try again.",
      "code": "INTERNAL_ERROR",
      "internalId": "abc123def456"
    }
  ]
}
```

### Handling Errors in Client Code

```typescript
async function graphqlRequest(query: string, variables?: Record<string, unknown>) {
  const response = await fetch('/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Init-Data': telegramInitData,
    },
    body: JSON.stringify({ query, variables }),
  });

  const result = await response.json();

  if (result.errors) {
    const error = result.errors[0];
    switch (error.code) {
      case 'UNAUTHENTICATED':
        // Redirect to re-authenticate
        break;
      case 'FORBIDDEN':
        // Show permission denied message
        break;
      case 'BAD_USER_INPUT':
        // Highlight the error.field and show error.message
        break;
      case 'NOT_FOUND':
        // Show "item not found" message
        break;
      default:
        // Generic error handling
        break;
    }
    throw new Error(error.message);
  }

  return result.data;
}
```

---

## What's Next

- Review [DECISION_LOG.md](DECISION_LOG.md) for architectural decisions
- Check [worker/ARCHITECTURE.md](worker/ARCHITECTURE.md) for detailed system design
- See [.planning/ROADMAP.md](.planning/ROADMAP.md) for v1.0 milestone progress
- See [task/phase-9-improve-code.md](task/phase-9-improve-code.md) for current improvements
