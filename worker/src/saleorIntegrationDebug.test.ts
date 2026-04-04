// Phase 2: End-to-End Integration Tests for Saleor with Debug Mode
// Tests the complete flow from restaurant selection to order placement
// Includes TEST_DEBUG mode to save Saleor request/response data to tmp/ directory

import { describe, it, expect, beforeEach } from "vitest";
import {
  VALID_INIT_DATA,
  QUERY_RESTAURANTS,
  QUERY_RESTAURANT_CATEGORIES,
  QUERY_CATEGORY_DISHES,
  MUTATION_ADD_TO_CART,
  MUTATION_PLACE_ORDER,
  MUTATION_CLEAR_CART,
  buildPlaceOrderInput,
} from "./testHelpers";

// Use globalThis for environment variable (Cloudflare Worker compatible)
const env = typeof globalThis !== "undefined" ? (globalThis as any) : {};
const BASE_URL = env.SPEC_KIT_BASE_URL || "http://localhost:8787";

// Check if TEST_DEBUG mode is enabled
const isTestDebugEnabled = (): boolean => {
  try {
    return process.env.TEST_DEBUG === "true";
  } catch {
    return false;
  }
};

// Helper to save debug data to tmp/ directory (Node.js only, not in Cloudflare Worker)
const saveDebugData = (type: string, data: any): void => {
  if (!isTestDebugEnabled()) return;

  try {
    // Import fs only in Node.js environment
    const fs = require("fs");
    const path = require("path");

    // Ensure tmp directory exists
    const tmpDir = path.join(__dirname, "../../tmp");
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }

    // Create filename with timestamp
    const timestamp = Date.now();
    const filename = path.join(tmpDir, `saleor-${type}-${timestamp}.json`);

    // Write JSON data
    fs.writeFileSync(filename, JSON.stringify(data, null, 2));
  } catch (error) {
    // Silently fail in non-Node environments or if fs operations fail
    console.warn("Failed to save debug data:", error);
  }
};

interface GraphQLResponse<T = any> {
  data?: T;
  errors?: Array<{ message: string; code?: string }>;
}

async function graphqlRequest<T = any>(
  query: string,
  variables: Record<string, any> = {},
  initData: string = VALID_INIT_DATA,
): Promise<GraphQLResponse<T>> {
  const response = await fetch(`${BASE_URL}/graphql`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Telegram-Init-Data": initData,
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = await response.json();
  
  // Save debug data if TEST_DEBUG is enabled
  if (isTestDebugEnabled()) {
    saveDebugData("request", { query, variables });
    saveDebugData("response", json);
  }
  
  return json;
}

describe("Saleor Integration E2E Tests with Debug Mode", () => {
  beforeEach(async () => {
    // Clear cart before each test
    await graphqlRequest(MUTATION_CLEAR_CART);
  });

  it("should complete full flow: select restaurant, get categories/dishes, add to cart, place order with 'test order' comment", async () => {
    // Step 1: Query restaurants and select the first one
    const restaurantsResponse = await graphqlRequest(QUERY_RESTAURANTS);
    expect(restaurantsResponse.errors).toBeUndefined();
    expect(restaurantsResponse.data?.restaurants).toBeDefined();
    expect(Array.isArray(restaurantsResponse.data?.restaurants)).toBe(true);
    expect(restaurantsResponse.data?.restaurants.length).toBeGreaterThan(0);

    const firstRestaurant = restaurantsResponse.data?.restaurants[0];
    expect(firstRestaurant).toHaveProperty("id");
    expect(firstRestaurant).toHaveProperty("name");
    const restaurantId = firstRestaurant.id;

    // Step 2: Query categories for that restaurant
    const categoriesResponse = await graphqlRequest(
      QUERY_RESTAURANT_CATEGORIES,
      {
        restaurantId,
      },
    );
    expect(categoriesResponse.errors).toBeUndefined();
    expect(categoriesResponse.data?.restaurantCategories).toBeDefined();
    expect(Array.isArray(categoriesResponse.data?.restaurantCategories)).toBe(
      true,
    );
    expect(
      categoriesResponse.data?.restaurantCategories.length,
    ).toBeGreaterThan(0);

    const categories = categoriesResponse.data?.restaurantCategories;

    // Step 3: Query dishes for each category and collect all dish details
    interface DishDetails {
      id: string;
      name: string;
      price: number;
    }
    const dishesToAdd: DishDetails[] = [];
    for (const category of categories) {
      const dishesResponse = await graphqlRequest(QUERY_CATEGORY_DISHES, {
        categoryId: category.id,
        restaurantId,
      });
      expect(dishesResponse.errors).toBeUndefined();
      expect(dishesResponse.data?.categoryDishes).toBeDefined();
      expect(Array.isArray(dishesResponse.data?.categoryDishes)).toBe(true);

      // Add the first dish from each category to our list
      if (dishesResponse.data?.categoryDishes.length > 0) {
        const firstDish = dishesResponse.data?.categoryDishes[0];
        expect(firstDish).toHaveProperty("id");
        expect(firstDish).toHaveProperty("name");
        expect(firstDish).toHaveProperty("price");
        dishesToAdd.push({
          id: firstDish.id,
          name: firstDish.name,
          price: firstDish.price,
        });
      }
    }

    // Step 4: Add one of each dish to cart
    for (const dish of dishesToAdd) {
      const addToCartResponse = await graphqlRequest(MUTATION_ADD_TO_CART, {
        input: {
          dishId: dish.id,
          quantity: 1,
          name: dish.name,
          price: dish.price,
          currency: "USD",
          restaurantId,
        },
      });

      expect(addToCartResponse.errors).toBeUndefined();
      expect(addToCartResponse.data?.addToCart).toBeDefined();
      expect(addToCartResponse.data?.addToCart).toHaveProperty("restaurantId");
      expect(addToCartResponse.data?.addToCart.restaurantId).toBe(restaurantId);
    }

    // Step 5: Place order with customerNote: "test order"
    const placeOrderResponse = await graphqlRequest(MUTATION_PLACE_ORDER, {
      input: buildPlaceOrderInput({
        restaurantId,
        customerNote: "test order",
      }),
    });

    // Step 6: Verify order is created successfully
    expect(placeOrderResponse.errors).toBeUndefined();
    expect(placeOrderResponse.data).toBeDefined();
    expect(placeOrderResponse.data?.placeOrder).toBeDefined();
    expect(placeOrderResponse.data?.placeOrder).toHaveProperty("orderId");
    expect(placeOrderResponse.data?.placeOrder).toHaveProperty("status");
    expect(placeOrderResponse.data?.placeOrder.status).toBe("CREATED");
  });
});

// Export for potential use in other test files
export { graphqlRequest, isTestDebugEnabled, saveDebugData };