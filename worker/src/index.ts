// Phase 2: GraphQL Handler with Auth Context Integration
// Validates Telegram Init Data and propagates AuthContext to resolvers

import { AuthContext, GraphQLContext, PlaceOrderPayload, PlaceOrderInput as PlaceOrderInputType } from "./contracts";
import { extractAuthContext } from "./auth";

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
function errorResponse(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
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
    return errorResponse(context.auth.error || "Unauthorized", 401);
  }

  // Log authenticated user (avoid logging sensitive data in production)
  console.log(`[Auth] User ${context.auth.userId} authenticated`);

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
    // GraphQL error handling
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[Error] ${message}`);
    return jsonResponse({
      errors: [{ message, locations: [], path: [] }],
    });
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

export { handleRequest, GraphQLContext, createContext };
