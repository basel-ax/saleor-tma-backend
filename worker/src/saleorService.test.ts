// Phase 1: Saleor Data Service Tests
// Tests for saleorService.ts - fetchRestaurants, fetchCategories, fetchDishes

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  fetchRestaurants,
  fetchCategories,
  fetchDishes,
} from "./saleorService";
import { SaleorClient, SaleorResponse } from "./saleorClient";
import { Restaurant, Category, Dish } from "./contracts";
import { TEST_RESTAURANTS, TEST_CATEGORIES, TEST_DISHES } from "./testHelpers";

// ============================================================
// Mock Modules
// ============================================================

// Mock the saleorClient module
vi.mock("./saleorClient", async () => {
  const actual = await vi.importActual("./saleorClient");
  return {
    ...actual,
    isSaleorConfigured: vi.fn(),
    getSaleorClient: vi.fn(),
    SaleorClient: vi.fn().mockImplementation(() => ({
      execute: vi.fn(),
    })),
  };
});

// Mock the logger to avoid console output during tests
vi.mock("./logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import { isSaleorConfigured, getSaleorClient } from "./saleorClient";

// ============================================================
// Test Data
// ============================================================

const mockSaleorRestaurants = [
  {
    id: "saleor_rest_1",
    name: "Saleor Restaurant 1",
    backgroundImage: { url: "https://example.com/img1.jpg" },
  },
  { id: "saleor_rest_2", name: "Saleor Restaurant 2", backgroundImage: null },
];

const mockSaleorCategories = [
  { id: "saleor_cat_1", name: "Saleor Category 1" },
  { id: "saleor_cat_2", name: "Saleor Category 2" },
];

const mockSaleorProducts = [
  {
    id: "saleor_dish_1",
    name: "Saleor Dish 1",
    description: "Description 1",
    thumbnail: { url: "https://example.com/dish1.jpg" },
    productType: { id: "saleor_cat_1", name: "Category 1" },
    variants: [
      {
        id: "var_1",
        name: "Variant 1",
        pricing: { price: { amount: "12.99", currency: "USD" } },
      },
    ],
  },
  {
    id: "saleor_dish_2",
    name: "Saleor Dish 2",
    description: null,
    thumbnail: null,
    productType: { id: "saleor_cat_1", name: "Category 1" },
    variants: [
      {
        id: "var_2",
        name: "Variant 2",
        pricing: { price: { amount: "8.50", currency: "EUR" } },
      },
    ],
  },
  {
    id: "saleor_dish_3",
    name: "Saleor Dish 3",
    description: "Description 3",
    thumbnail: { url: "https://example.com/dish3.jpg" },
    productType: { id: "saleor_cat_2", name: "Category 2" },
    variants: [
      {
        id: "var_3",
        name: "Variant 3",
        pricing: { price: { amount: "15.00", currency: "USD" } },
      },
    ],
  },
];

// ============================================================
// Helper Functions
// ============================================================

function createMockClient(mockResponse: SaleorResponse<any>): SaleorClient {
  const mockClient = {
    execute: vi.fn().mockResolvedValue(mockResponse),
  } as unknown as SaleorClient;
  return mockClient;
}

// ============================================================
// Test Suite: fetchRestaurants
// ============================================================

describe("fetchRestaurants", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return Restaurant[] from Saleor when Saleor is configured", async () => {
    // Arrange
    const mockResponse: SaleorResponse<{
      collections: { edges: { node: (typeof mockSaleorRestaurants)[0] }[] };
    }> = {
      data: {
        collections: {
          edges: mockSaleorRestaurants.map((r) => ({ node: r })),
        },
      },
    };

    vi.mocked(isSaleorConfigured).mockReturnValue(true);
    vi.mocked(getSaleorClient).mockReturnValue(createMockClient(mockResponse));

    // Act
    const result = await fetchRestaurants();

    // Assert
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      id: "saleor_rest_1",
      name: "Saleor Restaurant 1",
      categories: [],
      deliveryLocations: [],
    });
    expect(result[1]).toEqual({
      id: "saleor_rest_2",
      name: "Saleor Restaurant 2",
      categories: [],
      deliveryLocations: [],
    });
  });

  it("should fall back to mock restaurants when Saleor is not configured", async () => {
    // Arrange
    vi.mocked(isSaleorConfigured).mockReturnValue(false);

    // Act
    const result = await fetchRestaurants();

    // Assert
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      id: TEST_RESTAURANTS.REST_A.id,
      name: TEST_RESTAURANTS.REST_A.name,
      categories: [],
      deliveryLocations: [],
    });
    expect(result[1]).toEqual({
      id: TEST_RESTAURANTS.REST_B.id,
      name: TEST_RESTAURANTS.REST_B.name,
      categories: [],
      deliveryLocations: [],
    });
  });

  it("should fall back to mock when Saleor client returns null", async () => {
    // Arrange
    vi.mocked(isSaleorConfigured).mockReturnValue(true);
    vi.mocked(getSaleorClient).mockReturnValue(null);

    // Act
    const result = await fetchRestaurants();

    // Assert
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe(TEST_RESTAURANTS.REST_A.id);
  });

  it("should fall back to mock when Saleor returns errors", async () => {
    // Arrange
    const mockResponse: SaleorResponse<any> = {
      data: undefined,
      errors: [{ message: "GraphQL Error" }],
    };

    vi.mocked(isSaleorConfigured).mockReturnValue(true);
    vi.mocked(getSaleorClient).mockReturnValue(createMockClient(mockResponse));

    // Act
    const result = await fetchRestaurants();

    // Assert
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe(TEST_RESTAURANTS.REST_A.id);
  });

  it("should fall back to mock when Saleor throws an exception", async () => {
    // Arrange
    const errorClient = {
      execute: vi.fn().mockRejectedValue(new Error("Network error")),
    } as unknown as SaleorClient;

    vi.mocked(isSaleorConfigured).mockReturnValue(true);
    vi.mocked(getSaleorClient).mockReturnValue(errorClient);

    // Act
    const result = await fetchRestaurants();

    // Assert
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe(TEST_RESTAURANTS.REST_A.id);
  });

  it("should return empty array when Saleor returns empty collections", async () => {
    // Arrange
    const mockResponse: SaleorResponse<{
      collections: { edges: { node: any }[] };
    }> = {
      data: {
        collections: { edges: [] },
      },
    };

    vi.mocked(isSaleorConfigured).mockReturnValue(true);
    vi.mocked(getSaleorClient).mockReturnValue(createMockClient(mockResponse));

    // Act
    const result = await fetchRestaurants();

    // Assert
    expect(result).toEqual([]);
  });
});

