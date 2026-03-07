# Telegram TMA GraphQL Backend - Documentation Index

## Overview

This is the central documentation hub for the Telegram Mini App GraphQL backend built on Cloudflare Workers. The backend serves as a BFF (Backend-for-Frontend) between the Telegram Mini App frontend and Saleor's order-management API.

## Quick Links

| Category | Documentation |
|----------|---------------|
| **Getting Started** | [README.md](README.md), [IMPLEMENTATION.md](IMPLEMENTATION.md) |
| **Architecture** | [worker/ARCHITECTURE.md](worker/ARCHITECTURE.md) |
| **API Contract** | [specs/01-api-contract.md](specs/01-api-contract.md) |
| **Testing** | [worker/TESTING.md](worker/TESTING.md) |
| **Deployment** | [worker/DEPLOYMENT.md](worker/DEPLOYMENT.md) |
| **Environment** | [worker/ENVIRONMENT.md](worker/ENVIRONMENT.md) |
| **Decision Log** | [DECISION_LOG.md](DECISION_LOG.md) |
| **Agent Guides** | [AGENTS.md](AGENTS.md) |

---

## Spec-to-Code Reference

This section maps each specification document to its corresponding implementation.

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

---

## Development Setup

### Prerequisites
- Node.js (latest LTS)
- Wrangler CLI (`npm install -g wrangler`)

### Local Development

```bash
# Install dependencies
cd worker && npm install

# Copy environment template
cp .dev.vars.example .dev.vars

# Start local dev server
wrangler dev
```

GraphQL endpoint: `http://localhost:8787/graphql`

### Running Tests

```bash
# Contract tests with spec-kit
cd worker && npm test

# Or with custom URL
SPEC_KIT_BASE_URL=http://localhost:8787 npm test
```

### Deployment

```bash
# Set production secrets
wrangler secret put SALEOR_API_URL
wrangler secret put SALEOR_TOKEN
wrangler secret put TELEGRAM_BOT_TOKEN

# Deploy
wrangler deploy
```

---

## What's Next

- Review [DECISION_LOG.md](DECISION_LOG.md) for architectural decisions
- Check [worker/ARCHITECTURE.md](worker/ARCHITECTURE.md) for detailed system design
- See [task/phase-9-improve-code.md](task/phase-9-improve-code.md) for future improvements
