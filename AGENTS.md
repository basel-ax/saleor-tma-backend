# saleor-tma-backend — AGENTS.md

> **README for AI agents.** This file provides everything a coding agent needs
> to understand, build, extend, and debug this repository correctly.
> Human contributors should read `README.md` instead.

---

## 1. Project Overview

**saleor-tma-backend** is a stateless **GraphQL Backend-for-Frontend (BFF)**
written in **Go**, sitting between:

| Layer | Technology |
|---|---|
| Mobile frontend | Telegram Mini App (WebApp) — see `frontend-tma.md` |
| This BFF | Go + gqlgen GraphQL server |
| Order management | Saleor headless ecommerce (external GraphQL API) |

The BFF:
- Verifies every request using `X-Telegram-Init-Data` (Telegram WebApp signature)
- Exposes a **small, intentional GraphQL schema** for food ordering flows
- Maps BFF concepts (restaurants, categories, dishes, cart, order) onto
  Saleor's data model (categories, products, variants, draft orders)

Full domain mapping, API reference for AI agents, and example queries live in
`docs/graphql-api.md`. Frontend flows are in `frontend-tma.md`.

---

## 2. Repository Layout

```
saleor-tma-backend/
├── cmd/
│   └── api/
│       └── main.go                      # Main entrypoint — wires everything together
├── Dockerfile                           # Multi-stage container build
├── gqlgen.yml                           # gqlgen code-generation config
├── go.mod / go.sum                      # Go module
│
├── graph/
│   ├── schema.graphqls                  # ← ONLY file you edit to change the public API
│   ├── generate.go                      # //go:generate directive for gqlgen
│   ├── resolver.go                      # TMAService interface, Resolver struct, shared helpers
│   ├── schema.resolvers.go              # Resolver implementations; partially regenerated
│   ├── generated.go                     # ⛔ AUTO-GENERATED — never edit by hand
│   └── model/
│       └── models_gen.go                # ⛔ AUTO-GENERATED — never edit by hand
│
├── internal/
│   ├── config/config.go                 # YAML + env config loading
│   ├── telegram/
│   │   ├── initdata.go                  # HMAC-SHA256 init-data verification
│   │   └── context.go                   # context.Context helpers for auth result
│   ├── saleor/
│   │   └── client.go                    # Thin generic HTTP/GraphQL client for Saleor
│   ├── app/tma/
│   │   └── service.go                   # ← Core domain logic (restaurants, dishes, orders)
│   └── transport/http/
│       └── telegram_middleware.go        # HTTP middleware: verify & attach Telegram auth
│
├── configs/
│   └── example.yaml                     # Config template — copy to configs/local.yaml
│
├── docs/
│   └── graphql-api.md                   # Detailed API reference for AI agents & humans
│
├── tools/tools.go                       # Go tools build tag (pins tool module versions)
├── README.md                            # Human-facing setup & architecture docs
├── DEPLOYMENT.md                        # Docker, Kubernetes, Cloudflare Worker instructions
└── frontend-tma.md                      # Frontend functional spec (for reference)
```

---

## 3. Development Setup

### Prerequisites

- **Go** — version must match the `go` directive in `go.mod` (currently `1.25.3`)
- A running **Saleor** instance with:
  - An API token with `MANAGE_ORDERS` + product read permissions
  - At least one channel configured
- A **Telegram bot** configured for WebApp usage (to obtain `botToken`)

### Install / bootstrap

```bash
# No extra install step — Go modules are fetched automatically.
go mod download
```

### Configuration

```bash
# Copy the example config
cp configs/example.yaml configs/local.yaml

# Edit configs/local.yaml and fill in all required fields, or use env vars:
export SALEOR_API_URL="https://your-saleor/graphql/"
export SALEOR_TOKEN="your-token"
export SALEOR_CHANNEL_ID="Q2hhbm5lbDox"
export SALEOR_CHANNEL_SLUG="default-channel"
export TELEGRAM_BOT_TOKEN="123456:ABC-DEF..."
# Optional:
export TMA_RESTAURANT_ROOT_CATEGORY_ID="Q2F0ZWdvcnk6MQ=="
export PORT="8080"

# Or point to the YAML file:
export CONFIG_PATH=./configs/local.yaml
```

