/**
 * Production Autotest Script for Saleor TMA Backend
 * 
 * Standalone script that tests the Saleor integration against production endpoint.
 * Results are saved to /tmp/prod/*.json files.
 * 
 * Usage: npx tsx worker/src/saleorProdAutotest.ts
 * Or: node --loader ts-node/esm worker/src/saleorProdAutotest.ts
 */

import { mkdir, writeFile, access } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

// ============================================================
// Configuration
// ============================================================

const PRODUCTION_URL = "https://saleor-tma-backend.live-nature.net/graphql";
const OUTPUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../tmp/prod");

// Valid Telegram init data for authentication
const VALID_INIT_DATA = [
  "auth_date=2000000000",
  "hash=test_hash",
  'user={"id":"123456789","first_name":"Test","last_name":"User","language_code":"en"}',
].join("&");

// GraphQL Queries and Mutations
const QUERY_RESTAURANTS = `
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

const QUERY_RESTAURANT_CATEGORIES = `
  query RestaurantCategories($restaurantId: ID!) {
    restaurantCategories(restaurantId: $restaurantId) {
      id
      name
    }
  }
`;

const QUERY_CATEGORY_DISHES = `
  query CategoryDishes($categoryId: ID!, $restaurantId: ID!) {
    categoryDishes(categoryId: $categoryId, restaurantId: $restaurantId) {
      id
      name
      description
      price
      categoryId
      imageUrl
    }
  }
`;

const QUERY_CART = `
  query Cart {
    cart {
      restaurantId
      items { dishId quantity name price currency }
      total
      itemCount
    }
  }
`;

const MUTATION_ADD_TO_CART = `
  mutation AddToCart($input: AddToCartInput!) {
    addToCart(input: $input) {
      restaurantId
      items { dishId quantity name price currency }
      total
      itemCount
    }
  }
`;

const MUTATION_CLEAR_CART = `
  mutation ClearCart {
    clearCart {
      restaurantId
      items { dishId quantity }
      total
      itemCount
    }
  }
