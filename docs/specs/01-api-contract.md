GraphQL API Contract (Telegram TMA Worker)

Context
- The Cloudflare Worker exposes a GraphQL API at /graphql. All requests must include the header:
  - X-Telegram-Init-Data: <initData>
- The Worker serves as a BFF between the Telegram Mini App frontend and Saleor's order-management API.
- The test suite uses local in-memory cart state per Telegram user and mocks Saleor responses where appropriate.

Schema overview (part of the contract)
- Query restaurants(search: String): [Restaurant!]!
- Query restaurantCategories(restaurantId: ID!): [Category!]!
- Query categoryDishes(restaurantId: ID!, categoryId: ID!): [Dish!]!
- Mutation placeOrder(input: PlaceOrderInput!): PlaceOrderPayload!

Types (simplified for the contract)
- Restaurant { id: ID!, name: String!, description: String, imageUrl: String, tags: [String] }
- Category { id: ID!, restaurantId: ID!, name: String!, description: String, imageUrl: String }
- Dish { id: ID!, restaurantId: ID!, categoryId: ID!, name: String!, description: String, imageUrl: String, price: Float, currency: String }
- DeliveryLocation { latitude: Float!, longitude: Float! }
- OrderItemInput { dishId: ID!, quantity: Int! }
- PlaceOrderInput {
  restaurantId: ID!,
  items: [OrderItemInput!]!,
  deliveryLocation: DeliveryLocation,
  googleMapsUrl: String,
  comment: String
}
- PlaceOrderPayload { orderId: ID!, status: String! }

Sample requests and responses
- Query restaurants
  - Request:
    {
      "query": "query Restaurants($search: String) { restaurants(search: $search) { id name description imageUrl tags } }",
      "variables": {"search": null}
    }
- Response:
  {
    "data": {
      "restaurants": [
        { "id": "rest1", "name": "Pizza Hub", "description": "...,", "imageUrl": "...", "tags": ["pizza"] }
      ]
    }
  }

  - Mutation placeOrder
  - Request:
    {
      "query": "mutation PlaceOrder($input: PlaceOrderInput!) { placeOrder(input: $input) { orderId status } }",
      "variables": {
        "input": {
          "restaurantId": "rest1",
          "items": [{"dishId": "dish1", "quantity": 2}],
          "deliveryLocation": {"latitude": 40.7128, "longitude": -74.0060},
          "googleMapsUrl": null,
          "comment": "Leave at door"
        }
      }
    }
  - Response:
    {
      "data": { "placeOrder": { "orderId": "order123", "status": "created" } }
    }

Error cases
- 400/invalid-input: { "errors": [ { "message": "descriptive error" } ] }
- 401: missing/invalid init data header
- 500: backend Saleor error mapped to { "code": "internal_error", "message": "..." }

Notes
- The spec assumes the GraphQL surface is intentionally small and frontend-driven.
- For tests, define a minimal set of cases for each operation and validate shape and error handling.
