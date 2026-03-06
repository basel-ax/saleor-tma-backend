// Phase 5: Test Helper Utilities
// Provides mock data builders and test fixtures for spec-kit autotests
// Aligns with specs/03-autotests.md

import { Restaurant, Category, Dish, Cart, PlaceOrderInput, AuthContext } from "./contracts";

// ============================================================
// Test Data Constants (from specs/03-autotests.md)
// ============================================================

export const TEST_RESTAURANTS = {
  REST_A: { id: "restA", name: "Pizza Place" },
  REST_B: { id: "restB", name: "Sushi House" },
};

export const TEST_DISHES = {
  DISH_A1: { id: "dishA1", name: "Margherita Pizza", price: 9.5, categoryId: "catA" },
  DISH_A2: { id: "dishA2", name: "Pepperoni Pizza", price: 11.0, categoryId: "catA" },
  DISH_B1: { id: "dishB1", name: "Salmon Nigiri", price: 2.5, categoryId: "catB" },
};

export const TEST_CATEGORIES = {
  CAT_A: { id: "catA", name: "Pizzas" },
  CAT_B: { id: "catB", name: "Nigiri" },
};

// ============================================================
// Mock Data Builders
// ============================================================

/**
 * Build a Restaurant object for testing
 */
export function buildRestaurant(overrides: Partial<Restaurant> = {}): Restaurant {
  return {
    id: TEST_RESTAURANTS.REST_A.id,
    name: "Test Restaurant",
    categories: [],
    deliveryLocations: [],
    ...overrides,
  };
}

/**
 * Build a Category object for testing
 */
export function buildCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: TEST_CATEGORIES.CAT_A.id,
    name: "Test Category",
    ...overrides,
  };
}

/**
 * Build a Dish object for testing
 */
export function buildDish(overrides: Partial<Dish> = {}): Dish {
  return {
    id: TEST_DISHES.DISH_A1.id,
    name: "Test Dish",
    price: 9.99,
    categoryId: TEST_CATEGORIES.CAT_A.id,
    description: "Test description",
    imageUrl: "https://example.com/image.jpg",
    ...overrides,
  };
}

/**
 * Build a Cart object for testing
 */
export function buildCart(overrides: Partial<Cart> = {}): Cart {
  const defaultCart: Cart = {
    restaurantId: TEST_RESTAURANTS.REST_A.id,
    items: [
      {
        dishId: TEST_DISHES.DISH_A1.id,
        quantity: 1,
        name: TEST_DISHES.DISH_A1.name,
        price: TEST_DISHES.DISH_A1.price,
        currency: "USD",
      },
    ],
    total: TEST_DISHES.DISH_A1.price,
    itemCount: 1,
  };
  return { ...defaultCart, ...overrides };
}

/**
 * Build a PlaceOrderInput for testing
 */
export function buildPlaceOrderInput(overrides: Partial<PlaceOrderInput> = {}): PlaceOrderInput {
  const defaultInput: PlaceOrderInput = {
    restaurantId: TEST_RESTAURANTS.REST_A.id,
    deliveryLocation: {
      address: "123 Test Street",
      city: "Test City",
      country: "US",
      latitude: 40.7128,
      longitude: -74.006,
    },
    items: [
      {
        dishId: TEST_DISHES.DISH_A1.id,
        quantity: 2,
      },
    ],
    customerNote: "Test note",
  };
  return { ...defaultInput, ...overrides };
};

// ============================================================
// Auth Context Helpers
// ============================================================

/**
 * Valid test Telegram init data for testing
 * Contains minimal valid fields for auth validation
 */
export const VALID_INIT_DATA = [
  "auth_date=1700000000",
  "hash=test_hash",
  "user={\"id\":\"123456789\",\"first_name\":\"Test\",\"last_name\":\"User\",\"language_code\":\"en\"}",
].join("&");

/**
 * Invalid/expired init data for negative testing
 */
export const EXPIRED_INIT_DATA = [
  "auth_date=1000000000", // Old timestamp
  "hash=test_hash",
  "user={\"id\":\"123456789\",\"first_name\":\"Test\",\"last_name\":\"User\"}",
].join("&");

