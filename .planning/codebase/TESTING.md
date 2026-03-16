# Testing Patterns

**Analysis Date:** 2026-03-16

## Test Framework

**Runner:**
- Vitest [latest version]
- Config: `vitest.config.js` (not found in current exploration but commonly used with Vitest)

**Assertion Library:**
- Built-in Vitest assertions: `expect`, `toBeDefined`, `toBe`, `toContain`

**Run Commands:**
```bash
pnpm test              # Run all tests
pnpm test --watch     # Watch mode
pnpm test --coverage  # Coverage
```

## Test File Organization

**Location:**
- Tests co-located with source code: `worker/src/graphql.test.ts`

**Naming:**
- Use `.test.ts` suffix for test files: `graphql.test.ts`

**Structure:**
```
worker/src/
├── *.test.ts          # Test files
├── *.ts               # Source files
└── testHelpers.ts     # Test utilities
```

## Test Structure

**Suite Organization:**
```typescript
describe('GraphQL API Contract Tests', () => {
  describe('Query: restaurants', () => {
    it('should return a list of restaurants', async () => {
      // test implementation
    });
  });
});
```

**Patterns:**
- Nested describes to organize related tests
- Asynchronous tests using async/await
- BeforeAll/afterAll for setup and teardown when needed

## Mocking

**Framework:** Not explicitly using external mocking framework, relies on Vitest's built-in capabilities

**Patterns:**
- Test data constants defined in testHelpers.ts
- Manual mocking of API responses and data structures

**What to Mock:**
- External API calls (using fetch mock)
- Environment variables (using globalThis mock)

**What NOT to Mock:**
- Core business logic
- Data transformation functions

## Fixtures and Factories

**Test Data:**
```typescript
export const TEST_RESTAURANTS = {
  REST_A: { id: "restA", name: "Pizza Place" },
  REST_B: { id: "restB", name: "Sushi House" },
};

export function buildPlaceOrderInput(overrides: Partial<PlaceOrderInput> = {}): PlaceOrderInput {
  // factory implementation
}
```

**Location:**
- Test fixtures and builders in `testHelpers.ts`

## Coverage

**Requirements:** Not explicitly enforced through configuration found

**View Coverage:**
```bash
pnpm test --coverage
```

## Test Types

**Unit Tests:**
- Not explicitly identified in the current exploration

**Integration Tests:**
- API contract tests in `graphql.test.ts` that validate the GraphQL endpoint against actual implementation

**E2E Tests:**
- Not explicitly identified in this codebase

## Common Patterns

**Async Testing:**
```typescript
it('should return a list of restaurants', async () => {
  const response = await graphqlRequest(QUERY_RESTAURANTS);
  expect(response.errors).toBeUndefined();
  expect(response.data).toBeDefined();
  // assertions...
});
```

**Error Testing:**
```typescript
it('should return error when restaurant is missing', async () => {
  const input = {
    items: [{ dishId: 'dish1', quantity: 1 }],
    deliveryLocation: { address: '123 Main St' },
  };

  const response = await graphqlRequest(MUTATION_PLACE_ORDER, { input });

  expect(response.errors).toBeDefined();
  expect(response.errors?.length).toBeGreaterThan(0);
  expect(response.errors?.[0].message).toContain('Restaurant');
});
```

---

*Testing analysis: 2026-03-16*