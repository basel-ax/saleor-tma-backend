// Phase 2: GraphQL Handler with Auth Context Integration
// Validates Telegram Init Data and propagates AuthContext to resolvers
// Phase 7: Enhanced error handling with standardized codes

import { AppError, unauthorizedError, internalError } from "./errors";
import { logger } from "./logger";

import {
  AuthContext,
  GraphQLContext,
  PlaceOrderPayload,
  PlaceOrderInput as PlaceOrderInputType,
  AddToCartInput,
  UpdateCartItemInput,
  Restaurant,
  Category,
  Dish,
} from "./contracts";
import { extractAuthContext } from "./auth";
import { resolvers } from "./resolvers";
import {
  fetchRestaurants,
  fetchCategories,
  fetchDishes,
} from "./saleorService";
import {
  getCartSync,
  getCartTotalSync,
  getCartItemCountSync,
  addToCartSync,
  updateCartItemSync,
  removeFromCartSync,
  clearCartSync,
} from "./cart";
import { initializeSaleorClient, isSaleorConfigured, getSaleorClient } from "./saleorClient";
import { setDebugMode } from "./logger";

// CORS headers for preflight and actual requests
// Allow any localhost port during development (5173, 5174, etc.)
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "Content-Type, X-Telegram-Init-Data, Telegram-Init-Data",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// In-memory cart keyed by authenticated userId (Phase 3 will use persistent storage)
const carts: Record<
  string,
  {
    restaurantId: string | null;
    items: {
      dishId: string;
      quantity: number;
      name?: string;
      price?: number;
      currency?: string;
    }[];
  }
> = {};

// Resolver implementations receive GraphQLContext
async function resolveRestaurants(
  context: GraphQLContext,
): Promise<Restaurant[]> {
  // Could filter based on context.auth.userId preferences
  console.log(`[Resolver] restaurants for user ${context.auth.userId}`);
  const contractRestaurants = await fetchRestaurants();
  // Map contract restaurants to local restaurant format
  return contractRestaurants.map((contractRest) => ({
    id: contractRest.id,
    name: contractRest.name,
    categories: [], // Empty categories array as required by Restaurant type
    deliveryLocations: undefined,
  }));
}

async function resolveCategories(
  restaurantId: string,
  context: GraphQLContext,
): Promise<Category[]> {
  console.log(
    `[Resolver] categories for restaurant ${restaurantId}, user ${context.auth.userId}`,
  );
  const contractCategories = await fetchCategories();
  // Map contract categories to local category format
  return contractCategories.map((contractCat) => ({
    id: contractCat.id,
    restaurantId: restaurantId, // Use the restaurantId from the resolver argument
    name: contractCat.name,
    description: undefined,
    imageUrl: undefined,
  }));
}

async function resolveDishes(
  restaurantId: string,
  categoryId: string | undefined,
  context: GraphQLContext,
): Promise<Dish[]> {
  console.log(
    `[Resolver] dishes for restaurant ${restaurantId}, category ${categoryId}, user ${context.auth.userId}`,
  );
  const contractDishes = await fetchDishes(categoryId);
  // Map contract dishes to local dish format
  return contractDishes.map((contractDish) => ({
    id: contractDish.id,
    restaurantId: contractDish.restaurantId,
    categoryId: contractDish.categoryId,
    name: contractDish.name,
    description: contractDish.description,
    imageUrl: contractDish.imageUrl,
    price: contractDish.price,
    currency: contractDish.currency,
  }));
}