`;

// ============================================================
// Types
// ============================================================

interface TestResult {
  testName: string;
  timestamp: string;
  endpoint: string;
  success: boolean;
  duration: number;
  data: unknown;
  error: string | null;
  saleorDataDetected: boolean;
}

interface SummaryResult {
  timestamp: string;
  totalTests: number;
  passed: number;
  failed: number;
  results: TestResult[];
}

// ============================================================
// Helper Functions
// ============================================================

function getTimestamp(): string {
  return new Date().toISOString();
}

function sanitizeTestName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

function generateFilename(testName: string, timestamp: string): string {
  const sanitized = sanitizeTestName(testName);
  const time = timestamp.replace(/[:.]/g, "-").replace("Z", "");
  return `test-${sanitized}-${time}.json`;
}

/**
 * Check if response contains real Saleor data vs mock data
 * Real Saleor IDs are typically UUIDs or Saleor-specific formats
 * Mock data typically has IDs like "rest1", "restA", etc.
 */
function detectSaleorData(data: unknown): boolean {
  if (!data || typeof data !== "object") {
    return false;
  }

  const obj = data as Record<string, unknown>;
  
  // Check restaurants
  if (obj.restaurants && Array.isArray(obj.restaurants)) {
    for (const item of obj.restaurants) {
      if (item && typeof item === "object") {
        const restaurant = item as Record<string, unknown>;
        // Check if ID looks like a real Saleor/UUID format (not mock)
        if (restaurant.id) {
          const id = String(restaurant.id);
          // Mock IDs are typically short and simple
          if (id.length > 20 || id.includes("-")) {
            return true;
          }
        }
      }
    }
  }

  // Check categories
  if (obj.restaurantCategories && Array.isArray(obj.restaurantCategories)) {
    for (const item of obj.restaurantCategories) {
      if (item && typeof item === "object") {
        const category = item as Record<string, unknown>;
        if (category.id) {
          const id = String(category.id);
          if (id.length > 20 || id.includes("-")) {
            return true;
          }
        }
      }
    }
  }

  // Check dishes
  if (obj.categoryDishes && Array.isArray(obj.categoryDishes)) {
    for (const item of obj.categoryDishes) {
      if (item && typeof item === "object") {
        const dish = item as Record<string, unknown>;
        if (dish.id) {
          const id = String(dish.id);
          if (id.length > 20 || id.includes("-")) {
            return true;
          }
        }
      }
    }
  }

  return false;
}

/**
 * Execute GraphQL request
 */
async function graphqlRequest(
  query: string,
  variables: Record<string, unknown> = {},
  initData: string = VALID_INIT_DATA
): Promise<{ data: unknown; errors: unknown[] | undefined }> {
  const response = await fetch(PRODUCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Telegram-Init-Data": initData,
    },
    body: JSON.stringify({ query, variables }),
  });

  return response.json();
}

/**
 * Ensure output directory exists
 */
async function ensureOutputDir(): Promise<void> {
  try {
    await access(OUTPUT_DIR);
  } catch {
    await mkdir(OUTPUT_DIR, { recursive: true });
  }
}

/**
 * Save test result to JSON file
 */
async function saveTestResult(result: TestResult): Promise<void> {
  await ensureOutputDir();
  const filename = generateFilename(result.testName, result.timestamp);
  const filepath = `${OUTPUT_DIR}/${filename}`;
  await writeFile(filepath, JSON.stringify(result, null, 2));
  console.log(`  Saved: ${filepath}`);
}

/**
 * Save summary to JSON file
 */
async function saveSummary(summary: SummaryResult): Promise<void> {
  await ensureOutputDir();
  const timestamp = summary.timestamp.replace(/[:.]/g, "-").replace("Z", "");
  const filepath = `${OUTPUT_DIR}/summary-${timestamp}.json`;
  await writeFile(filepath, JSON.stringify(summary, null, 2));
  console.log(`\nSummary saved: ${filepath}`);
}

// ============================================================
// Test Scenarios
// ============================================================

async function testSaleorConfigCheck(): Promise<TestResult> {
  const timestamp = getTimestamp();
  const startTime = Date.now();

  try {
    // Test that the endpoint is reachable and would accept config
    // This is a basic connectivity test
    const response = await fetch(PRODUCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `query { __typename }`,
      }),
    });

    const duration = Date.now() - startTime;
    const json = await response.json();
    
    // If we get any response (even auth error), the endpoint is configured
    const success = response.status < 500;
    const saleorDataDetected = false; // Config check doesn't return data

    return {
      testName: "saleor-config-check",
      timestamp,
      endpoint: PRODUCTION_URL,
      success,
      duration,
      data: { httpStatus: response.status, response: json },
      error: success ? null : `HTTP ${response.status}`,
      saleorDataDetected,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    return {
      testName: "saleor-config-check",
      timestamp,
      endpoint: PRODUCTION_URL,
      success: false,
      duration,
      data: null,
      error: error instanceof Error ? error.message : String(error),
      saleorDataDetected: false,
    };
  }
}

async function testRestaurantsQuery(): Promise<TestResult> {
  const timestamp = getTimestamp();
  const startTime = Date.now();

  try {
    const response = await graphqlRequest(QUERY_RESTAURANTS);
    const duration = Date.now() - startTime;

    const success = !response.errors && response.data?.restaurants;
    const saleorDataDetected = detectSaleorData(response.data);

    return {
      testName: "restaurants-query",
      timestamp,
      endpoint: PRODUCTION_URL,
      success,
      duration,
      data: response.data,
      error: response.errors ? JSON.stringify(response.errors) : null,
      saleorDataDetected,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    return {
      testName: "restaurants-query",
      timestamp,
      endpoint: PRODUCTION_URL,
      success: false,
      duration,
      data: null,
      error: error instanceof Error ? error.message : String(error),
      saleorDataDetected: false,
    };
  }
}

async function testCategoriesQuery(): Promise<TestResult> {
  const timestamp = getTimestamp();
  const startTime = Date.now();

  try {
    // First get a restaurant ID to use
    const restaurantsResponse = await graphqlRequest(QUERY_RESTAURANTS);
    const restaurants = restaurantsResponse.data?.restaurants;
    
    let restaurantId = "rest1"; // fallback
    if (restaurants && Array.isArray(restaurants) && restaurants.length > 0) {
      restaurantId = restaurants[0].id;
    }

    const response = await graphqlRequest(QUERY_RESTAURANT_CATEGORIES, {
      restaurantId,
    });
    const duration = Date.now() - startTime;

    const success = !response.errors && response.data?.restaurantCategories;
    const saleorDataDetected = detectSaleorData(response.data);

    return {
      testName: "categories-query",
      timestamp,
      endpoint: PRODUCTION_URL,
      success,
      duration,
      data: { restaurantId, ...response.data },
      error: response.errors ? JSON.stringify(response.errors) : null,
      saleorDataDetected,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    return {
      testName: "categories-query",
      timestamp,
      endpoint: PRODUCTION_URL,
      success: false,
      duration,
      data: null,
      error: error instanceof Error ? error.message : String(error),
      saleorDataDetected: false,
    };
  }
}

async function testDishesQuery(): Promise<TestResult> {
  const timestamp = getTimestamp();
  const startTime = Date.now();

  try {
    // Get restaurant and category IDs
    const restaurantsResponse = await graphqlRequest(QUERY_RESTAURANTS);
    const restaurants = restaurantsResponse.data?.restaurants;
    
    let restaurantId = "restA";
    let categoryId = "cat1";
    
    if (restaurants && Array.isArray(restaurants) && restaurants.length > 0) {
      restaurantId = restaurants[0].id;
      
      // Get categories for this restaurant
      const categoriesResponse = await graphqlRequest(QUERY_RESTAURANT_CATEGORIES, {
        restaurantId,
      });
      const categories = categoriesResponse.data?.restaurantCategories;
      
      if (categories && Array.isArray(categories) && categories.length > 0) {
        categoryId = categories[0].id;
      }
    }

    const response = await graphqlRequest(QUERY_CATEGORY_DISHES, {
      categoryId,
      restaurantId,
    });
    const duration = Date.now() - startTime;

    const success = !response.errors && response.data?.categoryDishes;
    const saleorDataDetected = detectSaleorData(response.data);

    return {
      testName: "dishes-query",
      timestamp,
      endpoint: PRODUCTION_URL,
      success,
      duration,
      data: { categoryId, restaurantId, ...response.data },
      error: response.errors ? JSON.stringify(response.errors) : null,
      saleorDataDetected,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    return {
      testName: "dishes-query",
      timestamp,
      endpoint: PRODUCTION_URL,
      success: false,
      duration,
      data: null,
      error: error instanceof Error ? error.message : String(error),
      saleorDataDetected: false,
    };
  }
}

async function testCartOperations(): Promise<TestResult> {
  const timestamp = getTimestamp();
  const startTime = Date.now();

  try {
    // First, get restaurants to find a valid dish
    const restaurantsResponse = await graphqlRequest(QUERY_RESTAURANTS);
    const restaurants = restaurantsResponse.data?.restaurants;
    
    let restaurantId = "restA";
    let dishId = "dish1";
    let dishName = "Test Dish";
    let dishPrice = 9.99;
    
    if (restaurants && Array.isArray(restaurants) && restaurants.length > 0) {
      restaurantId = restaurants[0].id;
      
      // Get categories
      const categoriesResponse = await graphqlRequest(QUERY_RESTAURANT_CATEGORIES, {
        restaurantId,
      });
      const categories = categoriesResponse.data?.restaurantCategories;
      
      if (categories && Array.isArray(categories) && categories.length > 0) {
        const categoryId = categories[0].id;
        
        // Get dishes
        const dishesResponse = await graphqlRequest(QUERY_CATEGORY_DISHES, {
          categoryId,
          restaurantId,
        });
        const dishes = dishesResponse.data?.categoryDishes;
        
        if (dishes && Array.isArray(dishes) && dishes.length > 0) {
          dishId = dishes[0].id;
          dishName = dishes[0].name;
          dishPrice = dishes[0].price;
        }
      }
    }

    // Clear cart first
    await graphqlRequest(MUTATION_CLEAR_CART);

    // Add to cart
    const addResponse = await graphqlRequest(MUTATION_ADD_TO_CART, {
      input: {
        dishId,
        quantity: 2,
        name: dishName,
        price: dishPrice,
        currency: "USD",
        restaurantId,
      },
    });

    // Verify cart
    const cartResponse = await graphqlRequest(QUERY_CART);

    // Clear cart
    await graphqlRequest(MUTATION_CLEAR_CART);

    const duration = Date.now() - startTime;

    const success = 
      !addResponse.errors && 
      addResponse.data?.addToCart &&
      !cartResponse.errors &&
      cartResponse.data?.cart;

    const saleorDataDetected = detectSaleorData(addResponse.data) || detectSaleorData(cartResponse.data);

    return {
      testName: "cart-operations",
      timestamp,
      endpoint: PRODUCTION_URL,
      success,
      duration,
      data: {
        addToCart: addResponse.data?.addToCart,
        cart: cartResponse.data?.cart,
      },
      error: addResponse.errors ? JSON.stringify(addResponse.errors) : null,
      saleorDataDetected,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    return {
      testName: "cart-operations",
      timestamp,
      endpoint: PRODUCTION_URL,
      success: false,
      duration,
      data: null,
      error: error instanceof Error ? error.message : String(error),
      saleorDataDetected: false,
    };
  }
}

// ============================================================
// Main Execution
// ============================================================

async function main() {
  console.log("=".repeat(60));
  console.log("Saleor TMA Backend - Production Autotest");
  console.log("=".repeat(60));
  console.log(`Endpoint: ${PRODUCTION_URL}`);
  console.log(`Output Dir: ${OUTPUT_DIR}`);
  console.log("=".repeat(60));
  console.log();

  // Ensure output directory exists
  await ensureOutputDir();
  console.log(`Output directory ready: ${OUTPUT_DIR}`);
  console.log();

  // Run all tests
  const tests = [
    { name: "Saleor Configuration Check", fn: testSaleorConfigCheck },
    { name: "Restaurants Query", fn: testRestaurantsQuery },
    { name: "Categories Query", fn: testCategoriesQuery },
    { name: "Dishes Query", fn: testDishesQuery },
    { name: "Cart Operations", fn: testCartOperations },
  ];

  const results: TestResult[] = [];
  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    console.log(`Running: ${test.name}...`);
    const result = await test.fn();
    results.push(result);

    if (result.success) {
      passed++;
      console.log(`  ✓ Passed (${result.duration}ms)`);
      if (result.saleorDataDetected) {
        console.log(`  ✓ Saleor data detected`);
      }
    } else {
      failed++;
      console.log(`  ✗ Failed: ${result.error || "Unknown error"}`);
    }
    console.log();

    // Save individual test result
    await saveTestResult(result);
  }

  // Generate summary
  const timestamp = getTimestamp();
  const summary: SummaryResult = {
    timestamp,
    totalTests: tests.length,
    passed,
    failed,
    results,
  };

  await saveSummary(summary);

  // Print summary
  console.log("=".repeat(60));
  console.log("Test Summary");
  console.log("=".repeat(60));
  console.log(`Total:  ${tests.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log("=".repeat(60));

  // Exit with proper code
  if (failed > 0) {
    console.log("\n⚠️  Some tests failed!");
    process.exit(1);
  } else {
    console.log("\n✓ All tests passed!");
    process.exit(0);
  }
}

// Run the tests
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});