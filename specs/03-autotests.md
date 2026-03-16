Autotests (Contract & Flow) for Telegram TMA GraphQL API

Overview
- These tests validate the GraphQL surface exposed by the Worker and the end-to-end flows with an in-memory cart.
- Tests assume a local GraphQL endpoint at /graphql exposed by wrangler dev or deployed URL.

Test suite structure
- Test 1: Query restaurants returns 200 and a non-empty list
- Test 2: Query restaurantCategories returns categories for a valid restaurant
- Test 3: Query categoryDishes returns dishes for a restaurant/category
- Test 4: Place an order with deliveryLocation (latitude/longitude) -> 200 and orderId returned
- Test 5: Place an order with Google Maps URL -> 200 and orderId returned
- Test 6: Cart switch with active cart prompts confirmation; Continue leads to reset and new restaurant context
- Test 7: Invalid input for placeOrder returns helpful error without losing cart state
- Test 8: Backend error surface from Saleor mapped to 500/diagnostic error in response

Test scaffolding (pseudo-commands)
- Start worker: wrangler dev
- Run specs:
  ```bash
  npx spec-kit run specs/03-autotests.md
  ```
- Use a mock Saleor backend or a test double GraphQL endpoint to produce deterministic responses for tests.

Test data assumptions (in-memory cart)
- Restaurant A id: restA; Dishes: dishA1, dishA2
- Restaurant B id: restB; Dishes: dishB1
- Cart items: [{ dishId: 'dishA1', quantity: 1 }], restaurantId: restA
- After switching to restB, cart is cleared upon Continue confirmation.

Notes
- Tests should be deterministic and not depend on live Saleor data.
- Include negative tests for missing header (init data), invalid IDs, and failure modes.
