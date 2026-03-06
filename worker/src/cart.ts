// In-memory cart management (per Telegram user) - skeleton for tests
type CartItem = { dishId: string; quantity: number; name?: string; price?: number; currency?: string };
type Cart = { restaurantId?: string | null; items: CartItem[] };

const carts: Map<string, Cart> = new Map();

export function getCart(userId: string): Cart {
  if (!carts.has(userId)) carts.set(userId, { restaurantId: null, items: [] });
  return carts.get(userId)!;
}

export function setCart(userId: string, cart: Cart) {
  carts.set(userId, cart);
}

export function clearCart(userId: string) {
  carts.set(userId, { restaurantId: null, items: [] });
}
