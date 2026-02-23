### Overview

This repository contains a **GraphQL backend-for-frontend (BFF)** written in Go for a **Telegram Mini App** that handles food ordering. It sits between:

- **Telegram WebApp frontend** (see `frontend-tma.md`)
- **Saleor** headless ecommerce as the **order management system**

The BFF:

- Verifies Telegram Mini App users via `X-Telegram-Init-Data`
- Exposes a **small, opinionated GraphQL schema** tailored to the mini app flows
- Maps mini app concepts (restaurants, categories, dishes, cart, order) onto **Saleor categories, products, variants, and draft orders**

### High-level architecture

- `cmd/api` – (reserved) alternative entrypoints if needed
- `server.go` – main application entrypoint (HTTP + GraphQL server)
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
go run ./server.go
```

3. Open the GraphQL Playground:

- `http://localhost:8080/`
- Endpoint: `/query`
- **Important**: include valid `X-Telegram-Init-Data` header in requests (in production this comes from Telegram; see `internal/telegram` for the verification rules).

---

### Deployment

This service is a stateless Go HTTP API and can be deployed as a container, binary, or behind a Cloudflare Worker.

For detailed deployment instructions (Docker image, Kubernetes/Cloud Run usage, and Cloudflare Worker proxy setup), see **`DEPLOYMENT.md`**.

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

