# Codebase Structure

**Analysis Date:** 2026-03-16

## Directory Layout

```
saleor-tma-backend/
├── .planning/          # Planning and documentation files
├── specs/              # Specification documents
├── task/               # Task breakdowns
├── worker/             # Cloudflare Worker implementation
│   ├── node_modules/   # Dependencies
│   ├── src/            # Source code
│   │   ├── index.ts    # Main entry point
│   │   ├── resolvers.ts # GraphQL resolvers
│   │   ├── auth.ts     # Authentication logic
│   │   ├── contracts.ts # Shared types
│   │   ├── cart.ts     # Cart management
│   │   ├── saleorOrder.ts # Saleor integration
│   │   ├── logger.ts   # Logging utilities
│   │   ├── errors.ts   # Error definitions
│   │   └── testHelpers.ts # Test utilities
│   ├── package.json    # Dependencies and scripts
│   ├── tsconfig.json   # TypeScript configuration
│   └── wrangler.toml   # Cloudflare deployment config
├── frontend/           # Frontend application
├── README.md           # Project overview
└── wrangler.toml       # Root deployment config
```

## Directory Purposes

**worker/:**
- Purpose: Main Cloudflare Worker implementation
- Contains: Source code, configurations, deployment settings
- Key files: `worker/src/index.ts`, `worker/src/resolvers.ts`, `wrangler.toml`

**specs/:**
- Purpose: Project specifications and API contracts
- Contains: API specifications, authentication protocols
- Key files: `specs/05-telegram-auth.md`, `specs/01-api-contract.md`

**task/:**
- Purpose: Development phase breakdowns and task tracking
- Contains: Phase-specific implementation notes
- Key files: `task/phase-9-improve-code.md`

**.planning/:**
- Purpose: Project planning documents
- Contains: Architecture and development plans
- Key files: `implementation_plan.md`

## Key File Locations

**Entry Points:**
- `worker/src/index.ts`: Main worker request handler

**Configuration:**
- `wrangler.toml`: Cloudflare Worker deployment configuration
- `worker/package.json`: Dependencies and scripts
- `worker/tsconfig.json`: TypeScript compilation settings

**Core Logic:**
- `worker/src/resolvers.ts`: GraphQL resolver implementations
- `worker/src/auth.ts`: Telegram Mini App authentication
- `worker/src/cart.ts`: Shopping cart management
- `worker/src/saleorOrder.ts`: Saleor order integration

**Testing:**
- `worker/src/graphql.test.ts`: GraphQL API tests
- `worker/src/testHelpers.ts`: Test utilities and fixtures

## Naming Conventions

**Files:**
- kebab-case for config files: `wrangler.toml`
- camelCase for source files: `index.ts`, `resolvers.ts`

**Directories:**
- kebab-case: `specs/`, `task/`, `frontend/`

## Where to Add New Code

**New Feature:**
- Primary code: `worker/src/resolvers.ts` (add new resolvers)
- Tests: `worker/src/graphql.test.ts`

**New Component/Module:**
- Implementation: `worker/src/` (new feature file)

**Utilities:**
- Shared helpers: `worker/src/` (utilities as needed)

## Special Directories

**node_modules/:**
- Purpose: Dependency packages
- Generated: Yes (by npm/pnpm)
- Committed: No

**.planning/:**
- Purpose: Project documentation and planning
- Generated: No
- Committed: Yes

**specs/:**
- Purpose: Project specifications
- Generated: No
- Committed: Yes

---

*Structure analysis: 2026-03-16*