### Run locally

```bash
go run ./cmd/api
# GraphQL Playground: http://localhost:8080/
# GraphQL endpoint:   http://localhost:8080/query
```

> **Important**: Every request to `/query` (and the Playground's "Execute" button)
> must include the header `X-Telegram-Init-Data: <valid initData string>`.
> Without it the server returns 401.

### Build

```bash
go build -o server ./cmd/api
```

### Run tests

```bash
go test ./...
```

Test files live next to the package they test (`*_test.go` in the same directory).
See `README.md` → *Automated Tests* for the full test catalogue.

---

## 4. Code Generation (gqlgen)

This project uses **gqlgen** to generate the GraphQL execution engine and Go model types.

### When to regenerate

Run code generation **every time** you:
- Add, rename, or remove a type/field in `graph/schema.graphqls`
- Add, rename, or remove a query or mutation in `graph/schema.graphqls`

### How to regenerate

The `//go:generate` directive lives in `graph/generate.go`.

```bash
go generate ./graph/...
# which runs: go run github.com/99designs/gqlgen generate
```

### Files touched by code generation

| File | Status |
|---|---|
| `graph/generated.go` | Fully overwritten — **never edit** |
| `graph/model/models_gen.go` | Fully overwritten — **never edit** |
| `graph/schema.resolvers.go` | **Merged** — new resolver stubs appended; existing implementations preserved |

### Workflow for adding a new field/operation

1. Edit `graph/schema.graphqls` — add the type, field, query, or mutation.
2. Run `go generate ./...`.
3. Implement the new resolver stub in `graph/schema.resolvers.go`.
4. Add the business logic in `internal/app/tma/service.go`.
5. If new Saleor calls are needed, add them as methods on `*tma.Service`.

---

## 5. Go Conventions

### Module name

```
module saleor-tma-backend
```

All internal imports use this prefix, e.g.:
```go
import "saleor-tma-backend/internal/app/tma"
```

### Package structure rules

| Package | Purpose | Rules |
|---|---|---|
| `graph` | GraphQL wiring | Resolver implementations only; delegate logic to `internal/app/tma` |
| `internal/app/tma` | Domain/business logic | No HTTP, no gqlgen types; uses its own plain structs |
| `internal/saleor` | Saleor HTTP client | Generic `Do(ctx, query, vars, out)` pattern; no domain logic |
| `internal/telegram` | Telegram auth | Verification + context helpers only |
| `internal/transport/http` | HTTP middlewares | Auth enforcement; no business logic |
| `internal/config` | Config loading | YAML + env overrides; validates required fields |

### Naming conventions

- **Exported types**: `PascalCase` — e.g., `Service`, `AuthResult`, `PlaceOrderInput`
- **Unexported helpers**: `camelCase` — e.g., `mapRestaurants`, `parseTagsFromMetadata`
- **Errors**: sentinel errors are `var ErrXxx = errors.New(...)` (e.g., `ErrInvalidInitData`, `ErrUnauthenticated`)
- **Context keys**: unexported struct type `type ctxKey struct{}` (see `internal/telegram/context.go`)

### Error handling

- Always use `fmt.Errorf("descriptive context: %w", err)` to wrap errors.
- Do **not** use `panic` in request-handling code.
- Saleor mutation errors (`errors` array in response) are surfaced as the first
  error message: `fmt.Errorf("saleor operationName: %s", errors[0].Message)`.
- Resolver-level unauthenticated access returns `ErrUnauthenticated` (defined in
  `graph/resolver.go` so it is safe from gqlgen regeneration).

### HTTP client

- Saleor calls use a dedicated `*http.Client` with a **20-second timeout** (in `internal/saleor/client.go`).
- Always pass `context.Context` through to avoid leaked goroutines.

### No global state

- All dependencies are wired in `cmd/api/main.go` via constructor functions.
- Do not use package-level variables for mutable state.

---

## 6. GraphQL Schema Guidelines

The schema lives exclusively in `graph/schema.graphqls`.

### Design principles

- **Keep the schema minimal and frontend-driven.** Only expose what the Telegram
  Mini App needs. Avoid generic CRUD.
- **Use strong types.** Prefer dedicated input types over many scalar arguments.
- **Nullable means optional.** Use `String` (nullable) for optional fields;
  `String!` when the field is always present.
- **IDs are opaque.** All `ID` values are Saleor's global GraphQL IDs (base64
  encoded). Never parse or construct them — pass them through verbatim.

