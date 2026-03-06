// Phase 1: Contract interfaces (TypeScript)
// Core domain contracts that align with specs/01-api-contract.md

// ============================================================
// Phase 3: Cart Types (In-Memory Cart)
// ============================================================
export interface CartItem {
  dishId: string;
  quantity: number;
  name?: string;
  price?: number;
  currency?: string;
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
  name?: string;
  price?: number;
  currency?: string;
  restaurantId: string;
}

export interface UpdateCartItemInput {
  dishId: string;
  quantity: number;
}

// Phase 2: Auth Context Interfaces
// Telegram authentication context propagated to GraphQL resolvers
export interface AuthContext {
  userId: string;
  name?: string;
  language?: string;
  valid: boolean;
  error?: string;
}

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
  description?: string;
  price: number;
  categoryId: string;
  imageUrl?: string;
}

export interface DeliveryLocation {
  id?: string;
  address: string;
  city?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
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
