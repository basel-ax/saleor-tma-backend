Phase 1 — Contract and API Skeleton

Goals
- Define contract shapes (TypeScript interfaces) and the GraphQL surface skeleton required by specs/01-api-contract.md.
- Provide resolver interfaces that accept the contract inputs and return contract-shaped outputs with placeholder implementations.

Deliverables
- TypeScript interfaces for: Restaurant, Category, Dish, DeliveryLocation, OrderItemInput, PlaceOrderInput, PlaceOrderPayload.
- GraphQL schema skeleton (queries: restaurants, restaurantCategories, categoryDishes; mutation: placeOrder).
- Resolver interfaces/stubs referenced by the schema.

Notes
- This phase focuses on a clean, contract-first design so validators and tests can rely on stable shapes.

(End of Phase 1)
