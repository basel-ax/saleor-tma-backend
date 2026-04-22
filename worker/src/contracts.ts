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
  SUPERADMIN = "superadmin",
}

// ============================================================
// Phase 10: Superadmin & Channel Admin Types
// ============================================================

/**
 * Channel Admin - links a channel (restaurant) to a telegram user
 */
export interface ChannelAdmin {
  restaurantId: string;
  telegramUserId: string;
  assignedAt: string;  // ISO timestamp
  assignedBy: string;  // Telegram user ID of superadmin
}

/**
 * Input for linking a channel to a telegram user (superadmin only)
 */
export interface LinkChannelInput {
  restaurantId: string;
  telegramUserId: string;
}

/**
 * Input for unlinking a channel from its telegram admin (superadmin only)
 */
export interface UnlinkChannelInput {
  restaurantId: string;
}

/**
 * Channel Admin Info - GraphQL return type
 */
export interface ChannelAdminInfo {
  restaurantId: string;
  telegramUserId: string;
  assignedAt: string;
  assignedBy: string;
}

/**
 * Channel Info - basic channel data for listing
 */
export interface ChannelInfo {
  id: string;
  name: string;
  description?: string;
  hasAdmin: boolean;
}

/**
 * Link Channel Payload - result of linkChannelToTelegram mutation
 */
export interface LinkChannelPayload {
  success: boolean;
  channelAdmin: ChannelAdminInfo | null;
}

/**
 * Unlink Channel Payload - result of unlinkChannel mutation
 */
export interface UnlinkChannelPayload {
  success: boolean;
}

// ============================================================
// Phase 10: Product Management Types
// ============================================================

export interface CreateDishInput {
  name: string;
  description: string;
  price: number;
  currency: string;
  categoryId: string;
  restaurantId: string;
  imageUrl?: string;
}

export interface UpdateDishInput {
  dishId: string;
  name?: string;
  description?: string;
  price?: number;
  currency?: string;
  imageUrl?: string;
}

export interface UpdateStockInput {
  dishId: string;
  quantity: number;
}

export interface ProductPayload {
  success: boolean;
  dish?: {
    id: string;
    name: string;
    description: string;
    price: number;
    currency: string;
    categoryId: string;
    imageUrl: string;
  };
}

export interface StockPayload {
  success: boolean;
  dishId: string;
  quantity: number;
}

export interface UpdateStoreDescriptionInput {
  restaurantId: string;
  description: string;
}

export interface StoreDescriptionPayload {
  success: boolean;
  restaurantId: string;
  description: string;
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
   channelId?: string | null;
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
 // Domain Types - Channel Entity (Saleor Multichannel)
 // Phase 10: Channel entity maps to Saleor Channels API
 // Internal use: Channel | GraphQL backward-compatible: Restaurant
 // ============================================================

 /**
  * Channel entity (internal) - maps to Saleor Channels
  * GraphQL API uses Restaurant for backward compatibility
  */
 export interface Channel {
   id: string;
   slug: string;
   name: string;
   isActive: boolean;
   currencyCode: string;
   defaultCountry?: {
     code: string;
     country?: string;
   };
   warehouses?: Array<{
     id: string;
     slug: string;
     name?: string;
   }>;
   // Legacy fields for backward compatibility with Restaurant interface
   description?: string;
   imageUrl?: string;
   tags?: string[];
   categories: Category[];
   deliveryLocations?: DeliveryLocation[];
 }

 /**
  * Restaurant type - kept for GraphQL backward compatibility
  * Maps from internal Channel entity
  */
 export interface Restaurant {
   id: string;
   name: string;
   description?: string;
   imageUrl?: string;
   tags?: string[];
   categories: Category[];
   deliveryLocations?: DeliveryLocation[];
 }

export interface Category {
   id: string;
   channelId?: string;
   restaurantId?: string;
   name: string;
   imageUrl?: string;
}

export interface Dish {
   id: string;
   name: string;
   description: string;
   price: number;
   currency: string;
   categoryId: string;
   channelId?: string;
   imageUrl: string;
   restaurantId?: string;
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
   channelId?: string;
}

export interface PlaceOrderInput {
   restaurantId: string;
   channelId?: string;
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
