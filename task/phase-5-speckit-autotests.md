Phase 5 — SpecKit Autotests

Goals
- Establish contract tests and autotests using @github/spec-kit against the GraphQL Worker.
- Create deterministic test scaffolding with an in-memory cart and a mocked Saleor backend.

Deliverables
- Test plan: list of tests derived from specs/03-autotests.md (e.g., restaurants query, categories, dishes, placeOrder with/without Google Maps URL, cart switch, invalid input, Saleor errors).
- Skeleton test files and helper utilities (test data builders, mocks).
- Instructions to run tests locally: SPEC_KIT_BASE_URL, wrangler dev, etc.

Notes
- Tests should be deterministic and not rely on live Saleor data.

(End of Phase 5)
