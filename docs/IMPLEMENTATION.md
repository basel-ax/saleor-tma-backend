# Implementation Plan: TypeScript Cloudflare Worker GraphQL API for Telegram TMA

Overview
- Build a GraphQL API gateway (Worker) in TypeScript that serves as a middle layer between the Telegram Mini App frontend and Saleor's order-management API.
- Use GraphQL endpoints exposed by the Worker (to match specs) and in-memory cart for testability.

Architecture sketch
- Client (Telegram WebApp) ↔ Worker GraphQL API (/graphql) ↔ Saleor GraphQL API
- Worker responsibilities:
  - Validate Telegram Init Data header on every request (X-Telegram-Init-Data)
  - Resolve GraphQL operations: restaurants, restaurantCategories, categoryDishes, placeOrder
  - Maintain per-user in-memory cart with single-restaurant constraint
  - Map operations to Saleor via a thin Saleor client (inline GraphQL queries)
  - Return GraphQL responses to the frontend

Minimal Worker architecture (modules)
- worker/src/index.ts
  - Entry point; registers fetch event listener; routes /graphql
- worker/src/schema.ts
  - GraphQL schema definitions (types, queries, mutations)
- worker/src/resolvers.ts
  - GraphQL resolvers that implement business logic and call Saleor client
- worker/src/saleorClient.ts
  - Thin HTTP client to Saleor GraphQL API with a Do(ctx, query, vars, out) signature
- worker/src/auth.ts
  - Telegram Init Data verification and extraction of auth result
- worker/src/cart.ts
  - In-memory cart management per Telegram user (restaurantId, items[])
- worker/src/utils.ts
  - Helpers for error handling, type guards, and data mapping
- worker/tsconfig.json
- wrangler.toml
- package.json (dependencies for graphql-js, ts-node/dev, etc.)

Core data models (in code)
- Restaurant, Category, Dish
- Cart { restaurantId: string, items: CartItem[] }
- CartItem { dishId: string, quantity: number, snapshot?: { name, price, currency, imageUrl, description } }
- PlaceOrderInput and PlaceOrderPayload as per specs

GraphQL surface design notes
- Queries:
  - restaurants(search: String): [Restaurant!]!
  - restaurantCategories(restaurantId: ID!): [Category!]!
  - categoryDishes(restaurantId: ID!, categoryId: ID!): [Dish!]!
- Mutations:
  - placeOrder(input: PlaceOrderInput!): PlaceOrderPayload!

Environment and config
- SALEOR_API_URL: Saleor GraphQL endpoint
- SALEOR_TOKEN: token with required permissions
- TELEGRAM_BOT_TOKEN: for init-data verification
- Other config (timeouts, retry policy) can be added later

Testing plan (short)
- Unit tests for cart.ts and auth.ts
- Integration tests against a mocked Saleor endpoint
- SpecKit tests for the GraphQL surface

Notes
- This is a minimal skeleton plan. Details will be fleshed out during implementation with concrete GraphQL query strings, resolvers, and error handling.
