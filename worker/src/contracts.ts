// Phase 1: Contract interfaces (TypeScript)
// Core domain contracts that align with specs/01-api-contract.md
// Phase 9: Updated with permission types and minimal surface area

// ============================================================
// Phase 2: Auth Context Interfaces
// Telegram authentication context propagated to GraphQL resolvers
// ============================================================
export interface AuthContext {
  userId: string;
  name?: string;
  language?: string;
  valid: boolean;
  errorCode?: string;
}

/**
 * Permission levels for authorization
 */
export enum Permission {
  READ = "read",
  WRITE = "write",
  ADMIN = "admin",
}

// ============================================================
// Phase 3: Cart Types (In-Memory Cart)
// ============================================================
export interface CartItem {
  dishId: string;
  quantity: number;
  name?: string;
  price?: number;
  currency?: string;
  description?: string;
  imageUrl?: string;
}

export interface CartState {
  restaurantId?: string | null;
  items: CartItem[];
}

export interface Cart {
  restaurantId: string | null;
  items: CartItem[];
  total: number;
  itemCount: number;
}

export interface AddToCartInput {
  dishId: string;
  quantity: number;
  name: string;
  price: number;
  currency: string;
  description: string;
  imageUrl: string;
  restaurantId: string;
}

export interface UpdateCartItemInput {
  dishId: string;
  quantity: number;
}

// ============================================================
// Domain Types - Minimal Surface Area
// Phase 9: Keep queries (restaurants, restaurantCategories, categoryDishes)
// and placeOrder mutation
// ============================================================

export interface Restaurant {
  id: string;
  name: string;
  categories: Category[];
  deliveryLocations?: DeliveryLocation[];
}

export interface Category {
  id: string;
  name: string;
}

export interface Dish {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  categoryId: string;
  imageUrl: string;
  restaurantId: string;
}

export interface DeliveryLocation {
  id?: string;
  address: string;
  city?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  mapsUrl?: string;
}

export interface OrderItemInput {
  dishId: string;
  quantity: number;
  notes?: string;
}

export interface PlaceOrderInput {
  restaurantId: string;
  deliveryLocation: DeliveryLocation;
  items: OrderItemInput[];
  customerNote?: string;
}

export interface PlaceOrderPayload {
  orderId: string;
  status: string;
  estimatedDelivery?: string;
}

// Phase 2: GraphQL Context Types
// Context passed to all resolvers with authenticated user info
export interface GraphQLContext {
  auth: AuthContext;
}

// ============================================================
// Phase 9 Notes: Minimal Surface Area
// ============================================================
//
// Queries (read operations):
// - restaurants: Get all restaurants
// - restaurantCategories: Get categories for a restaurant
// - categoryDishes: Get dishes for a category
// - cart: Get current user's cart
//
// Mutations (write operations):
// - placeOrder: Create an order
// - addToCart: Add item to cart
// - updateCartItem: Update cart item quantity
// - removeCartItem: Remove item from cart
// - clearCart: Clear entire cart
//
// Authorization:
// - All operations require valid Telegram Init Data (401 if missing/invalid)
// - Permission checks available for write operations (403 if insufficient)
//
// Error codes:
// - UNAUTHENTICATED: Missing or invalid X-Telegram-Init-Data (401)
// - FORBIDDEN: User lacks required permissions (403)
// - MISSING_RESTAURANT: Restaurant ID required
// - EMPTY_ORDER: No items in order
// - MISSING_ADDRESS: Delivery address required
// - ORDER_CREATE_FAILED: Saleor order creation failed
//
// See: task/phase-9-improve-code.md
// ============================================================
