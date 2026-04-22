// Phase 2: GraphQL Resolvers with Auth Context
// Resolvers receive GraphQLContext with authenticated user info
// Aligns with specs/05-telegram-auth.md
// Phase 10: Channel entity support - internal channelId, GraphQL backward-compatible restaurantId

import {
  Restaurant,
  Category,
  Dish,
  PlaceOrderInput,
  PlaceOrderPayload,
  GraphQLContext,
  AddToCartInput,
  UpdateCartItemInput,
  CartState,
  DeliveryLocation,
} from "./contracts";
import { logger } from "./logger";
import {
  getCartSync as getCart,
  addToCartSync as addToCart,
  updateCartItemSync as updateCartItem,
  removeFromCartSync as removeFromCart,
  clearCartSync as clearCart,
  getCartTotalSync as getCartTotal,
  getCartItemCountSync as getCartItemCount,
} from "./cart";
import {
  createSaleorOrder,
  toPlaceOrderPayload,
  OrderStatus,
} from "./saleorOrder";
import { forbiddenError, badUserInputError, internalError } from "./errors";
import { requireRead, requireWrite, requireSuperadmin, isSuperadmin as checkIsSuperadmin } from "./auth";
import {
  fetchRestaurants,
  fetchCategories,
  fetchDishes,
  fetchChannels,
} from "./saleorService";
import {
  getChannelAdmin,
  setChannelAdmin,
  removeChannelAdmin,
  getUserChannels,
  toChannelAdminInfo,
} from "./channelAdmin";
import {
  LinkChannelInput,
  UnlinkChannelInput,
} from "./contracts";
import {
  createDish,
  updateDish,
  updateStock,
  updateStoreDescription,
  isChannelAdmin,
} from "./products";
import { badUserInputError } from "./errors";

/**
 * Query resolvers with auth context
 */
