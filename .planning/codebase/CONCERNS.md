# Codebase Concerns

**Analysis Date:** 2026-03-16

## Tech Debt

**Telegram Authentication Security:**
- Issue: HMAC-SHA256 verification is not implemented for Telegram Init Data, leaving authentication vulnerable to forgery attacks
- Files: `worker/src/auth.ts` (line 121)
- Impact: Attackers could forge authentication headers to impersonate users and access protected resources
- Fix approach: Implement proper HMAC-SHA256 validation using the Telegram bot token as documented in the commented-out code

**Mock Data in Production Code:**
- Issue: Sample restaurants, categories, and dishes are hardcoded in resolver file instead of using real data from backend
- Files: `worker/src/resolvers.ts` (lines 13-27)
- Impact: Application uses fake data instead of real product catalog, making it unsuitable for production use
- Fix approach: Connect to real data sources instead of using the sample arrays

## Known Bugs

**Empty Return Values:**
- Issue: Several functions return null objects instead of meaningful data
- Files: `worker/src/saleorClient.ts` (line 183), `worker/src/index.ts` (line 183), `worker/src/cart.ts` (line 35)
- Impact: Can lead to unexpected errors when consumers expect actual data
- Workaround: Additional null checks required in calling code

## Security Considerations

**Missing Input Validation:**
- Issue: Insufficient validation of user-provided input in GraphQL resolvers
- Files: `worker/src/resolvers.ts` (placeOrder mutation)
- Current mitigation: Basic checks for required fields
- Recommendations: Add comprehensive input validation for all user inputs to prevent injection attacks and malformed data

**Potential Rate Limiting Issues:**
- Issue: No apparent rate limiting implementation for authentication or API endpoints
- Files: `worker/src/auth.ts`, `worker/src/saleorClient.ts`
- Current mitigation: Basic logging of auth failures
- Recommendations: Implement rate limiting to prevent brute force and DoS attacks

## Performance Bottlenecks

**Inefficient Cart Operations:**
- Problem: Cart operations in `worker/src/cart.ts` retrieve the entire cart from KV storage for every operation, which is inefficient for large carts
- Files: `worker/src/cart.ts` (getCart function)
- Cause: Each operation (add, update, remove) retrieves and stores the entire cart state
- Improvement path: Implement partial updates or use a more scalable storage solution for larger cart states

## Fragile Areas

**Environment Variable Handling:**
- Files: `worker/src/saleorClient.ts` (lines 173-183), `worker/src/auth.ts` (lines 11-13)
- Why fragile: Relies on globalThis and assumes environment variables are available through a specific interface
- Safe modification: Any changes to how environment variables are accessed could break in different deployment environments
- Test coverage: Need integration tests that verify behavior in different environments

## Scaling Limits

**Cart Storage with KV:**
- Current capacity: Single cart stored per user in KV with 24-hour TTL
- Limit: KV has rate limits that could be hit with many concurrent cart operations
- Scaling path: Consider implementing caching strategies or sharding for high-volume scenarios

**Memory-based Carts in Tests:**
- Problem: The cart implementation falls back to in-memory storage when KV is unavailable (e.g., during tests)
- Files: `worker/src/cart.ts` (memoryCarts Map)
- Impact: Memory usage could grow indefinitely in long-running test environments
- Improvement path: Implement proper cleanup mechanisms or alternative test storage

## Dependencies at Risk

**Cloudflare Workers Specific Implementation:**
- Risk: Heavy reliance on Cloudflare Workers runtime features (KV, globalThis for env vars)
- Impact: Difficult to migrate to other serverless platforms or run locally without extensive mocking
- Migration plan: Abstract platform-specific features behind interfaces

## Missing Critical Features

**Comprehensive Error Handling:**
- Problem: Some error conditions are not properly handled, especially network errors from external services
- Files: `worker/src/saleorClient.ts`
- Blocks: Proper error recovery and user feedback mechanisms

## Test Coverage Gaps

**Authentication Logic:**
- What's not tested: The Telegram Init Data validation logic, particularly around HMAC verification
- Files: `worker/src/auth.ts`
- Risk: Security vulnerabilities could be introduced without proper testing
- Priority: High

**KV Persistence:**
- What's not tested: Full end-to-end cart operations with KV persistence
- Files: `worker/src/cart.ts`
- Risk: Data loss or corruption in production if KV interactions fail silently
- Priority: High

---

*Concerns audit: 2026-03-16*