// Phase 2: GraphQL Resolvers with Auth Context
// Resolvers receive GraphQLContext with authenticated user info
// Aligns with specs/05-telegram-auth.md

import { Restaurant, Category, Dish, PlaceOrderInput, PlaceOrderPayload, GraphQLContext, AddToCartInput, UpdateCartItemInput, CartState, DeliveryLocation } from "./contracts";
import { logger } from "./logger";
import { getCartSync as getCart, addToCartSync as addToCart, updateCartItemSync as updateCartItem, removeFromCartSync as removeFromCart, clearCartSync as clearCart, getCartTotalSync as getCartTotal, getCartItemCountSync as getCartItemCount } from "./cart";
import { createSaleorOrder, toPlaceOrderPayload, OrderStatus } from "./saleorOrder";
import { forbiddenError } from "./errors";
import { requireRead, requireWrite } from "./auth";

// Sample data
const restaurants: Restaurant[] = [
  { 
    id: "rest1", 
    name: "Pizza Hub", 
    categories: [{ id: "cat1", name: "Pizzas" }], 
    deliveryLocations: [
      { id: "loc1", address: "123 Pizza Street", city: "New York", country: "USA", latitude: 40.7128, longitude: -74.0060 }
    ] 
  },
  { 
    id: "rest2", 
    name: "Sushi Lane", 
    categories: [{ id: "cat2", name: "Nigiri" }], 
    deliveryLocations: [
      { id: "loc2", address: "456 Sushi Avenue", city: "Los Angeles", country: "USA", latitude: 34.0522, longitude: -118.2437 }
    ] 
  },
];

const categories: Category[] = [
  { id: "cat1", name: "Pizzas" },
  { id: "cat2", name: "Nigiri" },
];

const dishes: Dish[] = [
  { id: "dish1", name: "Margherita", description: "Classic margherita pizza", price: 9.5, currency: "USD", categoryId: "cat1", imageUrl: "https://example.com/margherita.jpg", restaurantId: "rest1" },
  { id: "dish2", name: "Pepperoni", description: "Pepperoni pizza", price: 11.0, currency: "USD", categoryId: "cat1", imageUrl: "https://example.com/pepperoni.jpg", restaurantId: "rest1" },
  { id: "dish3", name: "Salmon Nigiri", description: "Salmon nigiri sushi", price: 2.5, currency: "USD", categoryId: "cat2", imageUrl: "https://example.com/salmon-nigiri.jpg", restaurantId: "rest2" },
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
    // Enforce read permissions
    const auth = requireRead(context.auth);
    if (!auth.valid) {
      logger.authFailure("permission_denied", context.auth.userId);
      throw forbiddenError();
    }
    // Log authenticated user (avoid logging sensitive data)
    console.log(`[Resolver] restaurants query for user ${context.auth.userId}`);
    return restaurants;
  },

  /**
   * Get categories for a restaurant
   */
  restaurantCategories: async (_: any, args: { restaurantId: string }, context: GraphQLContext): Promise<Category[]> => {
    const auth = requireRead(context.auth);
    if (!auth.valid) {
      logger.authFailure("permission_denied", context.auth.userId);
      throw forbiddenError();
    }
    console.log(`[Resolver] restaurantCategories for ${args.restaurantId}, user ${context.auth.userId}`);
    return categories;
  },

  /**
   * Get dishes for a category
   */
  categoryDishes: async (_: any, args: { categoryId: string }, context: GraphQLContext): Promise<Dish[]> => {
    const auth = requireRead(context.auth);
    if (!auth.valid) {
      logger.authFailure("permission_denied", context.auth.userId);
      throw forbiddenError();
    }
    console.log(`[Resolver] categoryDishes for ${args.categoryId}, user ${context.auth.userId}`);
    return dishes.filter(d => d.categoryId === args.categoryId);
  },

  // ============================================================
  // Phase 3: Cart Query Resolvers
  // ============================================================
  /**
   * Get current user's cart
   * Returns cart with items, total price, and item count
   */
  cart: async (_: any, __: any, context: GraphQLContext): Promise<{ restaurantId: string | null; items: any[]; total: number; itemCount: number }> => {
    const auth = requireRead(context.auth);
    if (!auth.valid) {
      logger.authFailure("permission_denied", context.auth.userId);
      throw forbiddenError();
    }
    const userId = context.auth.userId;
    console.log(`[Resolver] cart for user ${userId}`);
    
    const cart = getCart(userId);
    const total = getCartTotal(userId);
    const itemCount = getCartItemCount(userId);
    
    return {
      restaurantId: cart.restaurantId || null,
      items: cart.items,
      total,
      itemCount,
    };
  },
};

/**
 * Mutation resolvers with auth context
 */
