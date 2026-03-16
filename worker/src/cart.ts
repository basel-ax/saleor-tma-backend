// Phase 3: Cart Management with Cloudflare KV Persistence
// Implements cart state with per-session restaurant context
// See: task/phase-3-in-memory-cart-and-state.md
// Phase 9: KV persistence enabled by default for production migration path

import { CartItem, CartState, AddToCartInput, UpdateCartItemInput } from "./contracts";

// KV namespace binding type (will be injected by Cloudflare Workers)
export interface CartKV {
  get(key: string, type?: "text" | "json"): Promise<string | any | null>;
  put(key: string, value: string | ReadableStream | ArrayBuffer, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

// Environment interface for Cloudflare Workers
export interface Env {
  CARTS?: CartKV;
}

// In-memory cart store (fallback when KV not available in tests)
const memoryCarts: Map<string, CartState> = new Map();

// Determine if we're in a Cloudflare Workers environment
function isWorkersEnvironment(): boolean {
  return typeof globalThis !== 'undefined' && 
    typeof (globalThis as any).__env__ !== 'undefined';
}

// Get KV instance from environment
function getKV(): CartKV | null {
  if (typeof globalThis !== 'undefined') {
    const env = (globalThis as any).__env__ as Env | undefined;
    return env?.CARTS ?? null;
  }
  return null;
}

/**
 * Get cart for a user from KV, creating empty cart if not exists
 */
export async function getCart(userId: string): Promise<CartState> {
  const kv = getKV();
  
  if (kv) {
    try {
      const data = await kv.get(`cart:${userId}`, "json");
      if (data) {
        return data as CartState;
      }
    } catch (error) {
      console.error(`[Cart] KV get error for user ${userId}:`, error);
    }
  }
  
  // Fallback to memory or create empty cart
  if (!memoryCarts.has(userId)) {
    memoryCarts.set(userId, { restaurantId: null, items: [] });
  }
  return memoryCarts.get(userId)!;
}

/**
 * Set entire cart for a user (persists to KV)
 */
export async function setCart(userId: string, cart: CartState): Promise<void> {
  const kv = getKV();
  
  if (kv) {
    try {
      // Cart expires after 24 hours (86400 seconds)
      await kv.put(`cart:${userId}`, JSON.stringify(cart), { expirationTtl: 86400 });
    } catch (error) {
      console.error(`[Cart] KV put error for user ${userId}:`, error);
    }
  }
  
  // Also update memory for test compatibility
  memoryCarts.set(userId, cart);
}

/**
 * Clear cart for a user (reset to empty, persists to KV)
 */
export async function clearCart(userId: string): Promise<void> {
  const cart: CartState = { restaurantId: null, items: [] };
  await setCart(userId, cart);
}

/**
 * Add item to cart or update quantity if item exists
 * Handles cart switch: if new restaurantId differs from cart's restaurantId,
 * clear the cart before adding the new item
 */
export async function addToCart(userId: string, input: AddToCartInput): Promise<CartState> {
  const cart = await getCart(userId);
  
  // Handle restaurant switch: clear cart if switching restaurants
  if (cart.restaurantId && cart.restaurantId !== input.restaurantId) {
    console.log(`[Cart] User ${userId} switching from restaurant ${cart.restaurantId} to ${input.restaurantId}, clearing cart`);
    await clearCart(userId);
    // Re-fetch the cleared cart
    const clearedCart = await getCart(userId);
    return addToCartToCart(clearedCart, userId, input);
  }
  
  return addToCartToCart(cart, userId, input);
}

/**
 * Internal function to add item to cart object
 */
function addToCartToCart(cart: CartState, userId: string, input: AddToCartInput): CartState {
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
       description: input.description,
       imageUrl: input.imageUrl,
     });
   }
   
   // Set restaurantId if not set
   if (!cart.restaurantId) {
     cart.restaurantId = input.restaurantId;
   }
   
   // Persist and return
   setCart(userId, cart);
   return cart;
 }

/**
 * Update quantity for a specific cart item
 */
export async function updateCartItem(userId: string, input: UpdateCartItemInput): Promise<CartState> {
  const cart = await getCart(userId);
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
  
  await setCart(userId, cart);
  return cart;
}

