# Telegram TMA GraphQL API (Cloudflare Worker)

Overview
- A TypeScript-based Cloudflare Worker that exposes a GraphQL API to power the Telegram Mini App for restaurant ordering.
- Acts as a BFF between the Telegram frontend and the Saleor order-management backend.
- Frontend interface and flows are defined in @tmp/frontend-tma.md (as reference).

Key concepts
- GraphQL API surface exposed by the Worker:
  - Query restaurants(search: String): [Restaurant!]!
  - Query restaurantCategories(restaurantId: ID!): [Category!]!
  - Query categoryDishes(restaurantId: ID!, categoryId: ID!): [Dish!]!
  - Mutation placeOrder(input: PlaceOrderInput!): PlaceOrderPayload!
- In-memory cart per Telegram user (testable in specs; production may use KV).
- Saleor integration via a thin Saleor client; all API calls are read/translated accordingly.
- Telegram Init Data header verification for auth.

Development setup
- Prereqs: Node.js (latest LTS), Wrangler (Cloudflare Workers tooling)
- Install dependencies:
  ```bash
  npm ci
  ```
- Build/Run locally:
  ```bash
  wrangler dev
  ```
- GraphQL endpoint will be available at http://localhost:8787/graphql while in dev.

Configuration
- Saleor API URL and token, Telegram bot token, and other config values are provided via environment variables or a config file.
- Example envs:
  - SALEOR_API_URL=https://your-saleor/graphql/
  - SALEOR_TOKEN=your-token
  - TELEGRAM_BOT_TOKEN=1234:ABC-DEF...
  - BACKEND_BASE_URL=${SALEOR_API_URL}

Deployment
- Build and publish with Wrangler:
  ```bash
  wrangler publish
  ```
- For production, set up a Cloudflare Pages site for the frontend and deploy the worker to a Worker Routes.

Spec-driven QA and autotests
- Specs live under specs/ (GraphQL endpoints)
- Autotests cover: restaurants, categories, dishes, placeOrder, auth, and cart switching behavior.
- Run tests with SpecKit:
  ```bash
  npx spec-kit run specs
  ```

File and directory overview
- specs/00-..md: SpecKit setup
- specs/01-..md: GraphQL contract for endpoints
- specs/02-..md: Interaction flow mapping
- specs/03-..md: Autotests plan
- specs/04-..md: Deployment guidance
- specs/05-..md: Telegram auth contract
- specs/06-..md: Contract helpers
- IMPLEMENTATION.md: Implementation plan and minimal architecture sketch
- IMPLEMENTATION.md: (to be updated with code-level details)
- IMPLEMENTATION.md: Source files and skeletons to create

What’s next
- If you want, I can generate a skeleton TS Worker and a wrangler.toml to start implementation, wired to the specs and autotests described here.
