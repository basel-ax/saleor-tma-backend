# Architecture

**Analysis Date:** 2026-03-16

## Pattern Overview

**Overall:** Microservice API Gateway pattern implemented as a Cloudflare Worker

**Key Characteristics:**
- Single entry point handling GraphQL requests
- Telegram Mini App authentication middleware
- In-memory and KV-based data persistence
- Schema-first GraphQL API design

## Layers

**GraphQL API Layer:**
- Purpose: Expose restaurant ordering functionality through GraphQL
- Location: `worker/src/index.ts`, `worker/src/resolvers.ts`
- Contains: Request handlers, GraphQL context creation, resolver implementations
- Depends on: Auth layer, business logic modules
- Used by: Frontend applications

**Authentication Layer:**
- Purpose: Validate Telegram Mini App init data and create auth context
- Location: `worker/src/auth.ts`
- Contains: Init data validation, permission checking, user identity extraction
- Depends on: Environment variables (TELEGRAM_BOT_TOKEN)
- Used by: All other layers requiring user identity

**Business Logic Layer:**
- Purpose: Core restaurant ordering functionality
- Location: `worker/src/resolvers.ts`, `worker/src/cart.ts`, `worker/src/saleorOrder.ts`
- Contains: Cart management, order placement, data mapping
- Depends on: Auth layer, contracts layer
- Used by: GraphQL resolvers

**Contracts Layer:**
- Purpose: Define shared data structures and types
- Location: `worker/src/contracts.ts`
- Contains: TypeScript interfaces for restaurants, dishes, orders, auth contexts
- Depends on: None
- Used by: All other layers

**Persistence Layer:**
- Purpose: Store cart and order data
- Location: `worker/src/cart.ts` (with KV integration in `wrangler.toml`)
- Contains: In-memory cart implementation with fallback KV storage
- Depends on: KV namespace bindings
- Used by: Business logic layer

## Data Flow

**GraphQL Request Processing:**

1. HTTP request arrives at `/graphql` endpoint (`worker/src/index.ts`)
2. `extractAuthContext()` validates X-Telegram-Init-Data header
3. Auth context is passed to GraphQL resolvers
4. Resolvers access user-specific data using auth context
5. Response is returned with proper error handling

**Cart Operations:**

1. Authenticated user performs cart operation (addToCart, removeFromCart, etc.)
2. Operation is validated against user's permission level
3. Cart data is updated in memory and/or KV storage
4. Updated cart state is returned to user

**Order Placement:**

1. Authenticated user calls `placeOrder` mutation
2. System validates cart state and delivery information
3. Cart items are converted to Saleor order format
4. Order is created in Saleor backend
5. Cart is cleared for the user

## Key Abstractions

**GraphQL Context:**
- Purpose: Propagate authentication and user context through GraphQL execution
- Examples: `worker/src/contracts.ts`, `worker/src/index.ts`
- Pattern: Request-scoped context object containing auth information

**Auth Context:**
- Purpose: Represent authenticated user state with permission checking
- Examples: `worker/src/auth.ts`, `worker/src/contracts.ts`
- Pattern: Valid/invalid flag with user details and permission enforcement

**Cart State:**
- Purpose: Store user's shopping cart with restaurant isolation
- Examples: `worker/src/cart.ts`, `worker/src/resolvers.ts`
- Pattern: User ID-keyed cart with restaurant-level restrictions

## Entry Points

**Worker Handler:**
- Location: `worker/src/index.ts` (handleRequest function)
- Triggers: HTTP requests to the Cloudflare Worker
- Responsibilities: Auth validation, GraphQL execution, response formatting

## Error Handling

**Strategy:** Structured error handling with standardized codes and internal IDs

**Patterns:**
- AppError base class with specific error types
- Internal ID tracking for debugging
- Standardized HTTP status codes (401, 403, 500)
- Request-scoped error correlation with UUIDs

## Cross-Cutting Concerns

**Logging:** Centralized logger in `worker/src/logger.ts` with structured auth event tracking
**Validation:** Input validation occurs in resolvers with early returns for invalid data
**Authentication:** Centralized init data validation with permission-based access control

---

*Architecture analysis: 2026-03-16*