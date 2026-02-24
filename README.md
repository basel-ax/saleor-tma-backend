# saleor-tma-backend

### Overview

This repository contains a **GraphQL backend-for-frontend (BFF)** written in Go for a **Telegram Mini App** that handles food ordering. It sits between:

- **Telegram WebApp frontend** (see `frontend-tma.md`)
- **Saleor** headless ecommerce as the **order management system**

The BFF:

- Verifies Telegram Mini App users via `X-Telegram-Init-Data`
- Exposes a **small, opinionated GraphQL schema** tailored to the mini app flows
- Maps mini app concepts (restaurants, categories, dishes, cart, order) onto **Saleor categories, products, variants, and draft orders**

### High-level architecture

- `cmd/api/main.go` – main application entrypoint (HTTP + GraphQL server)
- `graph/` – GraphQL schema, models, and resolvers (gqlgen)
- `internal/config` – configuration loading (YAML + env)
- `internal/telegram` – Telegram WebApp init data verification + context helpers
- `internal/saleor` – thin, generic GraphQL client for Saleor
- `internal/app/tma` – domain service for the Telegram Mini App
- `internal/transport/http` – HTTP middlewares (Telegram auth)
- `configs/example.yaml` – example BFF configuration
- `frontend-tma.md` – frontend functional description for the mini app

### Domain mapping to Saleor

- **Restaurant**
  - Backed by **Saleor `Category`**
  - Either:
    - All **top-level categories** are treated as restaurants, or
    - A configured `tma.restaurantRootCategoryId` is used; its **children** are restaurants
  - Uses:
    - `Category.name` → restaurant name
    - `Category.description` → description
    - `Category.backgroundImage.url` → `imageUrl`
    - `Category.metadata` key `tma_tags` → `tags` (comma-separated string or JSON array)

- **Category (inside restaurant)**
  - Backed by **child categories** of the restaurant category
  - Uses:
    - `Category.name`, `description`, `backgroundImage.url`

- **Dish**
  - Backed by **Saleor Products** and their **first `ProductVariant`**
  - Filtered by category via `products(first: 100, channel: $channelSlug, filter: { categories: [categoryId] })`
  - Uses:
    - Product `name`, `description`, `thumbnail.url`
    - Variant `id` as `dishId`
    - Variant `pricing.price.gross` as `Money(amount, currency)`

- **Order**
  - Implemented through **draft orders**:
    - `draftOrderCreate`
    - `orderLinesCreate`
    - `draftOrderComplete`
  - Customer identity stored with a generated email `tg-<telegramUserId>@tma.local` + metadata:
    - `tma.telegramUserId`
    - `tma.restaurantId`
    - `tma.delivery.lat` / `tma.delivery.lng` **or**
    - `tma.delivery.googleMapsUrl`

For a more detailed, AI-oriented operation description, see `docs/graphql-api.md`.

---

### Configuration

Configuration is loaded from:

- Optional YAML file: set `CONFIG_PATH=/path/to/config.yaml`
- Environment overrides:
  - `PORT` – HTTP listen port (default `8080`)
  - `SALEOR_API_URL` – Saleor GraphQL endpoint (required)
  - `SALEOR_TOKEN` – API token with `MANAGE_ORDERS` + product read (required)
  - `SALEOR_CHANNEL_ID` – Channel ID used when creating draft orders (required)
  - `SALEOR_CHANNEL_SLUG` – Channel slug used in product pricing queries (required)
  - `TELEGRAM_BOT_TOKEN` – Bot token for verifying WebApp init data (required)
  - `TMA_RESTAURANT_ROOT_CATEGORY_ID` – optional root category for restaurants

You can use `configs/example.yaml` as a starting point:

```bash
cp configs/example.yaml configs/local.yaml
export CONFIG_PATH=./configs/local.yaml
```

Then fill in:

- `saleor.apiUrl`, `saleor.token`, `saleor.channelId`, `saleor.channelSlug`
- `telegram.botToken`
- Optionally `tma.restaurantRootCategoryId`

---

### Running locally

**Prerequisites**

- Go (matching `go` version in `go.mod`)
- Access to a Saleor instance with:
  - API token with **product read** and **order management** permissions
  - At least one **channel** configured
- Telegram bot configured for **WebApp** usage

**Steps**

1. Configure Saleor + Telegram environment (as above).
2. Start the server:

```bash
go run ./cmd/api
```

3. Open the GraphQL Playground:

- `http://localhost:8080/`
- Endpoint: `/query`
- **Important**: include valid `X-Telegram-Init-Data` header in requests (in production this comes from Telegram; see `internal/telegram` for the verification rules).

---

### Deployment

This service is a stateless Go HTTP API and can be deployed as a container, binary, or behind a Cloudflare Worker.

Build the binary:

```bash
go build -o server ./cmd/api
```

A `Dockerfile` is provided at the repository root for container builds. For detailed deployment instructions (Docker image, Kubernetes/Cloud Run usage, and Cloudflare Worker proxy setup), see **`DEPLOYMENT.md`**.

---

### Telegram Mini App integration

The frontend (Telegram WebApp) should:

- Read `initData` from the Telegram WebApp API
- Send it on **every** request as:
  - HTTP header: `X-Telegram-Init-Data: <full initData string>`
- The backend:
  - Verifies the signature using `TELEGRAM_BOT_TOKEN`
  - Extracts user id and basic profile
  - Attaches it to the Go `context.Context` for resolvers (`internal/telegram`)

Requests without valid `X-Telegram-Init-Data` are rejected with **401**.

