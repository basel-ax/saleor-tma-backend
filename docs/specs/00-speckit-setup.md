SpecKit Setup for Telegram TMA GraphQL API (TypeScript, Cloudflare Worker)

Overview
- This spec-kit suite defines the contract for the GraphQL API exposed by the Cloudflare Worker that mediates between the Telegram Mini App frontend and Saleor (order-management API).
- Tests run against a GraphQL endpoint exposed by the Worker at /graphql.

Prerequisites
- Node.js (latest LTS) installed locally.
- Wrangler (Cloudflare Workers toolchain) installed: `npm i -g wrangler`.
- We use @github/spec-kit for contract-style tests and a local mock for Saleor during tests.

Project setup
- Install spec-kit as a dev dependency:
  ```bash
  npm i -D @github/spec-kit
  ```
- Create a test harness that points spec-kit at the Worker GraphQL endpoint:
  - SPEC_KIT_BASE_URL: http://localhost:8787 (wrangler dev) or deployed URL during CI.
- Create an optional SALEOR_BASE_URL env var to point the Worker to a mocked Saleor GraphQL endpoint when running tests locally.

Running tests
- Run the contract specs:
  ```bash
  npx spec-kit run specs
  ```
- Typical output includes passed/failed specs and a summary.

Notes
- The spec files in specs/ describe the schema, inputs, outputs, and error conditions for the GraphQL API.
- The Worker must accept a POST to /graphql with a JSON body containing { query: string, variables?: object }.
- All requests must include header X-Telegram-Init-Data for authentication/validation.
