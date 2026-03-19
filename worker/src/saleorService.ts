// Phase 1: Saleor Data Service
// Fetches real data from Saleor OMS with fallback to mock data
// Maps Saleor's data model to our Restaurant/Category/Dish entities

import { logger } from "./logger";
import {
  SaleorClient,
  getSaleorClient,
  isSaleorConfigured,
  SaleorResponse,
} from "./saleorClient";
import { Restaurant, Category, Dish } from "./contracts";
import { TEST_RESTAURANTS, TEST_DISHES, TEST_CATEGORIES } from "./testHelpers";

/**
 * Saleor Product Type (maps to our Category)
 */
export interface SaleorProductType {
  id: string;
  name: string;
}

/**
 * Saleor Product Variant (contains pricing info)
 */
export interface SaleorProductVariant {
  id: string;
  name: string;
  pricing: {
    price: {
      amount: string;
      currency: string;
    };
  };
}

/**
 * Saleor Product (maps to our Dish)
 */
export interface SaleorProduct {
  id: string;
  name: string;
  description: string | null;
  thumbnail: {
    url: string;
  } | null;
  productType: SaleorProductType;
  variants: SaleorProductVariant[];
}

/**
 * Saleor Collection (maps to our Restaurant)
 */
export interface SaleorCollection {
  id: string;
  name: string;
  backgroundImage: {
    url: string;
  } | null;
}

/**
 * GraphQL query for fetching products (dishes) with variants and pricing
 */
export const PRODUCTS_QUERY = `
  query Products {
    products(first: 100) {
      edges {
        node {
          id
          name
          description
          thumbnail {
            url
          }
          productType {
            id
            name
          }
          variants {
            id
            name
            pricing {
              price {
                amount
                currency
              }
            }
          }
        }
      }
    }
  }
`;

/**
 * GraphQL query for fetching product types (categories)
 */
export const PRODUCT_TYPES_QUERY = `
  query ProductTypes {
    productTypes(first: 100) {
      edges {
        node {
          id
          name
        }
      }
    }
  }
`;

/**
 * GraphQL query for fetching collections (restaurants)
 */
export const COLLECTIONS_QUERY = `
  query Collections {
    collections(first: 100) {
      edges {
        node {
          id
          name
          backgroundImage {
            url
          }
        }
      }
    }
  }
`;

/**
 * Fetch restaurants from Saleor collections
 * Falls back to mock data if Saleor is not configured or on error
 */
export async function fetchRestaurants(): Promise<Restaurant[]> {
  // Check if Saleor is configured
  if (!isSaleorConfigured()) {
    logger.info("saleor_service_fallback", {
      reason: "Saleor not configured",
      dataType: "restaurants",
    });
    return getMockRestaurants();
  }

  try {
    const client = getSaleorClient();
    if (!client) {
      logger.info("saleor_service_fallback", {
        reason: "Saleor client not available",
        dataType: "restaurants",
      });
      return getMockRestaurants();
    }

    const response = await client.execute<{
      collections: { edges: { node: SaleorCollection }[] };
    }>(COLLECTIONS_QUERY);

    if (response.errors && response.errors.length > 0) {
      logger.error("saleor_service_error", {
        error: response.errors.map((e) => e.message).join(", "),
        dataType: "restaurants",
      });
      return getMockRestaurants();
    }

    const collections =
      response.data?.collections?.edges?.map((edge) => edge.node) || [];

    // Map Saleor collections to our Restaurant format
    // For now, we'll treat each collection as a restaurant with empty categories
    // Categories and dishes will be fetched separately
    const restaurants: Restaurant[] = collections.map((collection) => ({
      id: collection.id,
      name: collection.name,
      categories: [], // Will be populated when fetchCategories is called
      deliveryLocations: [], // Not available in Saleor collections, leave empty
    }));

    logger.info("saleor_service_success", {
      count: restaurants.length,
      dataType: "restaurants",
    });
    return restaurants;
  } catch (error) {
    logger.error("saleor_service_error", {
      error: error instanceof Error ? error.message : "Unknown error",
      dataType: "restaurants",
    });
    return getMockRestaurants();
  }
}

/**
 * Fetch categories from Saleor product types
 * Falls back to mock data if Saleor is not configured or on error
 */
