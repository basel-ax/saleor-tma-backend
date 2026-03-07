// Phase 2: GraphQL Handler with Auth Context Integration
// Validates Telegram Init Data and propagates AuthContext to resolvers
// Phase 7: Enhanced error handling with standardized codes

import { AppError, ErrorCode, unauthorizedError, internalError } from "./errors";
import { logger } from "./logger";

import { AuthContext, GraphQLContext, PlaceOrderPayload, PlaceOrderInput as PlaceOrderInputType, AddToCartInput, UpdateCartItemInput } from "./contracts";
import { extractAuthContext } from "./auth";
import { getCartSync, addToCart as cartAddToCartSync, updateCartItem as cartUpdateCartItemSync, removeFromCart as cartRemoveFromCartSync, clearCartSync, getCartTotalSync, getCartItemCountSync } from "./cart";

// Type for resolver arguments including context
export interface ResolverContext {
  context: GraphQLContext;
}

// Sample data (from Phase 1)
type Restaurant = { id: string; name: string; description?: string; imageUrl?: string; tags?: string[] };
type Category = { id: string; restaurantId: string; name: string; description?: string; imageUrl?: string };
type Dish = { id: string; restaurantId: string; categoryId: string; name: string; description?: string; imageUrl?: string; price?: number; currency?: string };
type PlaceOrderInput = PlaceOrderInputType;

const restaurants: Restaurant[] = [
  { id: "rest1", name: "Pizza Hub", description: "Neapolitan & brick-oven pizzas", imageUrl: "https://example.com/rest1.jpg", tags: ["pizza"] },
  { id: "rest2", name: "Sushi Lane", description: "Fresh nigiri and rolls", imageUrl: "https://example.com/rest2.jpg", tags: ["sushi"] },
];

const categories: Category[] = [
  { id: "cat1", restaurantId: "rest1", name: "Pizzas", description: "Brick-oven pizzas" },
  { id: "cat2", restaurantId: "rest2", name: "Nigiri", description: "Assorted nigiri" },
];

const dishes: Dish[] = [
  { id: "dish1", restaurantId: "rest1", categoryId: "cat1", name: "Margherita", description: "Tomato, mozzarella, basil", imageUrl: "https://example.com/d1.jpg", price: 9.5, currency: "USD" },
  { id: "dish2", restaurantId: "rest1", categoryId: "cat1", name: "Pepperoni", description: "Tomato, mozzarella, pepperoni", imageUrl: "https://example.com/d2.jpg", price: 11.0, currency: "USD" },
  { id: "dish3", restaurantId: "rest2", categoryId: "cat2", name: "Salmon Nigiri", description: "Salmon over rice", imageUrl: "https://example.com/d3.jpg", price: 2.5, currency: "USD" },
];

// In-memory cart keyed by authenticated userId (Phase 3 will use persistent storage)
const carts: Record<string, { restaurantId: string | null; items: { dishId: string; quantity: number; name?: string; price?: number; currency?: string }[] }> = {};

/**
 * Creates GraphQL context from request
 * Validates X-Telegram-Init-Data header per specs/05-telegram-auth.md
 */
function createContext(request: Request): GraphQLContext {
  const auth = extractAuthContext(request);
  return { auth };
}

/**
 * Error response helpers
 */
function errorResponse(error: AppError, requestId?: string): Response {
  // Log internal error ID for debugging
  if (error.internalId) {
    logger.error("request_error", { 
      errorCode: error.code, 
      internalId: error.internalId,
      requestId 
    });
  }

  return new Response(JSON.stringify({ errors: [error.toGraphQL()] }), {
    status: error.statusCode,
    headers: { "Content-Type": "application/json", "X-Request-Id": requestId || "" },
  });
}

