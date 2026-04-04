Interaction Flow: Telegram TMA GraphQL API (Worker) ↔ Saleor

Overview
- This document maps frontend user actions in the Telegram Mini App to GraphQL operations exposed by the Worker, and then to Saleor API calls.

User flows mapped to GraphQL operations
- Flow: Place an order
  1) Frontend: query restaurants(search) -> Worker: restaurants
  2) Frontend: select restaurant -> query restaurantCategories(restaurantId) -> Worker
  3) Frontend: select category -> query categoryDishes(restaurantId, categoryId) -> Worker
  4) Frontend: add dish to cart -> mutate add-to-cart (via internal cart state in Worker, not a separate endpoint) -> Cart updated in-memory
  5) Frontend: open cart -> mutation placeOrder(input) -> Worker calls Saleor draft-order flow:
     - draftOrderCreate (or equivalent) on Saleor; add order lines; complete draft order
     - Return orderId and status to frontend
  6) Frontend: show success; cart cleared

- Flow: Switch restaurant with active cart
  1) User has items in cart from Restaurant A; selects Restaurant B
  2) Worker logic detects mismatch; returns a GraphQL or Transport-layer error indicating cart reset:
     - Allowed action: Continue (clear cart) or Cancel
  3) If Continue, Worker resets in-memory cart and binds Restaurant B as the active cart; user proceeds to categories for Restaurant B

State management and cache
- Cart is stored in-memory per Telegram user (contextual to init data user id) for testability in specs.
- In production, consider CF KV or another store; this spec focuses on in-memory semantics for tests.

Error handling and observability
- Errors bubble up via GraphQL errors with descriptive messages.
- Client receives actionable hints (e.g., cart switch confirmation required).
