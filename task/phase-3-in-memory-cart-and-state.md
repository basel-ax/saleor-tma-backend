Phase 3 — In‑Memory Cart and State Management

Goals
- Implement an in-memory cart per Telegram user, with per-session restaurant context.
- Provide utilities to add, remove, and retrieve cart items; support cart switches (restaurant changes).

Deliverables
- Data structures: CartItem { dishId: string, quantity: number }, CartState { restaurantId?: string, items: CartItem[] }.
- Cart utilities: addToCart(userId, item), getCart(userId), clearCart(userId).
- Notes on migration plan to a persistent store (e.g., Cloudflare KV) for production.

Notes
- Per-spec testability uses in-memory state; prepare for future migration without changing public API shape.

(End of Phase 3)
