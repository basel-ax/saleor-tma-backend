// Phase 3: In-memory cart management (per Telegram user)
// Implements cart state with per-session restaurant context
// See: task/phase-3-in-memory-cart-and-state.md

import { CartItem, CartState, AddToCartInput, UpdateCartItemInput } from "./contracts";

// In-memory cart store keyed by Telegram userId
const carts: Map<string, CartState> = new Map();

/**
 * Get cart for a user, creating empty cart if not exists
 */
export function getCart(userId: string): CartState {
  if (!carts.has(userId)) {
    carts.set(userId, { restaurantId: null, items: [] });
  }
  return carts.get(userId)!;
}

/**
 * Set entire cart for a user
 */
export function setCart(userId: string, cart: CartState): void {
  carts.set(userId, cart);
}

/**
 * Clear cart for a user (reset to empty)
 */
export function clearCart(userId: string): void {
  carts.set(userId, { restaurantId: null, items: [] });
}

/**
 * Add item to cart or update quantity if item exists
 * Handles cart switch: if new restaurantId differs from cart's restaurantId,
 * clear the cart before adding the new item
 */
export function addToCart(userId: string, input: AddToCartInput): CartState {
  const cart = getCart(userId);
  
  // Handle restaurant switch: clear cart if switching restaurants
  if (cart.restaurantId && cart.restaurantId !== input.restaurantId) {
    console.log(`[Cart] User ${userId} switching from restaurant ${cart.restaurantId} to ${input.restaurantId}, clearing cart`);
    clearCart(userId);
  }
  
  const existingItemIndex = cart.items.findIndex(item => item.dishId === input.dishId);
  
  if (existingItemIndex >= 0) {
    // Update quantity of existing item
    cart.items[existingItemIndex].quantity += input.quantity;
  } else {
    // Add new item
    cart.items.push({
      dishId: input.dishId,
      quantity: input.quantity,
      name: input.name,
      price: input.price,
      currency: input.currency,
    });
  }
  
  // Set restaurantId if not set
  if (!cart.restaurantId) {
    cart.restaurantId = input.restaurantId;
  }
  
  setCart(userId, cart);
  return cart;
}

/**
 * Update quantity for a specific cart item
 */
export function updateCartItem(userId: string, input: UpdateCartItemInput): CartState {
  const cart = getCart(userId);
  const itemIndex = cart.items.findIndex(item => item.dishId === input.dishId);
  
  if (itemIndex < 0) {
    throw new Error(`Item ${input.dishId} not found in cart`);
  }
  
  if (input.quantity <= 0) {
    // Remove item if quantity is 0 or negative
    cart.items.splice(itemIndex, 1);
  } else {
    cart.items[itemIndex].quantity = input.quantity;
  }
  
  setCart(userId, cart);
  return cart;
}

/**
 * Remove item from cart
 */
export function removeFromCart(userId: string, dishId: string): CartState {
  const cart = getCart(userId);
  cart.items = cart.items.filter(item => item.dishId !== dishId);
  setCart(userId, cart);
  return cart;
}

/**
 * Calculate total price for cart
 */
export function getCartTotal(userId: string): number {
  const cart = getCart(userId);
  return cart.items.reduce((total, item) => {
    return total + (item.price || 0) * item.quantity;
  }, 0);
}

/**
 * Get total item count in cart
 */
export function getCartItemCount(userId: string): number {
  const cart = getCart(userId);
  return cart.items.reduce((count, item) => count + item.quantity, 0);
}

// ============================================================
// Migration Notes for Phase 3 (Persistent Store)
// ============================================================
//
// Current implementation uses in-memory Map for testability.
// For production with Cloudflare KV:
//
// 1. Replace the `carts` Map with Cloudflare KV binding:
//    - const cartKV = await env.CART_KV; // from wrangler.toml binding
//
// 2. Update functions to use async KV operations:
//    - await cartKV.get(userId, "json") to read
//    - await cartKV.put(userId, JSON.stringify(cart)) to write
//
// 3. Consider TTL/expiration for cart data (e.g., 24 hours)
//
// 4. Keep the same public API shape (getCart, addToCart, etc.)
//    so migration only changes internal implementation
//
// Example migration sketch:
//    export async function getCart(userId: string): Promise<CartState> {
//      const data = await cartKV.get(userId, "json");
//      return data || { restaurantId: null, items: [] };
//    }
//
// See: specs/04-deployment.md for Cloudflare KV setup
// ============================================================
