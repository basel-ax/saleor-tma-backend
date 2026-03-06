# SpecKit Configuration for Telegram TMA GraphQL API

## Overview
This file configures spec-kit to run contract tests against the GraphQL Worker.

## Configuration

### Base URL
The base URL for the GraphQL endpoint. Override with environment variable:
- Development: http://localhost:8787 (wrangler dev)
- Production: Your deployed Cloudflare Worker URL

### Authentication
All requests must include the header:
- `X-Telegram-Init-Data`: Valid Telegram init data string

For testing, use the mock init data from testHelpers.ts:
```
auth_date=1700000000&hash=test_hash&user={"id":"123456789","first_name":"Test","last_name":"User","language_code":"en"}
```

## Running Tests

### Local Development
```bash
# Start the worker
cd worker && wrangler dev

# Run spec-kit tests (in another terminal)
npx spec-kit run specs
```

### With Custom Base URL
```bash
SPEC_KIT_BASE_URL=https://your-worker.example.com npx spec-kit run specs
```

### CI/CD
Set the SPEC_KIT_BASE_URL environment variable to point to your deployed worker.

## Test Files
- specs/01-api-contract.md - API contract tests
- specs/03-autotests.md - End-to-end flow tests

## Notes
- Tests are deterministic and use in-memory cart state
- Each test should clean up its cart state to avoid interference
- Mock Saleor responses are used for deterministic testing
