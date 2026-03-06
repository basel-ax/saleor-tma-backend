Phase 4 — Place Order Flow (Saleor integration, mock)

Goals
- Implement placeOrder mutation wired to a mock/draft-order flow that simulates Saleor interaction.
- Return orderId and status to the client; integrate with in-memory cart state.

Deliverables
- Function signature: placeOrder(input: PlaceOrderInput, authContext): PlaceOrderPayload.
- Mocked Saleor integration path that creates a draft order and returns an orderId and status.
- Basic error handling mapping to GraphQL errors.

Notes
- This phase models the end-to-end checkout path while keeping dependencies deterministic for tests.

(End of Phase 4)