function resolvePlaceOrder(
  input: PlaceOrderInputType,
  context: GraphQLContext,
): PlaceOrderPayload {
  // Access authenticated user from context
  const userId = context.auth.userId;
  const userName = context.auth.name;

  console.log(
    `[Resolver] placeOrder by user ${userId} (${userName}) for restaurant ${input.restaurantId}`,
  );

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

function resolveCart(context: GraphQLContext): {
  restaurantId: string | null;
  items: any[];
  total: number;
  itemCount: number;
} {
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

function resolveAddToCart(
  input: AddToCartInput,
  context: GraphQLContext,
): {
  restaurantId: string | null;
  items: any[];
  total: number;
  itemCount: number;
} {
  const userId = context.auth.userId;
  console.log(
    `[Resolver] addToCart for user ${userId}, dish ${input.dishId}, quantity ${input.quantity}`,
  );

  const cart = addToCartSync(userId, input);
  const total = getCartTotalSync(userId);
  const itemCount = getCartItemCountSync(userId);

  return {
    restaurantId: cart.restaurantId || null,
    items: cart.items,
    total,
    itemCount,
  };
}

function resolveUpdateCartItem(
  input: UpdateCartItemInput,
  context: GraphQLContext,
): {
  restaurantId: string | null;
  items: any[];
  total: number;
  itemCount: number;
} {
  const userId = context.auth.userId;
  console.log(
    `[Resolver] updateCartItem for user ${userId}, dish ${input.dishId}, quantity ${input.quantity}`,
  );

  const cart = updateCartItemSync(userId, input);
  const total = getCartTotalSync(userId);
  const itemCount = getCartItemCountSync(userId);

  return {
    restaurantId: cart.restaurantId || null,
    items: cart.items,
    total,
    itemCount,
  };
}

function resolveRemoveCartItem(
  dishId: string,
  context: GraphQLContext,
): {
  restaurantId: string | null;
  items: any[];
  total: number;
  itemCount: number;
} {
  const userId = context.auth.userId;
  console.log(`[Resolver] removeCartItem for user ${userId}, dish ${dishId}`);

  const cart = removeFromCartSync(userId, dishId);
  const total = getCartTotalSync(userId);
  const itemCount = getCartItemCountSync(userId);

  return {
    restaurantId: cart.restaurantId || null,
    items: cart.items,
    total,
    itemCount,
  };
}

function resolveClearCart(context: GraphQLContext): {
  restaurantId: string | null;
  items: any[];
  total: number;
  itemCount: number;
} {
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

// Environment type for Cloudflare Workers
interface Env {
  SALEOR_API_URL?: string;
  SALEOR_TOKEN?: string;
  TELEGRAM_BOT_TOKEN?: string;
  DEBUG?: string;
  CARTS?: KVNamespace;
}

// Register the fetch event listener only in Cloudflare Workers environment
if (typeof addEventListener === "function") {
  addEventListener("fetch", (event: FetchEvent) => {
    const cfEnv = (event as any).env;
    
    // ALWAYS read from env on EVERY request (different isolates may not share state)
    const saleorApiUrl = cfEnv?.SALEOR_API_URL;
    const saleorToken = cfEnv?.SALEOR_TOKEN;
    const debugVal = cfEnv?.DEBUG;
    
    // Set debug mode from environment
    setDebugMode(debugVal === "true");
    
    // ALWAYS initialize Saleor client with env
    initializeSaleorClient({
      SALEOR_API_URL: saleorApiUrl,
      SALEOR_TOKEN: saleorToken,
    });
    
    // Log on every request (will show in worker logs)
    console.log(">>> Request received");
    console.log("  SALEOR_API_URL:", saleorApiUrl ? "SET" : "NOT SET");
    console.log("  SALEOR_TOKEN:", saleorToken ? "SET" : "NOT SET");
    console.log("  isSaleorConfigured:", isSaleorConfigured());
    
    event.respondWith(handleRequest(event.request));
  });
}

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
      requestId,
    });
  }

  return new Response(JSON.stringify({ errors: [error.toGraphQL()] }), {
    status: error.statusCode,
    headers: {
      "Content-Type": "application/json",
      "X-Request-Id": requestId || "",
      ...CORS_HEADERS,
    },
  });
}

function jsonResponse(obj: any): Response {
  return new Response(JSON.stringify(obj), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS,
    },
  });
}

/**
 * Main request handler with auth integration
 */