/**
 * Build a valid AuthContext for testing
 */
export function buildAuthContext(overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    userId: "123456789",
    name: "Test User",
    language: "en",
    valid: true,
    ...overrides,
  };
}

/**
 * Build an invalid AuthContext for testing
 */
export function buildInvalidAuthContext(errorCode: string = "UNAUTHENTICATED"): AuthContext {
  return {
    userId: "",
    valid: false,
    errorCode,
  };
}

// ============================================================
// GraphQL Query/Mutation Builders
// ============================================================

/**
 * Build a GraphQL request body
 */
export function buildGraphQLRequest(query: string, variables: Record<string, any> = {}): string {
  return JSON.stringify({ query, variables });
}

/**
 * Restaurants query
 */
export const QUERY_RESTAURANTS = `
  query Restaurants($search: String) {
    restaurants(search: $search) {
      id
      name
      description
      imageUrl
      tags
    }
  }
`;

/**
 * Restaurant categories query
 */
export const QUERY_RESTAURANT_CATEGORIES = `
  query RestaurantCategories($restaurantId: ID!) {
    restaurantCategories(restaurantId: $restaurantId) {
      id
      name
    }
  }
`;

/**
 * Category dishes query
 */
export const QUERY_CATEGORY_DISHES = `
  query CategoryDishes($categoryId: ID!) {
    categoryDishes(categoryId: $categoryId) {
      id
      name
      description
      price
      categoryId
      imageUrl
    }
  }
`;

/**
 * Cart query
 */
export const QUERY_CART = `
  query Cart {
    cart {
      restaurantId
      items {
        dishId
        quantity
        name
        price
        currency
      }
      total
      itemCount
    }
  }
`;

/**
 * Place order mutation
 */
export const MUTATION_PLACE_ORDER = `
  mutation PlaceOrder($input: PlaceOrderInput!) {
    placeOrder(input: $input) {
      orderId
      status
      estimatedDelivery
    }
  }
`;

/**
 * Add to cart mutation
 */
export const MUTATION_ADD_TO_CART = `
  mutation AddToCart($input: AddToCartInput!) {
    addToCart(input: $input) {
      restaurantId
      items {
        dishId
        quantity
        name
        price
        currency
      }
      total
      itemCount
    }
  }
`;

/**
 * Clear cart mutation
 */
export const MUTATION_CLEAR_CART = `
  mutation ClearCart {
    clearCart {
      restaurantId
      items {
        dishId
        quantity
      }
      total
      itemCount
    }
  }
`;

// ============================================================
// Expected Response Matchers
// ============================================================

/**
 * Check if restaurants response is valid
 */
export function isValidRestaurantsResponse(data: any): boolean {
  if (!data?.restaurants || !Array.isArray(data.restaurants)) {
    return false;
  }
  return data.restaurants.length > 0 && data.restaurants.every(
    (r: any) => r.id && r.name
  );
}

/**
 * Check if placeOrder response is valid
 */
export function isValidPlaceOrderResponse(data: any): boolean {
  if (!data?.placeOrder) {
    return false;
  }
  const { orderId, status } = data.placeOrder;
  return orderId && status && typeof status === "string";
}

/**
 * Check if cart response is valid
 */
export function isValidCartResponse(data: any): boolean {
  if (!data?.cart) {
    return false;
  }
  const { items, total, itemCount } = data.cart;
  return Array.isArray(items) && 
         typeof total === "number" && 
         typeof itemCount === "number";
}

// ============================================================
// Test Configuration
// ============================================================

export interface TestConfig {
  baseUrl: string;
  validInitData: string;
}

/**
 * Get test configuration from environment
 * Note: Uses globalThis for Cloudflare Worker compatibility
 */
export function getTestConfig(): TestConfig {
  const env = typeof globalThis !== 'undefined' ? (globalThis as any) : {};
  return {
    baseUrl: env.SPEC_KIT_BASE_URL || "http://localhost:8787",
    validInitData: VALID_INIT_DATA,
  };
}