const mutationResolvers = {
  /**
   * Place an order
   * Uses cart items and authenticated user from context
   * Creates a mock Saleor draft order
   * Clears cart after successful order
   */
  placeOrder: async (_: any, args: { input: PlaceOrderInput }, context: GraphQLContext): Promise<PlaceOrderPayload> => {
    // Enforce write permission for mutations
    const auth = requireWrite(context.auth);
    if (!auth.valid) {
      logger.authFailure("permission_denied", context.auth.userId);
      throw forbiddenError();
    }
    const userId = context.auth.userId;
    const userName = context.auth.name;
    const userLanguage = context.auth.language;
    console.log(`[Resolver] placeOrder by user ${userId} (${userName}, lang: ${userLanguage})`);
    
    // Validate input
    if (!args.input.restaurantId) {
      throw new Error("Restaurant is required");
    }

    // Get user's cart
    const cart = getCart(userId);
    
    // If cart items provided in input, use those; otherwise use cart
    let orderItems = args.input.items;
    let orderRestaurantId = args.input.restaurantId;
    
    // If no items in input, use cart items
    if (!orderItems || orderItems.length === 0) {
      if (cart.items.length === 0) {
        throw new Error("Cart is empty. Add items to your cart before placing an order.");
      }
      
      // Map cart items to order items
      orderItems = cart.items.map(item => ({
        dishId: item.dishId,
        quantity: item.quantity,
        notes: undefined,
      }));
      orderRestaurantId = cart.restaurantId || args.input.restaurantId;
    }

    // Validate delivery location
    if (!args.input.deliveryLocation?.address) {
      throw new Error("Delivery address is required");
    }

    // Build order input with cart items
    const orderInput: PlaceOrderInput = {
      restaurantId: orderRestaurantId,
      deliveryLocation: args.input.deliveryLocation,
      items: orderItems,
      customerNote: args.input.customerNote,
    };

    // Create mock Saleor order
    const result = await createSaleorOrder(orderInput, userId, userName, userLanguage);
    
    if (!result.success || !result.order) {
      const errorMsg = result.error || "Failed to create order";
      console.error(`[Resolver] placeOrder failed for user ${userId}: ${errorMsg}`);
      throw new Error(errorMsg);
    }

    // Clear cart after successful order
    clearCart(userId);
    console.log(`[Resolver] Cart cleared for user ${userId} after order ${result.order.id}`);
    
    // Return GraphQL payload
    return toPlaceOrderPayload(result.order);
  },

  // ============================================================
  // Phase 3: Cart Mutation Resolvers
  // ============================================================
  
  /**
   * Add item to cart
   * If restaurant changes, clears existing cart items
   */
  addToCart: async (_: any, args: { input: AddToCartInput }, context: GraphQLContext): Promise<{ restaurantId: string | null; items: any[]; total: number; itemCount: number }> => {
    const auth = requireWrite(context.auth);
    if (!auth.valid) {
      logger.authFailure("permission_denied", context.auth.userId);
      throw forbiddenError();
    }
    const userId = context.auth.userId;
    console.log(`[Resolver] addToCart for user ${userId}, dish ${args.input.dishId}, quantity ${args.input.quantity}`);
    
    const cart = addToCart(userId, args.input);
    const total = getCartTotal(userId);
    const itemCount = getCartItemCount(userId);
    
    return {
      restaurantId: cart.restaurantId || null,
      items: cart.items,
      total,
      itemCount,
    };
  },

  /**
   * Update quantity of cart item
   * Set quantity to 0 to remove item
   */
  updateCartItem: async (_: any, args: { input: UpdateCartItemInput }, context: GraphQLContext): Promise<{ restaurantId: string | null; items: any[]; total: number; itemCount: number }> => {
    const auth = requireWrite(context.auth);
    if (!auth.valid) {
      logger.authFailure("permission_denied", context.auth.userId);
      throw forbiddenError();
    }
    const userId = context.auth.userId;
    console.log(`[Resolver] updateCartItem for user ${userId}, dish ${args.input.dishId}, quantity ${args.input.quantity}`);
    
    const cart = updateCartItem(userId, args.input);
    const total = getCartTotal(userId);
    const itemCount = getCartItemCount(userId);
    
    return {
      restaurantId: cart.restaurantId || null,
      items: cart.items,
      total,
      itemCount,
    };
  },

  /**
   * Remove item from cart
   */
  removeCartItem: async (_: any, args: { dishId: string }, context: GraphQLContext): Promise<{ restaurantId: string | null; items: any[]; total: number; itemCount: number }> => {
    const auth = requireWrite(context.auth);
    if (!auth.valid) {
      logger.authFailure("permission_denied", context.auth.userId);
      throw forbiddenError();
    }
    const userId = context.auth.userId;
    console.log(`[Resolver] removeCartItem for user ${userId}, dish ${args.dishId}`);
    
    const cart = removeFromCart(userId, args.dishId);
    const total = getCartTotal(userId);
    const itemCount = getCartItemCount(userId);
    
    return {
      restaurantId: cart.restaurantId || null,
      items: cart.items,
      total,
      itemCount,
    };
  },

  /**
   * Clear entire cart
   */
  clearCart: async (_: any, __: any, context: GraphQLContext): Promise<{ restaurantId: string | null; items: any[]; total: number; itemCount: number }> => {
    const auth = requireWrite(context.auth);
    if (!auth.valid) {
      logger.authFailure("permission_denied", context.auth.userId);
      throw forbiddenError();
    }
    const userId = context.auth.userId;
    console.log(`[Resolver] clearCart for user ${userId}`);
    
    clearCart(userId);
    
    return {
      restaurantId: null,
      items: [],
      total: 0,
      itemCount: 0,
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
