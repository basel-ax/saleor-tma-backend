# Decision Log - Telegram TMA GraphQL Backend

This document records architectural and technical decisions made during development, including the rationale, alternatives considered, and consequences.

## How to Use This Log

When making significant technical decisions:

1. **Document the decision**: Fill in the template below for each new decision
2. **Include context**: What problem were we solving?
3. **Record alternatives**: What other options were considered?
4. **Note consequences**: What are the implications of this choice?

---

## Decision Template

```markdown
### YYYY-MM-DD: [Decision Title]

**Status**: [Proposed | Accepted | Deprecated | Superseded]

**Context**: [The problem or situation that prompted this decision]

**Decision**: [What was decided]

**Rationale**: [Why this decision was made]

**Alternatives Considered**:
- [Option 1]: [Brief description]
- [Option 2]: [Brief description]

**Consequences**:
- **Positive**: [Benefits]
- **Negative**: [Trade-offs or issues to watch]

**Related Documents**:
- [Link to specs or implementation details]

**Owner**: [Team or person responsible]
```

---

## Accepted Decisions

### 2026-03-07: In-Memory Cart for Initial Implementation

**Status**: Accepted

**Context**: Phase 3 required cart management. We needed a storage solution that works in Cloudflare Workers and is testable without external dependencies.

**Decision**: Use an in-memory `Map<string, CartState>` keyed by Telegram user ID for cart storage.

**Rationale**:
- Simple to implement and test
- No external dependencies required
- Fast read/write operations
- Sufficient for single-worker deployment
- Easy migration path to KV (same API shape)

**Alternatives Considered**:
- **Cloudflare KV**: Requires namespace creation and binding; adds deployment complexity
- **Durable Objects**: More complex setup, overkill for simple cart use case
- **External Redis**: Adds latency and requires connection management

**Consequences**:
- **Positive**: Simple, fast, easy to test
- **Negative**: Cart data lost on worker restart; not suitable for multi-instance deployment
- **Mitigation**: Document migration path to KV for production (see `worker/src/cart.ts` migration notes)

**Related Documents**:
- [`worker/src/cart.ts`](worker/src/cart.ts) - Cart implementation
- [`specs/02-interaction-flow.md`](specs/02-interaction-flow.md) - Cart flow specification

**Owner**: TS_CODE_AGENT

---

### 2026-03-07: Minimal GraphQL Surface

**Status**: Accepted

**Context**: We needed to define the GraphQL API surface for the Telegram Mini App. A minimal, frontend-driven approach was preferred over a comprehensive API.

**Decision**: Expose only these operations:
- Queries: `restaurants`, `restaurantCategories`, `categoryDishes`
- Mutations: `placeOrder`, `addToCart`, `updateCartItem`, `removeCartItem`, `clearCart`

**Rationale**:
- Frontend-driven design: what the UI needs, nothing more
- Reduced attack surface
- Easier to maintain and version
- Aligns with TMA best practices from `docs/graphql-api.md`

**Alternatives Considered**:
- **Full CRUD for all entities**: Over-engineered, exposes unnecessary operations
- **REST instead of GraphQL**: GraphQL provides better typing and flexible queries for this use case

**Consequences**:
- **Positive**: Simpler codebase, better frontend alignment, easier testing
- **Negative**: Less flexible for future use cases (can be extended later)

**Related Documents**:
- [`specs/01-api-contract.md`](specs/01-api-contract.md) - API contract
- [`worker/schema.graphql`](worker/schema.graphql) - Full schema

**Owner**: TS_CODE_AGENT

---

### 2026-03-07: Telegram Init Data Header Authentication

**Status**: Accepted

**Context**: Every GraphQL request must be authenticated. Telegram provides init data that can be validated server-side.

**Decision**: Use `X-Telegram-Init-Data` header for authentication, validate presence and expiration, defer full HMAC verification for production.