const queryResolvers = {
  /**
   * Get all restaurants
   * Auth context available via context.auth
   */
  restaurants: async (
    _: any,
    __: any,
    context: GraphQLContext,
  ): Promise<Restaurant[]> => {
    // Enforce read permissions
    const auth = requireRead(context.auth);
    if (!auth.valid) {
      logger.authFailure("permission_denied", context.auth.userId);
      throw forbiddenError();
    }
    // Log authenticated user (avoid logging sensitive data)
    console.log(`[Resolver] restaurants query for user ${context.auth.userId}`);
    return await fetchRestaurants();
  },

  /**
   * Get categories for a restaurant
   */
  restaurantCategories: async (
    _: any,
    args: { restaurantId: string },
    context: GraphQLContext,
  ): Promise<Category[]> => {
    const auth = requireRead(context.auth);
    if (!auth.valid) {
      logger.authFailure("permission_denied", context.auth.userId);
      throw forbiddenError();
    }
    const { restaurantId } = args;
    console.log(
      `[Resolver] restaurantCategories for ${restaurantId}, user ${context.auth.userId}`,
    );
    return await fetchCategories(restaurantId);
  },

  /**
   * Get dishes for a category
   */
  categoryDishes: async (
    _: any,
    args: { categoryId: string; restaurantId: string },
    context: GraphQLContext,
  ): Promise<Dish[]> => {
    const auth = requireRead(context.auth);
    if (!auth.valid) {
      logger.authFailure("permission_denied", context.auth.userId);
      throw forbiddenError();
    }
    const { categoryId, restaurantId } = args;
    console.log(
      `[Resolver] categoryDishes for ${categoryId}, restaurant ${restaurantId}, user ${context.auth.userId}`,
    );
    return await fetchDishes(categoryId, restaurantId);
  },

  // ============================================================
  // Phase 10: Superadmin & Channel Admin Query Resolvers
  // ============================================================

  /**
   * Check if current user is superadmin
   */
  isSuperadmin: async (
    _: any,
    __: any,
    context: GraphQLContext,
  ): Promise<boolean> => {
    if (!context.auth.valid) {
      return false;
    }
    return checkIsSuperadmin(context.auth.userId);
  },

  /**
   * Get channel admin info for a restaurant
   */
  channelAdmin: async (
    _: any,
    args: { restaurantId: string },
    context: GraphQLContext,
  ): Promise<{
    restaurantId: string;
    telegramUserId: string;
    assignedAt: string;
    assignedBy: string;
  } | null> => {
    const auth = requireRead(context.auth);
    if (!auth.valid) {
      logger.authFailure("permission_denied", context.auth.userId);
      throw forbiddenError();
    }
    const admin = await getChannelAdmin(args.restaurantId);
    return admin ? toChannelAdminInfo(admin) : null;
  },

  /**
   * Get all channels where current user is admin
   */
  myChannels: async (
    _: any,
    __: any,
    context: GraphQLContext,
  ): Promise<
    Array<{
      id: string;
      name: string;
      description?: string;
      hasAdmin: boolean;
    }>
  > => {
    const auth = requireRead(context.auth);
    if (!auth.valid) {
      logger.authFailure("permission_denied", context.auth.userId);
      throw forbiddenError();
    }
    const userChannels = await getUserChannels(context.auth.userId);
    const channels = await fetchChannels();

    return userChannels.map((uc) => {
      const channel = channels.find((c) => c.id === uc.restaurantId);
      return {
        id: uc.restaurantId,
        name: channel?.name || uc.restaurantId,
        description: channel?.description,
        hasAdmin: true,
      };
    });
  },

  // ============================================================
  // Phase 3: Cart Query Resolvers
  // ============================================================
  /**
   * Get current user's cart
   * Returns cart with items, total price, and item count
   */
  cart: async (
    _: any,
    __: any,
    context: GraphQLContext,
  ): Promise<{
    restaurantId: string | null;
    items: any[];
    total: number;
    itemCount: number;
  }> => {
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
  placeOrder: async (
    _: any,
    args: { input: PlaceOrderInput },
    context: GraphQLContext,
  ): Promise<PlaceOrderPayload> => {
    // Enforce write permission for mutations
    const auth = requireWrite(context.auth);
    if (!auth.valid) {
      logger.authFailure("permission_denied", auth.userId);
      throw forbiddenError();
    }
    const userId = auth.userId;
    const userName = auth.name;
    const userLanguage = auth.language;
    console.log(
      `[Resolver] placeOrder by user ${userId} (${userName}, lang: ${userLanguage})`,
    );

    // Validate input
    if (!args.input.restaurantId) {
      throw badUserInputError("Restaurant is required", "restaurantId");
    }

    // Get user's cart
    const cart = getCart(userId);

    // If cart items provided in input, use those; otherwise use cart
    let orderItems = args.input.items;
    let orderRestaurantId = args.input.restaurantId;

    // If no items in input, use cart items
    if (!orderItems || orderItems.length === 0) {
      if (cart.items.length === 0) {
        throw badUserInputError(
          "Cart is empty. Add items to your cart before placing an order.",
          "items",
        );
      }

      // Map cart items to order items
      orderItems = cart.items.map((item) => ({
        dishId: item.dishId,
        quantity: item.quantity,
        notes: undefined,
      }));
      orderRestaurantId = cart.restaurantId || args.input.restaurantId;
    }

    // Validate delivery location
    if (!args.input.deliveryLocation?.address) {
      throw badUserInputError("Delivery address is required", "deliveryLocation");
    }

    // Build order input with cart items
    const orderInput: PlaceOrderInput = {
      restaurantId: orderRestaurantId,
      deliveryLocation: args.input.deliveryLocation,
      items: orderItems,
      customerNote: args.input.customerNote,
    };

    // Validate that we have a restaurantId after building orderInput
    if (!orderInput.restaurantId) {
      throw badUserInputError("Restaurant is required", "restaurantId");
    }

    // Create mock Saleor order
    const result = await createSaleorOrder(
      orderInput,
      userId,
      userName,
      userLanguage,
    );

    if (!result.success || !result.order) {
      const errorMsg = result.error || "Failed to create order";
      console.error(
        `[Resolver] placeOrder failed for user ${userId}: ${errorMsg}`,
      );
      throw badUserInputError(errorMsg);
    }

    // Clear cart after successful order
    clearCart(userId);
    console.log(
      `[Resolver] Cart cleared for user ${userId} after order ${result.order.id}`,
    );

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
  addToCart: async (
    _: any,
    args: { input: AddToCartInput },
    context: GraphQLContext,
  ): Promise<{
    restaurantId: string | null;
    items: any[];
    total: number;
    itemCount: number;
  }> => {
    const auth = requireWrite(context.auth);
    if (!auth.valid) {
      logger.authFailure("permission_denied", context.auth.userId);
      throw forbiddenError();
    }
    const userId = auth.userId;
    const userName = auth.name;
    console.log(
      `[Resolver] addToCart for user ${userId} (${userName}), dish ${args.input.dishId}, quantity ${args.input.quantity}`,
    );

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
  updateCartItem: async (
    _: any,
    args: { input: UpdateCartItemInput },
    context: GraphQLContext,
  ): Promise<{
    restaurantId: string | null;
    items: any[];
    total: number;
    itemCount: number;
  }> => {
    const auth = requireWrite(context.auth);
    if (!auth.valid) {
      logger.authFailure("permission_denied", context.auth.userId);
      throw forbiddenError();
    }
    const userId = auth.userId;
    const userName = auth.name;
    console.log(
      `[Resolver] updateCartItem for user ${userId} (${userName}), dish ${args.input.dishId}, quantity ${args.input.quantity}`,
    );

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
  removeCartItem: async (
    _: any,
    args: { dishId: string },
    context: GraphQLContext,
  ): Promise<{
    restaurantId: string | null;
    items: any[];
    total: number;
    itemCount: number;
  }> => {
    const auth = requireWrite(context.auth);
    if (!auth.valid) {
      logger.authFailure("permission_denied", auth.userId);
      throw forbiddenError();
    }
    const userId = auth.userId;
    const userName = auth.name;
    console.log(
      `[Resolver] removeCartItem for user ${userId} (${userName}), dish ${args.dishId}`,
    );

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
  clearCart: async (
    _: any,
    __: any,
    context: GraphQLContext,
  ): Promise<{
    restaurantId: string | null;
    items: any[];
    total: number;
    itemCount: number;
  }> => {
    const auth = requireWrite(context.auth);
    if (!auth.valid) {
      logger.authFailure("permission_denied", auth.userId);
      throw forbiddenError();
    }
    const userId = auth.userId;
    const userName = auth.name;
    console.log(`[Resolver] clearCart for user ${userId} (${userName})`);

    clearCart(userId);

    return {
      restaurantId: null,
      items: [],
      total: 0,
      itemCount: 0,
    };
  },

  // ============================================================
  // Phase 10: Superadmin & Channel Admin Mutation Resolvers
  // ============================================================

  /**
   * Link channel to telegram user as admin (superadmin only)
   */
  linkChannelToTelegram: async (
    _: any,
    args: { input: LinkChannelInput },
    context: GraphQLContext,
  ): Promise<{
    success: boolean;
    channelAdmin: {
      restaurantId: string;
      telegramUserId: string;
      assignedAt: string;
      assignedBy: string;
    } | null;
  }> => {
    const auth = requireSuperadmin(context.auth);
    if (!auth.valid) {
      logger.authFailure("superadmin_required", context.auth.userId);
      throw forbiddenError();
    }
    const { restaurantId, telegramUserId } = args.input;
    console.log(
      `[Resolver] linkChannelToTelegram: ${restaurantId} -> ${telegramUserId} by superadmin ${context.auth.userId}`,
    );

    const admin = await setChannelAdmin(
      restaurantId,
      telegramUserId,
      context.auth.userId,
    );

    return {
      success: true,
      channelAdmin: toChannelAdminInfo(admin),
    };
  },

  /**
   * Unlink channel from telegram admin (superadmin only)
   */
  unlinkChannel: async (
    _: any,
    args: { input: UnlinkChannelInput },
    context: GraphQLContext,
  ): Promise<{ success: boolean }> => {
    const auth = requireSuperadmin(context.auth);
    if (!auth.valid) {
      logger.authFailure("superadmin_required", context.auth.userId);
      throw forbiddenError();
    }
    const { restaurantId } = args.input;
    console.log(
      `[Resolver] unlinkChannel: ${restaurantId} by superadmin ${context.auth.userId}`,
    );

    await removeChannelAdmin(restaurantId);

    return { success: true };
  },

  // ============================================================
  // Phase 10: Product Management Mutations
  // ============================================================

  createDish: async (
    _: any,
    args: { input: any },
    context: GraphQLContext,
  ): Promise<any> => {
    const auth = requireRead(context.auth);
    if (!auth.valid) {
      logger.authFailure("permission_denied", context.auth.userId);
      throw forbiddenError();
    }
    const { input } = args;
    const { restaurantId, name, description, price, currency, categoryId, imageUrl } = input;

    const isAdmin = await isChannelAdmin(context.auth.userId, restaurantId);
    if (!isAdmin) {
      logger.authFailure("channel_admin_required", context.auth.userId);
      throw forbiddenError();
    }

    console.log(
      `[Resolver] createDish: ${name} for ${restaurantId} by ${context.auth.userId}`,
    );

    const product = createDish({
      name,
      description,
      price,
      currency,
      categoryId,
      restaurantId,
      imageUrl,
    });

    return {
      success: true,
      dish: {
        id: product.id,
        name: product.name,
        description: product.description,
        price: product.price,
        currency: product.currency,
        categoryId: product.categoryId,
        imageUrl: product.imageUrl,
      },
    };
  },

  /**
   * Update an existing dish (channel admin only)
   */
  updateDish: async (
    _: any,
    args: { input: any },
    context: GraphQLContext,
  ): Promise<any> => {
    const auth = requireRead(context.auth);
    if (!auth.valid) {
      logger.authFailure("permission_denied", context.auth.userId);
      throw forbiddenError();
    }
    const { input } = args;
    const { dishId, restaurantId, name, description, price, currency, imageUrl } = input;

    const product = updateDish({
      dishId,
      name,
      description,
      price,
      currency,
      imageUrl,
    });

    if (!product) {
      throw badUserInputError("Product not found", "dishId");
    }

    const isAdmin = await isChannelAdmin(context.auth.userId, restaurantId);
    if (!isAdmin) {
      logger.authFailure("channel_admin_required", context.auth.userId);
      throw forbiddenError();
    }

    console.log(`[Resolver] updateDish: ${dishId} by ${context.auth.userId}`);

    return {
      success: true,
      dish: {
        id: product.id,
        name: product.name,
        description: product.description,
        price: product.price,
        currency: product.currency,
        categoryId: product.categoryId,
        imageUrl: product.imageUrl,
      },
    };
  },

  /**
   * Update stock quantity (channel admin only)
   */
  updateStock: async (
    _: any,
    args: { input: any },
    context: GraphQLContext,
  ): Promise<any> => {
    const auth = requireRead(context.auth);
    if (!auth.valid) {
      logger.authFailure("permission_denied", context.auth.userId);
      throw forbiddenError();
    }
    const { input } = args;
    const { dishId, quantity, restaurantId } = input;

    const product = updateStock({
      dishId,
      quantity,
    });

    if (!product) {
      throw badUserInputError("Product not found", "dishId");
    }

    const isAdmin = await isChannelAdmin(context.auth.userId, restaurantId);
    if (!isAdmin) {
      logger.authFailure("channel_admin_required", context.auth.userId);
      throw forbiddenError();
    }

    console.log(
      `[Resolver] updateStock: ${dishId} qty=${quantity} by ${context.auth.userId}`,
    );

    return {
      success: true,
      dishId,
      quantity,
    };
  },

  /**
   * Update store/channel description (channel admin only)
   */
  updateStoreDescription: async (
    _: any,
    args: { input: any },
    context: GraphQLContext,
  ): Promise<any> => {
    const auth = requireRead(context.auth);
    if (!auth.valid) {
      logger.authFailure("permission_denied", context.auth.userId);
      throw forbiddenError();
    }
    const { input } = args;
    const { restaurantId, description } = input;

    const isAdmin = await isChannelAdmin(context.auth.userId, restaurantId);
    if (!isAdmin) {
      logger.authFailure("channel_admin_required", context.auth.userId);
      throw forbiddenError();
    }

    console.log(
      `[Resolver] updateStoreDescription: ${restaurantId} by ${context.auth.userId}`,
    );

    updateStoreDescription(
      { restaurantId, description },
      context.auth.userId,
    );

    return {
      success: true,
      restaurantId,
      description,
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