// ============================================================
// Test Suite: fetchCategories
// ============================================================

describe("fetchCategories", () => {
   beforeEach(() => {
     vi.clearAllMocks();
   });

   it("should return Category[] from Saleor when Saleor is configured", async () => {
     // Arrange
     const mockResponse: SaleorResponse<{
       productTypes: { edges: { node: (typeof mockSaleorCategories)[0] }[] };
     }> = {
       data: {
         productTypes: {
           edges: mockSaleorCategories.map((c) => ({ node: c })),
         },
       },
     };

     vi.mocked(isSaleorConfigured).mockReturnValue(true);
     vi.mocked(getSaleorClient).mockReturnValue(createMockClient(mockResponse));

     // Act
     const result = await fetchCategories("restA");

     // Assert
     expect(result).toHaveLength(2);
     expect(result[0]).toEqual({
       id: "saleor_cat_1",
       name: "Saleor Category 1",
     });
     expect(result[1]).toEqual({
       id: "saleor_cat_2",
       name: "Saleor Category 2",
     });
   });

   it("should fall back to mock categories when Saleor is not configured", async () => {
     // Arrange
     vi.mocked(isSaleorConfigured).mockReturnValue(false);

     // Act
     const result = await fetchCategories("restA");

     // Assert
     expect(result).toHaveLength(2);
     expect(result[0]).toEqual({
       id: TEST_CATEGORIES.CAT_A.id,
       name: TEST_CATEGORIES.CAT_A.name,
     });
     expect(result[1]).toEqual({
       id: TEST_CATEGORIES.CAT_B.id,
       name: TEST_CATEGORIES.CAT_B.name,
     });
   });

   it("should fall back to mock when Saleor client returns null", async () => {
     // Arrange
     vi.mocked(isSaleorConfigured).mockReturnValue(true);
     vi.mocked(getSaleorClient).mockReturnValue(null);

     // Act
     const result = await fetchCategories("restA");

     // Assert
     expect(result).toHaveLength(2);
     expect(result[0].id).toBe(TEST_CATEGORIES.CAT_A.id);
   });

   it("should fall back to mock when Saleor returns errors", async () => {
     // Arrange
     const mockResponse: SaleorResponse<any> = {
       data: undefined,
       errors: [{ message: "Permission denied" }],
     };

     vi.mocked(isSaleorConfigured).mockReturnValue(true);
     vi.mocked(getSaleorClient).mockReturnValue(createMockClient(mockResponse));

     // Act
     const result = await fetchCategories("restA");

     // Assert
     expect(result).toHaveLength(2);
     expect(result[0].id).toBe(TEST_CATEGORIES.CAT_A.id);
   });

   it("should fall back to mock when Saleor throws an exception", async () => {
     // Arrange
     const errorClient = {
       execute: vi.fn().mockRejectedValue(new Error("Connection timeout")),
     } as unknown as SaleorClient;

     vi.mocked(isSaleorConfigured).mockReturnValue(true);
     vi.mocked(getSaleorClient).mockReturnValue(errorClient);

     // Act
     const result = await fetchCategories("restA");

     // Assert
     expect(result).toHaveLength(2);
     expect(result[0].id).toBe(TEST_CATEGORIES.CAT_A.id);
   });

   it("should return empty array when Saleor returns empty product types", async () => {
     // Arrange
     const mockResponse: SaleorResponse<{
       productTypes: { edges: { node: any }[] };
     }> = {
       data: {
         productTypes: { edges: [] },
       },
     };

     vi.mocked(isSaleorConfigured).mockReturnValue(true);
     vi.mocked(getSaleorClient).mockReturnValue(createMockClient(mockResponse));

     // Act
     const result = await fetchCategories("restA");

     // Assert
     expect(result).toEqual([]);
   });
 });