/**
 * Remove item from cart
 */
export async function removeFromCart(userId: string, dishId: string): Promise<CartState> {
  const cart = await getCart(userId);
  cart.items = cart.items.filter(item => item.dishId !== dishId);
  await setCart(userId, cart);
  return cart;
}

/**
 * Calculate total price for cart
 */
export async function getCartTotal(userId: string): Promise<number> {
  const cart = await getCart(userId);
  return cart.items.reduce((total, item) => {
    return total + (item.price || 0) * item.quantity;
  }, 0);
}

/**
 * Get total item count in cart
 */
export async function getCartItemCount(userId: string): Promise<number> {
  const cart = await getCart(userId);
  return cart.items.reduce((count, item) => count + item.quantity, 0);
}

// ============================================================
// Synchronous versions for backward compatibility with tests
// ============================================================

/**
 * Get cart synchronously (uses memory fallback)
 */
export function getCartSync(userId: string): CartState {
  if (!memoryCarts.has(userId)) {
    memoryCarts.set(userId, { restaurantId: null, items: [] });
  }
  return memoryCarts.get(userId)!;
}

/**
 * Set cart synchronously (uses memory fallback)
 */
export function setCartSync(userId: string, cart: CartState): void {
  memoryCarts.set(userId, cart);
}

/**
 * Clear cart synchronously (uses memory fallback)
 */
export function clearCartSync(userId: string): void {
  memoryCarts.set(userId, { restaurantId: null, items: [] });
}

/**
 * Add to cart synchronously (uses memory fallback)
 */
export function addToCartSync(userId: string, input: AddToCartInput): CartState {
  const cart = getCartSync(userId);
  
  if (cart.restaurantId && cart.restaurantId !== input.restaurantId) {
    clearCartSync(userId);
    const clearedCart = getCartSync(userId);
    return addToCartToCart(clearedCart, userId, input);
  }
  
  return addToCartToCart(cart, userId, input);
}

/**
 * Update cart item synchronously (uses memory fallback)
 */
export function updateCartItemSync(userId: string, input: UpdateCartItemInput): CartState {
  const cart = getCartSync(userId);
  const itemIndex = cart.items.findIndex(item => item.dishId === input.dishId);
  
  if (itemIndex < 0) {
    throw new Error(`Item ${input.dishId} not found in cart`);
  }
  
  if (input.quantity <= 0) {
    cart.items.splice(itemIndex, 1);
  } else {
    cart.items[itemIndex].quantity = input.quantity;
  }
  
  setCartSync(userId, cart);
  return cart;
}

/**
 * Remove from cart synchronously (uses memory fallback)
 */
export function removeFromCartSync(userId: string, dishId: string): CartState {
  const cart = getCartSync(userId);
  cart.items = cart.items.filter(item => item.dishId !== dishId);
  setCartSync(userId, cart);
  return cart;
}

/**
 * Get cart total synchronously (uses memory fallback)
 */
export function getCartTotalSync(userId: string): number {
  const cart = getCartSync(userId);
  return cart.items.reduce((total, item) => {
    return total + (item.price || 0) * item.quantity;
  }, 0);
}

/**
 * Get cart item count synchronously (uses memory fallback)
 */
export function getCartItemCountSync(userId: string): number {
  const cart = getCartSync(userId);
  return cart.items.reduce((count, item) => count + item.quantity, 0);
}

// ============================================================
// Phase 9 Notes: KV Cart Implementation
// ============================================================
//
// Current implementation uses Cloudflare KV for production with
// in-memory fallback for tests.
//
// Key features:
// - Cart data persisted to KV with 24-hour TTL
// - Automatic migration path between test (memory) and prod (KV)
// - Sync versions maintained for backward compatibility with tests
// - Same public API regardless of storage backend
//
// Environment requirements:
// - KV namespace binding "CARTS" in wrangler.toml
// - Environment variables: SALEOR_API_URL, SALEOR_TOKEN, TELEGRAM_BOT_TOKEN
//
// See: wrangler.toml for KV configuration
// ============================================================