function jsonResponse(obj: any): Response {
  return new Response(JSON.stringify(obj), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Main request handler with auth integration
 */
async function handleRequest(request: Request): Promise<Response> {
  // Phase 2: Auth context extraction
  const context = createContext(request);

  // Return 401 if auth is invalid (per specs/05-telegram-auth.md)
  if (!context.auth.valid) {
    const requestId = crypto.randomUUID();
    logger.authFailure(context.auth.errorCode || "unknown", requestId);
    return errorResponse(unauthorizedError(), requestId);
  }

  // Log authenticated user (avoid logging sensitive data in production)
  logger.authSuccess(context.auth.userId);

  // Parse GraphQL request body
  let body: any = {};
  if (request.method === "POST") {
    try {
      body = await request.json();
    } catch {
      body = {};
    }
  }

  const query: string = body?.query ?? "";
  const variables = body?.variables ?? {};

  // GraphQL resolver routing with auth context
  try {
    const result = await resolveGraphQL(query, variables, context);
    return jsonResponse({ data: result });
  } catch (error) {
    const requestId = crypto.randomUUID();
    
    if (error instanceof AppError) {
      return errorResponse(error, requestId);
    }

    logger.error("unhandled_error", { error: error instanceof Error ? error.message : "Unknown" });
    const internalErr = internalError(requestId);
    return errorResponse(internalErr, requestId);
  }
}

/**
 * GraphQL resolver dispatcher - routes queries/mutations to handlers
 * Receives GraphQLContext with authenticated user info
 */
async function resolveGraphQL(
  query: string,
  variables: any,
  context: GraphQLContext
): Promise<any> {
  // Query resolvers
  if (query.includes("restaurants(") || query.includes("restaurants")) {
    return { restaurants: resolveRestaurants(context) };
  }

  if (query.includes("restaurantCategories")) {
    const restaurantId = variables?.restaurantId || restaurants[0]?.id || "rest1";
    return { restaurantCategories: resolveCategories(restaurantId, context) };
  }

  if (query.includes("categoryDishes")) {
    const restaurantId = variables?.restaurantId || restaurants[0]?.id || "rest1";
    const categoryId = variables?.categoryId || categories.find((c) => c.restaurantId === restaurantId)?.id;
    return { categoryDishes: resolveDishes(restaurantId, categoryId, context) };
  }

  // Mutation resolvers
  if (query.includes("placeOrder")) {
    const input = variables?.input || { restaurantId: restaurants[0].id, items: [] };
    return { placeOrder: resolvePlaceOrder(input, context) };
  }

  // Phase 3: Cart Query Resolvers
  if (query.includes("cart(") || query.includes("cart")) {
    if (!query.includes("addToCart") && !query.includes("updateCartItem") && !query.includes("removeCartItem") && !query.includes("clearCart")) {
      return { cart: resolveCart(context) };
    }
  }

  // Phase 3: Cart Mutation Resolvers
  if (query.includes("addToCart")) {
    const input = variables?.input || { dishId: "", quantity: 1, restaurantId: "" };
    return { addToCart: resolveAddToCart(input, context) };
  }

  if (query.includes("updateCartItem")) {
    const input = variables?.input || { dishId: "", quantity: 1 };
    return { updateCartItem: resolveUpdateCartItem(input, context) };
  }

  if (query.includes("removeCartItem")) {
    const dishId = variables?.dishId || "";
    return { removeCartItem: resolveRemoveCartItem(dishId, context) };
  }

  if (query.includes("clearCart")) {
    return { clearCart: resolveClearCart(context) };
  }

  // Unknown operation
  return {};
}

// Resolver implementations receive GraphQLContext
function resolveRestaurants(context: GraphQLContext): Restaurant[] {
  // Could filter based on context.auth.userId preferences
  console.log(`[Resolver] restaurants for user ${context.auth.userId}`);
  return restaurants;
}

function resolveCategories(restaurantId: string, context: GraphQLContext): Category[] {
  console.log(`[Resolver] categories for restaurant ${restaurantId}, user ${context.auth.userId}`);
  return categories.filter((c) => c.restaurantId === restaurantId);
}

function resolveDishes(restaurantId: string, categoryId: string | undefined, context: GraphQLContext): Dish[] {
  console.log(`[Resolver] dishes for restaurant ${restaurantId}, category ${categoryId}, user ${context.auth.userId}`);
  return dishes.filter((d) => d.restaurantId === restaurantId && d.categoryId === categoryId);
}

function resolvePlaceOrder(input: PlaceOrderInput, context: GraphQLContext): PlaceOrderPayload {
  // Access authenticated user from context
  const userId = context.auth.userId;
  const userName = context.auth.name;
  
  console.log(`[Resolver] placeOrder by user ${userId} (${userName}) for restaurant ${input.restaurantId}`);
  
  // Create order with authenticated user info
  return {
    orderId: `order_${Date.now()}_${userId}`,
    status: "CREATED",
    estimatedDelivery: undefined,
  };
}

// ============================================================
// Phase 3: Cart Resolver Implementations
// ============================================================

function resolveCart(context: GraphQLContext): { restaurantId: string | null; items: any[]; total: number; itemCount: number } {
  const userId = context.auth.userId;
  console.log(`[Resolver] cart for user ${userId}`);
  
  const cart = getCartSync(userId);
  const total = getCartTotalSync(userId);
  const itemCount = getCartItemCountSync(userId);
  
  return {
    restaurantId: cart.restaurantId || null,
    items: cart.items,
    total,
    itemCount,
  };
}

function resolveAddToCart(input: AddToCartInput, context: GraphQLContext): { restaurantId: string | null; items: any[]; total: number; itemCount: number } {
  const userId = context.auth.userId;
  console.log(`[Resolver] addToCart for user ${userId}, dish ${input.dishId}, quantity ${input.quantity}`);
  
  const cart = cartAddToCartSync(userId, input);
  const total = getCartTotalSync(userId);
  const itemCount = getCartItemCountSync(userId);
  
  return {
    restaurantId: cart.restaurantId || null,
    items: cart.items,
    total,
    itemCount,
  };
}

function resolveUpdateCartItem(input: UpdateCartItemInput, context: GraphQLContext): { restaurantId: string | null; items: any[]; total: number; itemCount: number } {
  const userId = context.auth.userId;
  console.log(`[Resolver] updateCartItem for user ${userId}, dish ${input.dishId}, quantity ${input.quantity}`);
  
  const cart = cartUpdateCartItemSync(userId, input);
  const total = getCartTotalSync(userId);
  const itemCount = getCartItemCountSync(userId);
  
  return {
    restaurantId: cart.restaurantId || null,
    items: cart.items,
    total,
    itemCount,
  };
}

function resolveRemoveCartItem(dishId: string, context: GraphQLContext): { restaurantId: string | null; items: any[]; total: number; itemCount: number } {
  const userId = context.auth.userId;
  console.log(`[Resolver] removeCartItem for user ${userId}, dish ${dishId}`);
  
  const cart = cartRemoveFromCartSync(userId, dishId);
  const total = getCartTotalSync(userId);
  const itemCount = getCartItemCountSync(userId);
  
  return {
    restaurantId: cart.restaurantId || null,
    items: cart.items,
    total,
    itemCount,
  };
}

function resolveClearCart(context: GraphQLContext): { restaurantId: string | null; items: any[]; total: number; itemCount: number } {
  const userId = context.auth.userId;
  console.log(`[Resolver] clearCart for user ${userId}`);
  
    clearCartSync(userId);
  
  return {
    restaurantId: null,
    items: [],
    total: 0,
    itemCount: 0,
  };
}

export { handleRequest, GraphQLContext, createContext };
