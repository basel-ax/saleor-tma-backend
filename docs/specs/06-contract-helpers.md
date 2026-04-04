Contract Helpers for GraphQL Worker SpecKit

- Type mappings: Map Saleor response shapes to GraphQL contract shapes used by the frontend.
- Common error wrappers: Normalize errors into `{ code, message }` shape for GraphQL errors.
- Test data builders: Helpers to create in-memory restaurants, categories, and dishes for testing.
- Cart utilities: In-memory cart structure per Telegram user; helper to simulate adding/removing items and switching restaurants.
- Validation helpers: For required fields, delivery location vs Google Maps URL, etc.
