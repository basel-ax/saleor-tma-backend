Phase 9 — Alignment Questions and Next Steps

Context
- This phase improve code, test and deploy.

Key steps
- Do we implement Phase 3 (cart persistence) with KV from the start? -> Yes (default). Rationale: simplifies production migration path; keeps code path similar between test and prod.
- placeOrder use a real Saleor integration
- deploy in CI/CD with Wrangler, local dev verified.
- Production auth expectations: 401 on missing header, 403 on insufficient permissions? -> 401 for missing/invalid header; 403 for permission checks.
- Data store choice for carts in prod: Cloudflare KV, preferred in Cloudflare Workers context, with eventual consistency notes.
- Test strategy: contract tests now; integration tests incrementally.
- What is the minimum viable surface area? -> Keep query restaurants, restaurantCategories, categoryDishes, placeOrder; avoid extra mutations.