**Rationale**:
- Native to Telegram Mini Apps (no custom auth flow needed)
- Header-based approach works well with GraphQL
- Validates user identity without additional credentials
- 24-hour expiration provides reasonable security

**Alternatives Considered**:
- **JWT tokens**: Requires additional token management
- **Session cookies**: Less native to TMA context
- **API keys**: Doesn't provide user identity

**Consequences**:
- **Positive**: Native TMA integration, user identity available, simple implementation
- **Negative**: Skeleton implementation defers full HMAC verification (security TODO)

**Related Documents**:
- [`specs/05-telegram-auth.md`](specs/05-telegram-auth.md) - Auth contract
- [`worker/src/auth.ts`](worker/src/auth.ts) - Auth implementation

**Owner**: TS_CODE_AGENT

---

### 2026-03-07: Single-Restaurant Cart Constraint

**Status**: Accepted

**Context**: Users should only order from one restaurant at a time. When switching restaurants, we need to handle the existing cart.

**Decision**: Enforce single-restaurant cart by clearing the cart when a user adds items from a different restaurant. Allow frontend to handle confirmation UI.

**Rationale**:
- Logical constraint for food delivery (combined orders from multiple restaurants complicate logistics)
- Clear UX pattern: user must confirm cart reset when switching
- Simple implementation: compare restaurantId on add-to-cart

**Alternatives Considered**:
- **Allow multiple restaurants**: Complicates delivery logistics, not ideal for food delivery
- **Separate carts per restaurant**: UI complexity, user confusion

**Consequences**:
- **Positive**: Clear user expectation, simpler backend logic
- **Negative**: Requires frontend handling of restaurant-switch confirmation

**Related Documents**:
- [`worker/src/cart.ts`](worker/src/cart.ts) - Cart implementation with switch handling

**Owner**: TS_CODE_AGENT

---

### 2026-03-07: Standardized Error Codes

**Status**: Accepted

**Context**: We needed consistent error handling across the GraphQL API for both success and error cases.

**Decision**: Implement error codes mapped to HTTP status codes:
- `UNAUTHENTICATED` (401): Missing/invalid Telegram init data
- `INVALID_INPUT` (400): Invalid GraphQL input
- `NOT_FOUND` (404): Resource not found
- `INTERNAL_ERROR` (500): Unexpected server errors

**Rationale**:
- Follows HTTP semantics
- Easy for frontend to handle different error types
- Consistent with GraphQL error best practices

**Alternatives Considered**:
- **Custom error codes only**: Less intuitive, harder to debug
- **GraphQL errors without codes**: Less actionable for frontend

**Consequences**:
- **Positive**: Consistent error handling, easy debugging, frontend-friendly
- **Negative**: Need to maintain error code list

**Related Documents**:
- [`worker/src/errors.ts`](worker/src/errors.ts) - Error implementation

**Owner**: TS_CODE_AGENT

---

## Proposed Decisions (For Future Discussion)

_This section tracks decisions that need to be made but haven't been resolved yet._

### [Proposed]: KV Storage for Production Cart

**Context**: Current in-memory cart won't persist across worker restarts or scale beyond single instance.

**Options**:
1. Cloudflare KV (recommended)
2. Durable Objects
3. External Redis

**Impact**: Requires migration of `worker/src/cart.ts` functions

---

### [Proposed]: Full HMAC-SHA256 Telegram Validation

**Context**: Current auth validation checks expiration but doesn't verify hash signature.

**Options**:
1. Implement full HMAC verification (production required)
2. Use third-party validation service
3. Rely on Telegram's built-in security (not recommended)

**Impact**: Security hardening required before production

---

## Deprecated Decisions

_No deprecated decisions yet._

---

## Superseded Decisions

_No superseded decisions yet._

---

## Maintenance Notes

- Review this log quarterly for outdated decisions
- Update status when decisions are deprecated or superseded
- Include new decisions in commit messages (reference ADR)