// ============================================================
// Test Suite: fetchDishes
// ============================================================

describe("fetchDishes", () => {
   beforeEach(() => {
     vi.clearAllMocks();
   });

   it("should return Dish[] from Saleor when Saleor is configured", async () => {
     // Arrange
     const mockResponse: SaleorResponse<{
       products: { edges: { node: (typeof mockSaleorProducts)[0] }[] };
     }> = {
       data: {
         products: {
           edges: mockSaleorProducts.map((p) => ({ node: p })),
         },
       },
     };

     vi.mocked(isSaleorConfigured).mockReturnValue(true);
     vi.mocked(getSaleorClient).mockReturnValue(createMockClient(mockResponse));

     // Act
     const result = await fetchDishes(undefined, "restA");

     // Assert
     expect(result).toHaveLength(3);
     expect(result[0]).toEqual({
       id: "saleor_dish_1",
       name: "Saleor Dish 1",
       description: "Description 1",
       price: 12.99,
       currency: "USD",
       categoryId: "saleor_cat_1",
       imageUrl: "https://example.com/dish1.jpg",
       restaurantId: "restA",
     });
     expect(result[1]).toEqual({
       id: "saleor_dish_2",
       name: "Saleor Dish 2",
       description: "",
       price: 8.5,
       currency: "EUR",
       categoryId: "saleor_cat_1",
       imageUrl: "",
       restaurantId: "restA",
     });
   });

   it("should filter dishes by categoryId when provided", async () => {
     // Arrange
     const mockResponse: SaleorResponse<{
       products: { edges: { node: (typeof mockSaleorProducts)[0] }[] };
     }> = {
       data: {
         products: {
           edges: mockSaleorProducts.map((p) => ({ node: p })),
         },
       },
     };

     vi.mocked(isSaleorConfigured).mockReturnValue(true);
     vi.mocked(getSaleorClient).mockReturnValue(createMockClient(mockResponse));

     // Act
     const result = await fetchDishes("saleor_cat_1", "restA");

     // Assert
     expect(result).toHaveLength(2);
     expect(result.every((d) => d.categoryId === "saleor_cat_1")).toBe(true);
     expect(result[0].id).toBe("saleor_dish_1");
     expect(result[1].id).toBe("saleor_dish_2");
   });

   it("should return empty array when categoryId filter matches nothing", async () => {
     // Arrange
     const mockResponse: SaleorResponse<{
       products: { edges: { node: (typeof mockSaleorProducts)[0] }[] };
     }> = {
       data: {
         products: {
           edges: mockSaleorProducts.map((p) => ({ node: p })),
         },
       },
     };

     vi.mocked(isSaleorConfigured).mockReturnValue(true);
     vi.mocked(getSaleorClient).mockReturnValue(createMockClient(mockResponse));

     // Act
     const result = await fetchDishes("nonexistent_category", "restA");

     // Assert
     expect(result).toEqual([]);
   });

   it("should fall back to mock dishes when Saleor is not configured", async () => {
     // Arrange
     vi.mocked(isSaleorConfigured).mockReturnValue(false);

     // Act
     const result = await fetchDishes(undefined, "restA");

     // Assert
     expect(result).toHaveLength(3);
     expect(result[0]).toEqual({
       id: TEST_DISHES.DISH_A1.id,
       name: TEST_DISHES.DISH_A1.name,
       description: "Test description",
       price: TEST_DISHES.DISH_A1.price,
       currency: "USD",
       categoryId: TEST_DISHES.DISH_A1.categoryId,
       imageUrl: "https://example.com/image.jpg",
       restaurantId: "restA",
     });
   });

   it("should filter mock dishes by categoryId when provided", async () => {
     // Arrange
     vi.mocked(isSaleorConfigured).mockReturnValue(false);

     // Act
     const result = await fetchDishes("catA", "restA");

     // Assert
     expect(result).toHaveLength(2);
     expect(result.every((d) => d.categoryId === "catA")).toBe(true);
     expect(result[0].id).toBe(TEST_DISHES.DISH_A1.id);
     expect(result[1].id).toBe(TEST_DISHES.DISH_A2.id);
   });

    it("should filter mock dishes by restaurantId when provided", async () => {
      // Arrange
      vi.mocked(isSaleorConfigured).mockReturnValue(false);

      // Act
      const result = await fetchDishes(undefined, "restB");

      // Assert
      expect(result).toHaveLength(3); // All mock dishes, but with restaurantId set to "restB"
      expect(result.every((d) => d.restaurantId === "restB")).toBe(true);
    });

   it("should filter mock dishes by both categoryId and restaurantId when provided", async () => {
     // Arrange
     vi.mocked(isSaleorConfigured).mockReturnValue(false);

     // Act
     const result = await fetchDishes("catA", "restA");

     // Assert
     expect(result).toHaveLength(2);
     expect(result.every((d) => d.categoryId === "catA" && d.restaurantId === "restA")).toBe(true);
     expect(result[0].id).toBe(TEST_DISHES.DISH_A1.id);
     expect(result[1].id).toBe(TEST_DISHES.DISH_A2.id);
   });

   it("should fall back to mock when Saleor client returns null", async () => {
     // Arrange
     vi.mocked(isSaleorConfigured).mockReturnValue(true);
     vi.mocked(getSaleorClient).mockReturnValue(null);

     // Act
     const result = await fetchDishes(undefined, "restA");

     // Assert
     expect(result).toHaveLength(3);
     expect(result[0].id).toBe(TEST_DISHES.DISH_A1.id);
   });

   it("should fall back to mock when Saleor returns errors", async () => {
     // Arrange
     const mockResponse: SaleorResponse<any> = {
       data: undefined,
       errors: [{ message: "Invalid query" }],
     };

     vi.mocked(isSaleorConfigured).mockReturnValue(true);
     vi.mocked(getSaleorClient).mockReturnValue(createMockClient(mockResponse));

     // Act
     const result = await fetchDishes(undefined, "restA");

     // Assert
     expect(result).toHaveLength(3);
     expect(result[0].id).toBe(TEST_DISHES.DISH_A1.id);
   });

   it("should fall back to mock when Saleor throws an exception", async () => {
     // Arrange
     const errorClient = {
       execute: vi.fn().mockRejectedValue(new Error("Server error")),
     } as unknown as SaleorClient;

     vi.mocked(isSaleorConfigured).mockReturnValue(true);
     vi.mocked(getSaleorClient).mockReturnValue(errorClient);

     // Act
     const result = await fetchDishes(undefined, "restA");

     // Assert
     expect(result).toHaveLength(3);
     expect(result[0].id).toBe(TEST_DISHES.DISH_A1.id);
   });

   it("should handle products with no variants", async () => {
     // Arrange
     const productsWithNoVariants = [
       {
         id: "dish_no_variant",
         name: "No Variant Dish",
         description: "Test",
         thumbnail: null,
         productType: { id: "cat1", name: "Cat 1" },
         variants: [],
       },
     ];

     const mockResponse: SaleorResponse<{
       products: { edges: { node: any }[] };
     }> = {
       data: {
         products: {
           edges: productsWithNoVariants.map((p) => ({ node: p })),
         },
       },
     };

     vi.mocked(isSaleorConfigured).mockReturnValue(true);
     vi.mocked(getSaleorClient).mockReturnValue(createMockClient(mockResponse));

     // Act
     const result = await fetchDishes(undefined, "restA");

     // Assert
     expect(result).toHaveLength(1);
     expect(result[0].price).toBe(0);
     expect(result[0].currency).toBe("USD");
   });

   it("should handle products with null description", async () => {
     // Arrange
     const productsWithNullDesc = [
       {
         id: "dish_null_desc",
         name: "Null Desc Dish",
         description: null,
         thumbnail: null,
         productType: { id: "cat1", name: "Cat 1" },
         variants: [
           {
             id: "var1",
             name: "Var 1",
             pricing: { price: { amount: "10.00", currency: "USD" } },
           },
         ],
       },
     ];

     const mockResponse: SaleorResponse<{
       products: { edges: { node: any }[] };
     }> = {
       data: {
         products: {
           edges: productsWithNullDesc.map((p) => ({ node: p })),
         },
       },
     };

     vi.mocked(isSaleorConfigured).mockReturnValue(true);
     vi.mocked(getSaleorClient).mockReturnValue(createMockClient(mockResponse));

     // Act
     const result = await fetchDishes(undefined, "restA");

     // Assert
     expect(result).toHaveLength(1);
     expect(result[0].description).toBe("");
   });
 });

