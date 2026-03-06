// Phase 2: GraphQL Resolvers with Auth Context
// Resolvers receive GraphQLContext with authenticated user info
// Aligns with specs/05-telegram-auth.md

import { Restaurant, Category, Dish, PlaceOrderInput, PlaceOrderPayload, GraphQLContext } from "./contracts";

// Sample data
const restaurants: Restaurant[] = [
  { id: "rest1", name: "Pizza Hub", categories: [], deliveryLocations: [] },
  { id: "rest2", name: "Sushi Lane", categories: [], deliveryLocations: [] },
];

const categories: Category[] = [
  { id: "cat1", name: "Pizzas" },
  { id: "cat2", name: "Nigiri" },
];

const dishes: Dish[] = [
  { id: "dish1", name: "Margherita", price: 9.5, categoryId: "cat1" },
  { id: "dish2", name: "Pepperoni", price: 11.0, categoryId: "cat1" },
  { id: "dish3", name: "Salmon Nigiri", price: 2.5, categoryId: "cat2" },
];

/**
 * Query resolvers with auth context
 */
const queryResolvers = {
  /**
   * Get all restaurants
   * Auth context available via context.auth
   */
  restaurants: async (_: any, __: any, context: GraphQLContext): Promise<Restaurant[]> => {
    // Log authenticated user (avoid logging sensitive data)
    console.log(`[Resolver] restaurants query for user ${context.auth.userId}`);
    
    // Could filter based on user preferences from context.auth
    return restaurants;
  },

  /**
   * Get categories for a restaurant
   */
  restaurantCategories: async (_: any, args: { restaurantId: string }, context: GraphQLContext): Promise<Category[]> => {
    console.log(`[Resolver] restaurantCategories for ${args.restaurantId}, user ${context.auth.userId}`);
    return categories;
  },

  /**
   * Get dishes for a category
   */
  categoryDishes: async (_: any, args: { categoryId: string }, context: GraphQLContext): Promise<Dish[]> => {
    console.log(`[Resolver] categoryDishes for ${args.categoryId}, user ${context.auth.userId}`);
    return dishes.filter(d => d.categoryId === args.categoryId);
  },
};

/**
 * Mutation resolvers with auth context
 */
const mutationResolvers = {
  /**
   * Place an order
   * Uses authenticated user from context.auth for order attribution
   */
  placeOrder: async (_: any, args: { input: PlaceOrderInput }, context: GraphQLContext): Promise<PlaceOrderPayload> => {
    const userId = context.auth.userId;
    const userName = context.auth.name;
    const userLanguage = context.auth.language;
    
    console.log(`[Resolver] placeOrder by user ${userId} (${userName}, lang: ${userLanguage})`);
    
    // Validate input (Phase 2: additional validation can be added here)
    if (!args.input.restaurantId || !args.input.items || args.input.items.length === 0) {
      throw new Error("Invalid order: restaurantId and items are required");
    }

    // Create order with authenticated user attribution
    return {
      orderId: `order_${Date.now()}_${userId}`,
      status: "CREATED",
      estimatedDelivery: undefined,
    };
  },
};

// Combined resolvers object
export const resolvers = {
  Query: queryResolvers,
  Mutation: mutationResolvers,
};

export default resolvers;

// Export individual resolvers for direct use
export { queryResolvers, mutationResolvers };