export async function fetchCategories(): Promise<Category[]> {
  // Check if Saleor is configured
  if (!isSaleorConfigured()) {
    logger.info("saleor_service_fallback", {
      reason: "Saleor not configured",
      dataType: "categories",
    });
    return getMockCategories();
  }

  try {
    const client = getSaleorClient();
    if (!client) {
      logger.info("saleor_service_fallback", {
        reason: "Saleor client not available",
        dataType: "categories",
      });
      return getMockCategories();
    }

    const response = await client.execute<{
      productTypes: { edges: { node: SaleorProductType }[] };
    }>(PRODUCT_TYPES_QUERY);

    if (response.errors && response.errors.length > 0) {
      logger.error("saleor_service_error", {
        error: response.errors.map((e) => e.message).join(", "),
        dataType: "categories",
      });
      return getMockCategories();
    }

    const productTypes =
      response.data?.productTypes?.edges?.map((edge) => edge.node) || [];

    // Map Saleor product types to our Category format
    const categories: Category[] = productTypes.map((pt) => ({
      id: pt.id,
      name: pt.name,
    }));

    logger.info("saleor_service_success", {
      count: categories.length,
      dataType: "categories",
    });
    return categories;
  } catch (error) {
    logger.error("saleor_service_error", {
      error: error instanceof Error ? error.message : "Unknown error",
      dataType: "categories",
    });
    return getMockCategories();
  }
}

/**
 * Fetch dishes from Saleor products, optionally filtered by categoryId
 * Falls back to mock data if Saleor is not configured or on error
 */
export async function fetchDishes(categoryId?: string): Promise<Dish[]> {
  // Check if Saleor is configured
  if (!isSaleorConfigured()) {
    logger.info("saleor_service_fallback", {
      reason: "Saleor not configured",
      dataType: "dishes",
    });
    return getMockDishes(categoryId);
  }

  try {
    const client = getSaleorClient();
    if (!client) {
      logger.info("saleor_service_fallback", {
        reason: "Saleor client not available",
        dataType: "dishes",
      });
      return getMockDishes(categoryId);
    }

    const response = await client.execute<{
      products: { edges: { node: SaleorProduct }[] };
    }>(PRODUCTS_QUERY);

    if (response.errors && response.errors.length > 0) {
      logger.error("saleor_service_error", {
        error: response.errors.map((e) => e.message).join(", "),
        dataType: "dishes",
      });
      return getMockDishes(categoryId);
    }

    const products =
      response.data?.products?.edges?.map((edge) => edge.node) || [];

    // Map Saleor products to our Dish format
    const dishes: Dish[] = products
      // Filter by categoryId if provided
      .filter((product) => !categoryId || product.productType.id === categoryId)
      // Map each product to a dish (using first variant for price)
      .map((product) => {
        // Get first variant with pricing, or use default values
        const firstVariant = product.variants[0];
        const price = firstVariant?.pricing?.price?.amount
          ? parseFloat(firstVariant.pricing.price.amount)
          : 0;
        const currency = firstVariant?.pricing?.price?.currency || "USD";

        return {
          id: product.id,
          name: product.name,
          description: product.description || "",
          price: price,
          currency: currency,
          categoryId: product.productType.id,
          imageUrl: product.thumbnail?.url || "",
          restaurantId: "", // Not directly available in Saleor products, will need to be set elsewhere
        };
      });

    logger.info("saleor_service_success", {
      count: dishes.length,
      dataType: "dishes",
      filter: categoryId ? `categoryId=${categoryId}` : "none",
    });
    return dishes;
  } catch (error) {
    logger.error("saleor_service_error", {
      error: error instanceof Error ? error.message : "Unknown error",
      dataType: "dishes",
    });
    return getMockDishes(categoryId);
  }
}

/**
 * Get mock restaurants for development/testing
 */
function getMockRestaurants(): Restaurant[] {
  return Object.keys(TEST_RESTAURANTS).map((key) => {
    const rest = TEST_RESTAURANTS[key as keyof typeof TEST_RESTAURANTS];
    return {
      id: rest.id,
      name: rest.name,
      categories: [], // Empty categories - will be populated separately
      deliveryLocations: [],
    };
  });
}

/**
 * Get mock categories for development/testing
 */
function getMockCategories(): Category[] {
  return Object.keys(TEST_CATEGORIES).map((key) => {
    const cat = TEST_CATEGORIES[key as keyof typeof TEST_CATEGORIES];
    return {
      id: cat.id,
      name: cat.name,
    };
  });
}

/**
 * Get mock dishes for development/testing, optionally filtered by categoryId
 */
function getMockDishes(categoryId?: string): Dish[] {
  let dishes = Object.keys(TEST_DISHES).map((key) => {
    const dish = TEST_DISHES[key as keyof typeof TEST_DISHES];
    return {
      id: dish.id,
      name: dish.name,
      description: "Test description",
      price: dish.price,
      currency: "USD",
      categoryId: dish.categoryId,
      imageUrl: "https://example.com/image.jpg",
      restaurantId: "restA", // Default restaurant ID for mock data
    };
  });

  // Filter by categoryId if provided
  if (categoryId) {
    dishes = dishes.filter((dish) => dish.categoryId === categoryId);
  }

  return dishes;
}