### Current schema summary

```graphql
# Queries
restaurants(search: String): [Restaurant!]!
restaurantCategories(restaurantId: ID!): [Category!]!
categoryDishes(restaurantId: ID!, categoryId: ID!): [Dish!]!

# Mutations
placeOrder(input: PlaceOrderInput!): PlaceOrderPayload!
```

### Adding a new operation — checklist

- [ ] Add definition to `graph/schema.graphqls`
- [ ] Run `go generate ./...`
- [ ] Implement stub in `graph/schema.resolvers.go`
- [ ] Add `telegram.FromContext(ctx)` auth check at the top of every resolver
- [ ] Implement service method in `internal/app/tma/service.go`
- [ ] Add any new Saleor GraphQL queries/mutations as `const q` strings inside the relevant service method or private helper

---

## 7. Telegram Authentication

### How it works

1. **HTTP middleware** (`internal/transport/http/telegram_middleware.go`):
   - Reads `X-Telegram-Init-Data` header
   - Calls `telegram.VerifyInitData(ctx, initData, botToken, maxAge)`
   - On success, stores `telegram.AuthResult` in `context.Context` via `telegram.WithAuth`
   - On failure, returns **401 Unauthorized** immediately — request never reaches resolvers

2. **Resolver-level guard** (every resolver in `graph/schema.resolvers.go`):
   ```go
   auth, ok := telegram.FromContext(ctx)
   if !ok {
       return nil, ErrUnauthenticated
   }
   ```
   This is defence-in-depth. Do **not** skip this check in new resolvers.

3. **Verification algorithm** (`internal/telegram/initdata.go`):
   - HMAC-SHA256 over sorted `key=value\n...` pairs (excluding `hash`)
   - Secret key = `SHA256(botToken)` (not the token itself)
   - `auth_date` freshness checked against `MaxAge` (10 minutes in production)

### Auth result fields

```go
type AuthResult struct {
    User     User      // .ID (int64), .FirstName, .Username, .Language
    AuthDate time.Time
}
```

Access in resolvers/service via `auth.User.ID` (Telegram user ID as `int64`).

---

## 8. Saleor Integration

### Client usage

```go
// internal/saleor/client.go
func (c *Client) Do(ctx context.Context, query string, variables map[string]any, out any) error
```

- `query` — raw GraphQL query/mutation string (inline `const` in service methods)
- `variables` — `map[string]any`
- `out` — pointer to an anonymous struct matching the Saleor response shape

### Inline query pattern

Saleor GraphQL operations are defined as `const q` strings **inside** the
method or private helper that uses them. This co-locates the Saleor schema
dependency with the business logic and keeps methods short.

`PlaceOrder` is decomposed into three private helpers, each owning its own
mutation string: `createDraftOrder`, `addOrderLines`, `completeDraftOrder`.
Input validation is extracted into `validatePlaceOrderInput`.

```go
func (s *Service) ListCategories(ctx context.Context, restaurantID string) ([]Category, error) {
    const q = `