// ============================================================
// Test Suite: Error Handling Edge Cases
// ============================================================

describe("Error handling edge cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

   it("should fall back to mock data when Saleor returns undefined data", async () => {
     // Arrange
     const mockResponse: SaleorResponse<any> = {
       data: undefined,
       errors: undefined,
     };

     vi.mocked(isSaleorConfigured).mockReturnValue(true);
     vi.mocked(getSaleorClient).mockReturnValue(createMockClient(mockResponse));

     // Act - test all three functions
     const [restaurants, categories, dishes] = await Promise.all([
       fetchRestaurants(),
       fetchCategories(),
       fetchDishes(),
     ]);

     // Assert - Should fall back to mock data when data is undefined
     expect(restaurants).toHaveLength(2);
     expect(categories).toHaveLength(2);
     expect(dishes).toHaveLength(3);
   });

   it("should fall back to mock data when Saleor returns malformed response structure", async () => {
     // Arrange
     const mockResponse: SaleorResponse<any> = {
       data: {
         // Missing expected structure
         collections: null,
       },
     };

     vi.mocked(isSaleorConfigured).mockReturnValue(true);
     vi.mocked(getSaleorClient).mockReturnValue(createMockClient(mockResponse));

     // Act
     const result = await fetchRestaurants();

     // Assert - Should fall back to mock data when structure is invalid
     expect(result).toHaveLength(2);
     expect(result[0].id).toBe(TEST_RESTAURANTS.REST_A.id);
   });

  it("should handle products with multiple variants using first one for price", async () => {
    // Arrange
    const productsWithMultipleVariants = [
      {
        id: "dish_multi_var",
        name: "Multi Variant Dish",
        description: "Test",
        thumbnail: null,
        productType: { id: "cat1", name: "Cat 1" },
        variants: [
          {
            id: "var_expensive",
            name: "Large",
            pricing: { price: { amount: "25.00", currency: "USD" } },
          },
          {
            id: "var_cheap",
            name: "Small",
            pricing: { price: { amount: "15.00", currency: "USD" } },
          },
        ],
      },
    ];

    const mockResponse: SaleorResponse<{
      products: { edges: { node: any }[] };
    }> = {
      data: {
        products: {
          edges: productsWithMultipleVariants.map((p) => ({ node: p })),
        },
      },
    };

    vi.mocked(isSaleorConfigured).mockReturnValue(true);
    vi.mocked(getSaleorClient).mockReturnValue(createMockClient(mockResponse));

    // Act
    const result = await fetchDishes();

    // Assert
    expect(result).toHaveLength(1);
    // Should use first variant price
    expect(result[0].price).toBe(25);
  });

  it("should handle products with null pricing in variants", async () => {
    // Arrange
    const productsWithNullPricing = [
      {
        id: "dish_null_pricing",
        name: "Null Pricing Dish",
        description: "Test",
        thumbnail: null,
        productType: { id: "cat1", name: "Cat 1" },
        variants: [
          {
            id: "var1",
            name: "Var 1",
            pricing: null,
          },
        ],
      },
    ];

    const mockResponse: SaleorResponse<{
      products: { edges: { node: any }[] };
    }> = {
      data: {
        products: {
          edges: productsWithNullPricing.map((p) => ({ node: p })),
        },
      },
    };

    vi.mocked(isSaleorConfigured).mockReturnValue(true);
    vi.mocked(getSaleorClient).mockReturnValue(createMockClient(mockResponse));

    // Act
    const result = await fetchDishes();

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0].price).toBe(0);
    expect(result[0].currency).toBe("USD");
  });
});