---

### Frontend-facing GraphQL API

The BFF exposes a narrow schema optimized for the mini app. A separate, AI-oriented reference lives in `docs/graphql-api.md`, but the high-level methods are:

- **Queries**
  - `restaurants(search: String)` – restaurants list
  - `restaurantCategories(restaurantId: ID!)` – categories for a restaurant
  - `categoryDishes(restaurantId: ID!, categoryId: ID!)` – dishes with prices
- **Mutations**
  - `placeOrder(input: PlaceOrderInput!)` – places an order in Saleor

See `frontend-tma.md` for how each operation maps to the Telegram Mini App screens and flows.

---

### Automated Tests

The test suite requires **no external services** — all Saleor HTTP calls are intercepted by in-process mock servers (`httptest`), and Telegram auth is exercised using locally computed HMAC signatures. Tests run fully offline and deterministically.

#### Run all tests

```bash
go test ./...
```

#### Run with verbose output and race detector

```bash
go test -race ./... -v
```

#### Run a specific package

```bash
go test ./internal/telegram/...
go test ./internal/app/tma/...
go test ./graph/...
```

#### Run a single named test

```bash
go test ./internal/app/tma/... -run TestFullUserWorkflow
```

#### Regenerate GraphQL code after schema changes

```bash
go generate ./graph/...
```

---

#### Test files

| File | Package | What it covers |
|---|---|---|
| `internal/telegram/initdata_test.go` | `telegram` | HMAC-SHA256 init-data verification: valid signatures, expiry, missing/invalid fields, tampered payloads, case-insensitive hash |
| `internal/app/tma/service_test.go` | `tma` | Full user workflow at the service layer; all query/mutation paths; Saleor error propagation; metadata/email conventions |
| `graph/resolver_test.go` | `graph_test` | Full user workflow at the GraphQL resolver layer; auth guard (unauthenticated access rejected); type mapping from `tma.*` to GraphQL models |

All test files live next to the package they test (`*_test.go` in the same directory).

---

#### Test coverage by area

**Telegram authentication** (`internal/telegram/initdata_test.go`):
- Valid initData accepted (standard fields, extra fields, zero `maxAge`)
- Expired `auth_date` rejected (past boundary and just-past boundary)
- Missing or malformed fields rejected (`hash`, `auth_date`, `user`, `user.id == 0`)
- Wrong bot token / tampered payload detected (HMAC mismatch)
- Hash accepted case-insensitively (upper and lower hex)

**Service layer — restaurants** (`TestListRestaurants_*`):
- Root-category path (`TMA_RESTAURANT_ROOT_CATEGORY_ID` set)
- Top-level categories path (no root category)
- Search term forwarded to Saleor
- Root category missing → error
- Empty result list
- Saleor GraphQL protocol error propagated
- Tags parsed from comma-separated string and from JSON array
- Missing `backgroundImage` → empty `imageUrl`

**Service layer — categories** (`TestListCategories_*`):
- Happy path with full field mapping
- Restaurant category not found → error
- Empty child list
- Saleor GraphQL error propagated

**Service layer — dishes** (`TestListDishes_*`):
- Happy path with full field and price mapping
- Category not belonging to restaurant → error
- Category with no parent → error
- Products without variants silently skipped
- Saleor error propagated

**Service layer — place order** (`TestPlaceOrder_*`):
- GPS coordinates variant (full three-step Saleor flow)
- Google Maps URL variant
- Multiple cart items in a single order
- Input validation: missing `restaurantId`, empty `items`, both delivery options, neither delivery option, zero quantity
- Saleor mutation-level errors at each step (`draftOrderCreate`, `orderLinesCreate`, `draftOrderComplete`)
- Network error (server unreachable)
- Customer email convention: `tg-<telegramUserId>@tma.local` present in Saleor request
- Metadata keys verified: `tma.telegramUserId`, `tma.restaurantId`, `tma.delivery.lat`/`lng` or `tma.delivery.googleMapsUrl`

**Resolver layer** (`graph/resolver_test.go`):
- Every resolver returns `unauthenticated` error when `telegram.AuthResult` is absent from context
- `restaurants` — empty list, type mapping, nil description/imageUrl, search forwarding, service error
- `restaurantCategories` — type mapping, ID forwarding, nil fields, service error
- `categoryDishes` — full field and price mapping, ID forwarding, service error
- `placeOrder` — mapping with coordinates, mapping with Google Maps URL, nil comment forwarded as empty, service error
- **Full workflow integration test** (`TestWorkflow_FullUserFlow`): browses restaurants → selects one → lists categories → lists dishes → places order, verifying each step uses the IDs returned by the previous step

---

#### Test design notes

- **No external dependencies**: tests rely only on Go's standard library (`net/http/httptest`, `crypto/hmac`, etc.).
- **Two mock strategies**:
  - `routingServer` — routes GraphQL requests by matching a keyword in the raw query string; suitable for tests that call multiple different operations.
  - `sequentialServer` — serves pre-canned responses in order; suitable for tests that need strict call sequencing.
- **Mock TMAService** (`graph/resolver_test.go`): a struct with function-valued fields, allowing per-test behaviour to be injected inline without a framework.
- **`TMAService` interface** (`graph/resolver.go`): the `Resolver` struct depends on this interface rather than the concrete `*tma.Service`, enabling the resolver tests to run without touching any HTTP client code.
- **`//go:generate`** directive lives in `graph/generate.go`; run `go generate ./graph/...` after any schema change to rebuild `graph/generated.go` and `graph/model/models_gen.go`.

