# Testing Guide - Telegram TMA GraphQL Backend

## Overview
This document describes how to run contract tests and autotests for the Telegram Mini App GraphQL backend.

## Prerequisites

### Required Tools
- Node.js (v18 or higher)
- npm or yarn
- Wrangler CLI (`npm install -g wrangler`)
- GitHub spec-kit or equivalent CLI tool

### Environment Setup

1. **Install dependencies:**
   ```bash
   cd worker
   npm install
   ```

2. **Set environment variables (optional):**
   ```bash
   # For local development
   export SPEC_KIT_BASE_URL=http://localhost:8787
   
   # For production testing
   export SPEC_KIT_BASE_URL=https://your-worker.subdomain.workers.dev
   ```

## Running Tests

### Option 1: Using spec-kit (Recommended)

The project uses spec-kit for contract testing. Tests are defined in `specs/03-autotests-speckit.md`.

```bash
# Run all contract tests
npm test

# Run tests with custom base URL
SPEC_KIT_BASE_URL=http://localhost:8787 npm test

# Watch mode for development
npm run test:watch
```

### Option 2: Manual Testing with curl

You can manually test the GraphQL endpoint using curl:

```bash
# Start the worker in development mode
wrangler dev

# In another terminal, run curl commands:

# Test 1: Query restaurants
curl -X POST http://localhost:8787/graphql \
  -H "Content-Type: application/json" \
  -H "X-Telegram-Init-Data: auth_date=1700000000&hash=test_hash&user={\"id\":\"123456789\",\"first_name\":\"Test\",\"last_name\":\"User\",\"language_code\":\"en\"}" \
  -d '{"query":"{ restaurants { id name } }"}'

# Test 2: Query categories
curl -X POST http://localhost:8787/graphql \
  -H "Content-Type: application/json" \
  -H "X-Telegram-Init-Data: auth_date=1700000000&hash=test_hash&user={\"id\":\"123456789\",\"first_name\":\"Test\"}" \
  -d '{"query":"query { restaurantCategories(restaurantId: \"rest1\") { id name } }"}'

# Test 3: Place order
curl -X POST http://localhost:8787/graphql \
  -H "Content-Type: application/json" \
  -H "X-Telegram-Init-Data: auth_date=1700000000&hash=test_hash&user={\"id\":\"123456789\",\"first_name\":\"Test\"}" \
  -d '{"query":"mutation { placeOrder(input: {restaurantId: \"rest1\", items: [{dishId: \"dish1\", quantity: 2}], deliveryLocation: {address: \"123 Main St\", latitude: 40.7128, longitude: -74.006}}) { orderId status } }"}'
```

### Option 3: Using GraphQL Playground

1. Start the worker: `wrangler dev`
2. Open http://localhost:8787/graphql in your browser
3. Add the header `X-Telegram-Init-Data` with valid test data
4. Run queries and mutations

## Test Data

### Valid Telegram Init Data
For testing, use the following init data format:
```
auth_date=1700000000&hash=test_hash&user={"id":"123456789","first_name":"Test","last_name":"User","language_code":"en"}
```

### Test Restaurants
- `rest1`: Pizza Hub
- `rest2`: Sushi Lane

### Test Categories
- `cat1`: Pizzas (for rest1)
- `cat2`: Nigiri (for rest2)

### Test Dishes
- `dish1`: Margherita ($9.50)
- `dish2`: Pepperoni ($11.00)
- `dish3`: Salmon Nigiri ($2.50)

## Test Cases

### 1. Query Tests
- `test_restaurants_query` - Returns list of restaurants
- `test_categories_query` - Returns categories for a restaurant
- `test_dishes_query` - Returns dishes for a category
- `test_cart_query` - Returns current user's cart

### 2. Mutation Tests
- `test_place_order_with_location` - Place order with lat/lng
- `test_place_order_with_address` - Place order with address only
- `test_add_to_cart` - Add item to cart
- `test_update_cart_item` - Update item quantity
- `test_remove_cart_item` - Remove item from cart
- `test_clear_cart` - Clear entire cart

### 3. Error Handling Tests
- `test_missing_auth_header` - Returns 401 without init data
- `test_invalid_init_data` - Returns error for invalid auth
- `test_missing_restaurant` - Returns error for missing restaurant
- `test_empty_cart_order` - Returns error for empty cart
- `test_missing_address` - Returns error for missing address

## CI/CD Integration

### GitHub Actions Example
```yaml
name: Contract Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
        working-directory: worker
      - run: npm run build
        working-directory: worker
      - run: npm test
        working-directory: worker
        env:
          SPEC_KIT_BASE_URL: ${{ secrets.TEST_WORKER_URL }}
```

## Troubleshooting

### Worker not starting
- Make sure Wrangler is installed: `npm install -g wrangler`
- Check wrangler.toml configuration

### Tests failing
- Verify worker is running on correct port
- Check that init data is valid
- Ensure all required headers are included

### TypeScript errors
- Run `npm run build` to see detailed errors
- Check tsconfig.json configuration

## Additional Resources

- [GraphQL Schema](./schema.graphql)
- [API Contract Specs](../specs/01-api-contract.md)
- [Autotests Specs](../specs/03-autotests.md)
- [Implementation Guide](../IMPLEMENTATION.md)