// ============================================================
// Property-based Tests (Idempotency and Round-trip)
// ============================================================

describe("Property-based tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should always return an array (never null/undefined)", async () => {
    // Arrange - configure Saleor with various scenarios
    vi.mocked(isSaleorConfigured).mockReturnValue(false);

    // Act & Assert
    const restaurants = await fetchRestaurants();
    const categories = await fetchCategories();
    const dishes = await fetchDishes();

    expect(Array.isArray(restaurants)).toBe(true);
    expect(Array.isArray(categories)).toBe(true);
    expect(Array.isArray(dishes)).toBe(true);
  });

  it("should return consistent mock data when Saleor is not configured", async () => {
    // Arrange
    vi.mocked(isSaleorConfigured).mockReturnValue(false);

    // Act - call multiple times
    const [r1, r2] = await Promise.all([
      fetchRestaurants(),
      fetchRestaurants(),
    ]);
    const [c1, c2] = await Promise.all([fetchCategories(), fetchCategories()]);
    const [d1, d2] = await Promise.all([fetchDishes(), fetchDishes()]);

    // Assert - results should be equal
    expect(r1).toEqual(r2);
    expect(c1).toEqual(c2);
    expect(d1).toEqual(d2);
  });

  it("should filter by categoryId consistently", async () => {
    // Arrange
    vi.mocked(isSaleorConfigured).mockReturnValue(false);

    // Act
    const dishesCatA = await fetchDishes("catA");
    const dishesCatB = await fetchDishes("catB");

    // Assert - dishes should be filtered correctly
    expect(dishesCatA.every((d) => d.categoryId === "catA")).toBe(true);
    expect(dishesCatB.every((d) => d.categoryId === "catB")).toBe(true);
    // No overlap
    const overlap = dishesCatA.filter((d) =>
      dishesCatB.some((b) => b.id === d.id),
    );
    expect(overlap).toHaveLength(0);
  });

  it("should return all dishes when categoryId is undefined", async () => {
    // Arrange
    vi.mocked(isSaleorConfigured).mockReturnValue(false);

    // Act
    const dishesAll = await fetchDishes();
    const dishesUndefined = await fetchDishes(undefined);

    // Assert
    expect(dishesAll).toEqual(dishesUndefined);
    expect(dishesAll).toHaveLength(3); // 2 catA + 1 catB
  });

  it("should return all dishes when categoryId is null", async () => {
    // Arrange
    vi.mocked(isSaleorConfigured).mockReturnValue(false);

    // Act
    const dishesAll = await fetchDishes();
    const dishesNull = await fetchDishes(null as any);

    // Assert - both should return all dishes (null is falsy like undefined)
    expect(dishesAll).toEqual(dishesNull);
  });
});
