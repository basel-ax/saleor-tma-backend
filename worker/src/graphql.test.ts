/**
 * Vitest Test Suite for Telegram TMA GraphQL API
 * 
 * These tests validate the GraphQL API contract and end-to-end flows.
 * Tests are designed to run against the worker at http://localhost:8787
 * 
 * Run with: pnpm test
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  TEST_RESTAURANTS,
  TEST_DISHES,
  TEST_CATEGORIES,
  VALID_INIT_DATA,
  buildPlaceOrderInput,
  QUERY_RESTAURANTS,
  QUERY_RESTAURANT_CATEGORIES,
  QUERY_CATEGORY_DISHES,
  QUERY_CART,
  MUTATION_PLACE_ORDER,
  MUTATION_ADD_TO_CART,
  MUTATION_CLEAR_CART,
  FORBIDDEN_INIT_DATA,
} from './testHelpers';

// Use globalThis for environment variable (Cloudflare Worker compatible)
const env = typeof globalThis !== 'undefined' ? (globalThis as any) : {};
const BASE_URL = env.SPEC_KIT_BASE_URL || 'http://localhost:8787';

interface GraphQLResponse<T = any> {
  data?: T;
  errors?: Array<{ message: string }>;
}

async function graphqlRequest<T = any>(
  query: string,
  variables: Record<string, any> = {},
  initData: string = VALID_INIT_DATA
): Promise<GraphQLResponse<T>> {
  const response = await fetch(`${BASE_URL}/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Init-Data': initData,
    },
    body: JSON.stringify({ query, variables }),
  });
  
  return response.json();
}

describe('GraphQL API Contract Tests', () => {
  // Test 1: Query restaurants returns 200 and non-empty list
  describe('Query: restaurants', () => {
    it('should return a list of restaurants', async () => {
      const response = await graphqlRequest(QUERY_RESTAURANTS);
      
      expect(response.errors).toBeUndefined();
      expect(response.data).toBeDefined();
      expect(response.data?.restaurants).toBeDefined();
      expect(Array.isArray(response.data?.restaurants)).toBe(true);
      expect(response.data?.restaurants.length).toBeGreaterThan(0);
      expect(response.data?.restaurants[0]).toHaveProperty('id');
      expect(response.data?.restaurants[0]).toHaveProperty('name');
    });
  });

  // Test 2: Query restaurantCategories
  describe('Query: restaurantCategories', () => {
    it('should return categories for a valid restaurant', async () => {
      const response = await graphqlRequest(QUERY_RESTAURANT_CATEGORIES, {
        restaurantId: 'rest1',
      });
      
      expect(response.errors).toBeUndefined();
      expect(response.data).toBeDefined();
      expect(response.data?.restaurantCategories).toBeDefined();
      expect(Array.isArray(response.data?.restaurantCategories)).toBe(true);
    });
  });

  // Test 3: Query categoryDishes
  describe('Query: categoryDishes', () => {
    it('should return dishes for a category', async () => {
      const response = await graphqlRequest(QUERY_CATEGORY_DISHES, {
        categoryId: 'cat1',
      });
      
      expect(response.errors).toBeUndefined();
      expect(response.data).toBeDefined();
      expect(response.data?.categoryDishes).toBeDefined();
      expect(Array.isArray(response.data?.categoryDishes)).toBe(true);
    });
  });

  // Test 4: Place order with delivery location (lat/lng)
  describe('Mutation: placeOrder with delivery location', () => {
    it('should create order with lat/lng delivery location', async () => {
      const input = buildPlaceOrderInput({
        deliveryLocation: {
          address: '123 Main St',
          city: 'New York',
          country: 'US',
          latitude: 40.7128,
          longitude: -74.006,
        },
      });
      
      const response = await graphqlRequest(MUTATION_PLACE_ORDER, { input });
      
      expect(response.errors).toBeUndefined();
      expect(response.data).toBeDefined();
      expect(response.data?.placeOrder).toBeDefined();
      expect(response.data?.placeOrder).toHaveProperty('orderId');
      expect(response.data?.placeOrder).toHaveProperty('status');
      expect(response.data?.placeOrder.status).toBe('CREATED');
    });
  });

  // Test 5: Place order with Google Maps URL (address)
  describe('Mutation: placeOrder with address only', () => {
    it('should create order with address', async () => {
      const input = buildPlaceOrderInput({
        deliveryLocation: {
          address: '456 Oak Avenue',
        },
      });
      
      const response = await graphqlRequest(MUTATION_PLACE_ORDER, { input });
      
      // Should either succeed or fail with cart empty error
      if (response.errors) {
        expect(response.errors[0].message).toContain('Cart is empty');
      } else {
        expect(response.data?.placeOrder).toHaveProperty('orderId');
      }
    });
  });

  // Test 6: Cart - Add to cart
  describe('Mutation: addToCart', () => {
    it('should add item to cart', async () => {
      const input = {
        dishId: TEST_DISHES.DISH_A1.id,
        quantity: 2,
        name: TEST_DISHES.DISH_A1.name,
        price: TEST_DISHES.DISH_A1.price,
        currency: 'USD',
        restaurantId: TEST_RESTAURANTS.REST_A.id,
      };
      
      const response = await graphqlRequest(MUTATION_ADD_TO_CART, { input });
      
      expect(response.errors).toBeUndefined();
      expect(response.data).toBeDefined();
      expect(response.data?.addToCart).toBeDefined();
      expect(response.data?.addToCart).toHaveProperty('restaurantId');
      expect(response.data?.addToCart).toHaveProperty('items');
      expect(response.data?.addToCart).toHaveProperty('total');
      expect(response.data?.addToCart).toHaveProperty('itemCount');
    });
  });

  // Test 7: Cart - Get cart
  describe('Query: cart', () => {
    it('should return current user cart', async () => {
      const response = await graphqlRequest(QUERY_CART);
      
      expect(response.errors).toBeUndefined();
      expect(response.data).toBeDefined();
      expect(response.data?.cart).toBeDefined();
      expect(response.data?.cart).toHaveProperty('restaurantId');
      expect(response.data?.cart).toHaveProperty('items');
      expect(response.data?.cart).toHaveProperty('total');
      expect(response.data?.cart).toHaveProperty('itemCount');
    });
  });

  // Test 8: Invalid input - Missing restaurant
  describe('Error Handling: Missing restaurant', () => {
    it('should return error when restaurant is missing', async () => {
      const input = {
        items: [{ dishId: 'dish1', quantity: 1 }],
        deliveryLocation: { address: '123 Main St' },
      };
      
      const response = await graphqlRequest(MUTATION_PLACE_ORDER, { input });
      
      expect(response.errors).toBeDefined();
      expect(response.errors?.length).toBeGreaterThan(0);
      expect(response.errors?.[0].message).toContain('Restaurant');
    });
  });

  // Test 9: Invalid input - Empty cart
  describe('Error Handling: Empty cart order', () => {
    it('should return error when cart is empty', async () => {
      // First clear the cart
      await graphqlRequest(MUTATION_CLEAR_CART);
      
      const input = buildPlaceOrderInput({
        items: [],
      });
      
      const response = await graphqlRequest(MUTATION_PLACE_ORDER, { input });
      
      expect(response.errors).toBeDefined();
      expect(response.errors?.length).toBeGreaterThan(0);
      expect(response.errors?.[0].message).toContain('Cart is empty');
    });
  });

  // Test 10: Invalid input - Missing address
  describe('Error Handling: Missing address', () => {
    it('should return error when address is missing', async () => {
      const input = {
        restaurantId: TEST_RESTAURANTS.REST_A.id,
        items: [{ dishId: 'dish1', quantity: 1 }],
      };
      
      const response = await graphqlRequest(MUTATION_PLACE_ORDER, { input });
      
      expect(response.errors).toBeDefined();
      expect(response.errors?.length).toBeGreaterThan(0);
      expect(response.errors?.[0].message).toContain('address');
    });
  });

  // Test 11: Authentication - Missing header
  describe('Authentication: Missing header', () => {
    it('should return 401 when X-Telegram-Init-Data is missing', async () => {
      const response = await fetch(`${BASE_URL}/graphql`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: QUERY_RESTAURANTS }),
      });
      
      const json = await response.json();
      expect(json.errors).toBeDefined();
      expect(json.errors?.[0].message).toContain('Missing X-Telegram-Init-Data');
    });
  });

  // Test 12: Authentication - Invalid init data
  describe('Authentication: Invalid init data', () => {
    it('should return error for invalid init data', async () => {
      const response = await graphqlRequest(
        QUERY_RESTAURANTS,
        {},
        'invalid_data'
      );
      
      expect(response.errors).toBeDefined();
      expect(response.errors?.length).toBeGreaterThan(0);
    });
  });

  // Test 13: Cart - Clear cart
  describe('Mutation: clearCart', () => {
    it('should clear entire cart', async () => {
      const response = await graphqlRequest(MUTATION_CLEAR_CART);
      
      expect(response.errors).toBeUndefined();
      expect(response.data).toBeDefined();
      expect(response.data?.clearCart).toBeDefined();
      expect(response.data?.clearCart.items).toEqual([]);
      expect(response.data?.clearCart.total).toBe(0);
      expect(response.data?.clearCart.itemCount).toBe(0);
    });
  });

  // Test 16: Forbidden access when user lacks write permission
  describe('Forbidden access: write mutation with forbidden user', () => {
    it('should return 403 when user lacks write permission', async () => {
      const input = {
        dishId: TEST_DISHES.DISH_A1.id,
        quantity: 1,
        name: TEST_DISHES.DISH_A1.name,
        price: TEST_DISHES.DISH_A1.price,
        currency: 'USD',
        restaurantId: TEST_RESTAURANTS.REST_A.id,
      };
      const response = await graphqlRequest(MUTATION_ADD_TO_CART, { input }, FORBIDDEN_INIT_DATA);
      expect(response.errors).toBeDefined();
      expect(response.errors?.[0].code).toBe('FORBIDDEN');
    });
  });
});

// Export for potential use in other test files
export { graphqlRequest };