query RestaurantCategories($id: ID!) {
  category(id: $id) { ... }
}`
    var resp struct { ... }
    return ..., s.saleor.Do(ctx, q, map[string]any{"id": restaurantID}, &resp)
}
```

**Named Saleor response types** — private structs (`saleorImage`, `saleorMeta`,
`saleorRestaurantNode`, `saleorCategoryNode`, `saleorVariant`, `saleorProductNode`)
are defined at the top of `service.go` and reused across response shapes to
eliminate anonymous-struct duplication.

### Saleor domain mapping

| BFF concept | Saleor entity | Key fields used |
|---|---|---|
| `Restaurant` | `Category` | `name`, `description`, `backgroundImage.url`, `metadata[tma_tags]` |
| `Category` (dish category) | `Category` (child of restaurant) | `name`, `description`, `backgroundImage.url` |
| `Dish` | `Product` + first `ProductVariant` | `name`, `description`, `thumbnail.url`, `variants[0].id`, `variants[0].pricing.price.gross` |
| Order | Draft order flow | `draftOrderCreate` → `orderLinesCreate` → `draftOrderComplete` |

### Order creation flow

```
1. draftOrderCreate(channelId, userEmail, customerNote, metadata)
   ↓ orderID
2. orderLinesCreate(id: orderID, input: [{variantId, quantity}...])
   ↓
3. draftOrderComplete(id: orderID)
   ↓
   PlaceOrderResult{OrderID, Status}
```

**Customer email convention**: `tg-<telegramUserId>@tma.local`

**Metadata keys stored on the Saleor order**:
- `tma.telegramUserId`
- `tma.restaurantId`
- `tma.delivery.lat` + `tma.delivery.lng` **or** `tma.delivery.googleMapsUrl`

### Restaurant root category

- If `tma.restaurantRootCategoryId` is set → fetch **children** of that category as restaurants
- If not set → fetch all **top-level categories** (level `0`) as restaurants

---

## 9. Configuration Reference

| Source | YAML key | Env var | Required | Description |
|---|---|---|---|---|
| YAML / env | `http.port` | `PORT` | No (default `8080`) | HTTP listen port |
| YAML / env | `saleor.apiUrl` | `SALEOR_API_URL` | **Yes** | Saleor GraphQL endpoint |
| YAML / env | `saleor.token` | `SALEOR_TOKEN` | **Yes** | Saleor API token (`MANAGE_ORDERS` + product read) |
| YAML / env | `saleor.channelId` | `SALEOR_CHANNEL_ID` | **Yes** | Saleor channel ID (global GraphQL ID) |
| YAML / env | `saleor.channelSlug` | `SALEOR_CHANNEL_SLUG` | **Yes** | Saleor channel slug (used in pricing queries) |
| YAML / env | `telegram.botToken` | `TELEGRAM_BOT_TOKEN` | **Yes** | Telegram bot token for init-data verification |
| YAML / env | `tma.restaurantRootCategoryId` | `TMA_RESTAURANT_ROOT_CATEGORY_ID` | No | Root category whose children are restaurants |

> **Security**: Never hardcode secrets in Go source files, YAML committed to git,
> or any file tracked by version control. Always use environment variables or a
> secrets manager in production.

---

## 10. What AI Agents Must NOT Do

- ❌ **Edit `graph/generated.go`** — it is fully regenerated by gqlgen and all
  manual changes will be lost.
- ❌ **Edit `graph/model/models_gen.go`** — same as above.
- ❌ **Add business logic to resolvers** — resolvers must only translate between
  gqlgen model types and the service layer. Logic belongs in `internal/app/tma/service.go`.
- ❌ **Skip the `telegram.FromContext` check** in any new resolver — every
  resolver must verify auth independently (defence-in-depth).