export async function handleRequest(request: Request): Promise<Response> {
  // Handle CORS preflight requests - MUST be before auth checks
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: CORS_HEADERS,
    });
  }

  // Phase 2: Auth context extraction
  const context = createContext(request);

  // Return appropriate error based on auth validity (per specs/05-telegram-auth.md)
  if (!context.auth.valid) {
    const requestId = crypto.randomUUID();
    logger.authFailure(context.auth.errorCode || "unknown", requestId);
    
    // Return 403 for forbidden users, 401 for other auth issues
    if (context.auth.errorCode === "FORBIDDEN") {
      return errorResponse(forbiddenError(), requestId);
    }
    
    // Show actual error reason instead of generic message
    const errorMessage =
      context.auth.errorCode === "EXPIRED"
        ? "X-Telegram-Init-Data has expired"
        : "Missing X-Telegram-Init-Data";
    return errorResponse(unauthorizedError(errorMessage), requestId);
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

    if (error != null && typeof error === 'object' && 'toGraphQL' in error && typeof error.toGraphQL === 'function') {
      return errorResponse(error, requestId);
    }

    logger.error("unhandled_error", {
      error: error instanceof Error ? error.message : "Unknown",
    });
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
  context: GraphQLContext,
): Promise<any> {
  // Query resolvers
  if (query.includes("restaurants(") || query.includes("restaurants")) {
    const result = await resolvers.Query.restaurants(null, {}, context);
    return { restaurants: result };
  }

  if (query.includes("restaurantCategories")) {
    const restaurantId = variables?.restaurantId || "restA"; // Default to test restaurant ID
    const result = await resolvers.Query.restaurantCategories(
      null,
      { restaurantId },
      context,
    );
    return { restaurantCategories: result };
  }

  if (query.includes("categoryDishes")) {
    const restaurantId = variables?.restaurantId || "restA"; // Default to test restaurant ID
    const categoryId = variables?.categoryId || "catA"; // Default to test category ID
    const result = await resolvers.Query.categoryDishes(
      null,
      { categoryId, restaurantId },
      context,
    );
    return { categoryDishes: result };
  }

  // Mutation resolvers
  if (query.includes("placeOrder")) {
    const input =
      variables?.input ||
      ({
        restaurantId: "restA", // Default to test restaurant ID
        deliveryLocation: {
          address: "123 Test Street",
          city: "Test City",
          country: "US",
          latitude: 40.7128,
          longitude: -74.006,
        },
        items: [],
      } as PlaceOrderInputType);
    const result = await resolvers.Mutation.placeOrder(
      null,
      { input },
      context,
    );
    return { placeOrder: result };
  }

  // Phase 3: Cart Query Resolvers
  if (query.includes("cart(") || query.includes("cart")) {
    if (
      !query.includes("addToCart") &&
      !query.includes("updateCartItem") &&
      !query.includes("removeCartItem") &&
      !query.includes("clearCart")
    ) {
      const result = await resolvers.Query.cart(null, {}, context);
      return { cart: result };
    }
  }

  // Phase 3: Cart Mutation Resolvers
  if (query.includes("addToCart")) {
    const input = variables?.input || {
      dishId: "",
      quantity: 1,
      restaurantId: "",
    };
    const result = await resolvers.Mutation.addToCart(null, { input }, context);
    return { addToCart: result };
  }

  if (query.includes("updateCartItem")) {
    const input = variables?.input || { dishId: "", quantity: 1 };
    const result = await resolvers.Mutation.updateCartItem(
      null,
      { input },
      context,
    );
    return { updateCartItem: result };
  }

  if (query.includes("removeCartItem")) {
    const dishId = variables?.dishId || "";
    const result = await resolvers.Mutation.removeCartItem(
      null,
      { dishId: dishId },
      context,
    );
    return { removeCartItem: result };
  }

  if (query.includes("clearCart")) {
    const result = await resolvers.Mutation.clearCart(null, {}, context);
    return { clearCart: result };
  }

  // Unknown operation
  return {};
}
