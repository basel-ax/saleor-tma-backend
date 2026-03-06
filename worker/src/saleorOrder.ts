// Phase 4: Mock Saleor Order Service
// Simulates Saleor API interaction for draft order creation
// Aligns with task/phase-4-place-order-flow.md

import { PlaceOrderInput, PlaceOrderPayload, DeliveryLocation, OrderItemInput } from "./contracts";

/**
 * Order status enum for type safety
 */
export type OrderStatus = "CREATED" | "CONFIRMED" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED";

/**
 * Internal order representation (matches Saleor order structure)
 */
export interface SaleorOrder {
  id: string;
  status: OrderStatus;
  total: {
    gross: {
      amount: number;
      currency: string;
    };
  };
  deliveryAddress: {
    address: string;
    city?: string;
    country?: string;
  };
  lines: Array<{
    variantId: string;
    quantity: number;
    productName: string;
  }>;
  customerNote?: string;
  createdAt: string;
}

/**
 * Result from mock Saleor order creation
 */
export interface CreateOrderResult {
  success: boolean;
  order?: SaleorOrder;
  error?: string;
  errorCode?: string;
}

/**
 * Mock in-memory order store (for testing/debugging)
 * In production, this would be replaced by actual Saleor API calls
 */
const orders: Map<string, SaleorOrder> = new Map();

/**
 * Create a mock Saleor draft order from cart data
 * 
 * This simulates the Saleor orderCreate mutation:
 * https://docs.saleor.io/docs/3.0/api-reference/mutations/orderCreate
 * 
 * @param input - Order input from GraphQL mutation
 * @param userId - Authenticated user ID from context
 * @param userName - User's name from context
 * @param userLanguage - User's language from context
 * @returns CreateOrderResult with order or error
 */
export async function createSaleorOrder(
  input: PlaceOrderInput,
  userId: string,
  userName?: string,
  userLanguage?: string
): Promise<CreateOrderResult> {
  // Validate input
  if (!input.restaurantId) {
    return {
      success: false,
      error: "Restaurant is required",
      errorCode: "MISSING_RESTAURANT",
    };
  }

  if (!input.items || input.items.length === 0) {
    return {
      success: false,
      error: "Order must contain at least one item",
      errorCode: "EMPTY_ORDER",
    };
  }

  // Validate delivery location
  if (!input.deliveryLocation?.address) {
    return {
      success: false,
      error: "Delivery address is required",
      errorCode: "MISSING_ADDRESS",
    };
  }

  try {
    // Generate unique order ID (simulates Saleor ID format)
    const orderId = `order:${Date.now()}:${userId}`;
    const orderNumber = orders.size + 1;

    // Create order lines from input items
    const lines = input.items.map((item: OrderItemInput) => ({
      variantId: item.dishId,
      quantity: item.quantity,
      productName: `Dish ${item.dishId}`,
    }));

    // Calculate total (simplified - in real implementation would use actual prices)
    const totalAmount = lines.reduce((sum, line) => sum + (line.quantity * 10), 0); // Mock price

    // Create Saleor order object
    const order: SaleorOrder = {
      id: orderId,
      status: "CREATED", // Draft status
      total: {
        gross: {
          amount: totalAmount,
          currency: "USD",
        },
      },
      deliveryAddress: {
        address: input.deliveryLocation.address,
        city: input.deliveryLocation.city,
        country: input.deliveryLocation.country,
      },
      lines,
      customerNote: input.customerNote,
      createdAt: new Date().toISOString(),
    };

    // Store order (in-memory for mock)
    orders.set(orderId, order);

    // Log order creation
    console.log(`[SaleorOrder] Created order ${orderId} for user ${userId} (order #${orderNumber})`);
    console.log(`[SaleorOrder] Restaurant: ${input.restaurantId}, Items: ${lines.length}, Total: ${totalAmount} USD`);

    return {
      success: true,
      order,
    };
  } catch (error) {
    console.error(`[SaleorOrder] Failed to create order for user ${userId}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error creating order",
      errorCode: "ORDER_CREATE_FAILED",
    };
  }
}

/**
 * Convert Saleor order to GraphQL payload
 */
export function toPlaceOrderPayload(order: SaleorOrder): PlaceOrderPayload {
  // Calculate estimated delivery (mock: 30-45 minutes from now)
  const estimatedMinutes = 30 + Math.floor(Math.random() * 15);
  const estimatedDate = new Date(Date.now() + estimatedMinutes * 60 * 1000);

  return {
    orderId: order.id,
    status: order.status,
    estimatedDelivery: estimatedDate.toISOString(),
  };
}

/**
 * Get order by ID (for debugging/testing)
 */
export function getOrder(orderId: string): SaleorOrder | undefined {
  return orders.get(orderId);
}

/**
 * Get all orders (for debugging/testing)
 */
export function getAllOrders(): SaleorOrder[] {
  return Array.from(orders.values());
}

/**
 * Clear all orders (for testing)
 */
export function clearOrders(): void {
  orders.clear();
}

// ============================================================
// Migration Notes for Production Saleor Integration
// ============================================================
//
// Current implementation is a mock for testing purposes.
// For production with real Saleor:
//
// 1. Replace createSaleorOrder with actual Saleor API call:
//    const saleorClient = new SaleorClient(SALEOR_API_URL, SALEOR_TOKEN);
//    const result = await saleorClient.execute(ORDER_CREATE_MUTATION, variables);
//
// 2. Map Saleor response to PlaceOrderPayload:
//    return toPlaceOrderPayload(saleorOrder);
//
// 3. Add proper error handling for Saleor API errors:
//    - Network errors
//    - Authentication errors
//    - Validation errors
//    - Rate limiting
//
// 4. Consider async order confirmation:
//    - Use Saleor webhooks for order status updates
//    - Store order reference in user session
//
// See: task/phase-4-place-order-flow.md
// ============================================================