- ❌ **Commit secrets** (tokens, bot keys, passwords) anywhere in the codebase.
- ❌ **Modify `graph/schema.resolvers.go` stubs generated by gqlgen** before
  running `go generate ./...` — always regenerate first, then implement.
- ❌ **Parse or construct Saleor global IDs** — they are opaque base64 strings;
  always pass them through verbatim.
- ❌ **Use `panic`** in request-handling code paths.

---

## 11. Common Tasks

### Add a new GraphQL query

1. Define the new type/query in `graph/schema.graphqls`.
2. `go generate ./...` — gqlgen appends a stub to `graph/schema.resolvers.go`.
3. Implement the stub: check auth, call a new `*tma.Service` method, map types.
4. Add the service method to `internal/app/tma/service.go`.

### Add a new GraphQL mutation

Same as above. Mutation stubs appear in `mutationResolver` in `graph/schema.resolvers.go`.

### Add a new Saleor API call

Add a new method to `*tma.Service` in `internal/app/tma/service.go` with an inline
`const` GraphQL query string. Call `s.saleor.Do(ctx, q, vars, &resp)`.

### Modify authentication logic

Edit `internal/telegram/initdata.go` (verification algorithm) or
`internal/transport/http/telegram_middleware.go` (middleware behaviour).
Do **not** remove the resolver-level `FromContext` checks.

### Change configuration shape

1. Edit the `Config` struct in `internal/config/config.go`.
2. Add YAML parsing and env-override logic in `config.Load()`.
3. Update `configs/example.yaml` to document the new field.
4. Wire the new config field in `server.go`.

### Add tests

Place `_test.go` files alongside the package being tested:
- `internal/telegram/initdata_test.go` — unit-test `VerifyInitData`
- `internal/app/tma/service_test.go` — test service with a mock `*saleor.Client`

Run with: `go test ./...`

---

## 12. Deployment Quick Reference

See `DEPLOYMENT.md` for full details.

```bash
# Build binary
go build -o server ./server.go

# Build Docker image (multi-stage)
docker build -t saleor-tma-backend .

# Run container with required env vars
docker run --rm -p 8080:8080 \
  -e SALEOR_API_URL="https://your-saleor/graphql/" \
  -e SALEOR_TOKEN="..." \
  -e SALEOR_CHANNEL_ID="..." \
  -e SALEOR_CHANNEL_SLUG="default-channel" \
  -e TELEGRAM_BOT_TOKEN="..." \
  saleor-tma-backend
```

The service is **stateless** — no database, no file system writes at runtime.
Scale horizontally without sticky sessions.

---

## 13. Key Files for Context

When working on any feature, read these files first:

| Task | Read first |
|---|---|
| Understand the public API | `graph/schema.graphqls`, `docs/graphql-api.md` |
| Implement or change a resolver | `graph/schema.resolvers.go`, `graph/resolver.go` |
| Change business/domain logic | `internal/app/tma/service.go` |
| Change Saleor communication | `internal/saleor/client.go` |
| Change authentication | `internal/telegram/initdata.go`, `internal/transport/http/telegram_middleware.go` |
| Change configuration | `internal/config/config.go`, `configs/example.yaml` |
| Understand the frontend contract | `frontend-tma.md`, `docs/graphql-api.md` |
| Wire a new dependency | `cmd/api/main.go` |
| Deploy the service | `DEPLOYMENT.md`, `Dockerfile` |

---

## 14. Changelog

<!-- Document significant AGENTS.md updates here -->
- 2025-01-01: Initial version — full project analysis and documentation
- 2025-01-02: Structural update — `server.go` → `cmd/api/main.go`; added `Dockerfile`,
  `graph/generate.go`; moved `ErrUnauthenticated`/`stringPtrOrNil` to `resolver.go`;
  extracted named Saleor response types in `service.go`; decomposed `PlaceOrder` into
  private helpers; fixed `tools/tools.go` bad import; removed `_ = ctx` from `initdata.go`