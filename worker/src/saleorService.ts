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
  backgroundImage?: {
    url: string;
  } | null;
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
                gross {
                  amount
                  currency
                }
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
          backgroundImage {
            url
          }
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

    const collectionsResponse = response.data?.collections;

    // Handle malformed response - if collections or edges is not as expected
    if (!collectionsResponse || !Array.isArray(collectionsResponse.edges)) {
      logger.error("saleor_service_malformed_response", {
        error: "Invalid collections response structure",
        dataType: "restaurants",
        received: collectionsResponse,
      });
      return getMockRestaurants();
    }

    const collections =
      collectionsResponse.edges
        .filter(
          (edge): edge is { node: SaleorCollection } => !!edge && !!edge.node,
        )
        .map((edge) => edge.node) || [];

    // Map Saleor collections to our Restaurant format
    // For now, we'll treat each collection as a restaurant with empty categories
    // Categories and dishes will be fetched separately
    const restaurants: Restaurant[] = [];

    for (const collection of collections) {
      // Skip malformed collection data
      if (
        !collection ||
        typeof collection.id !== "string" ||
        typeof collection.name !== "string"
      ) {
        logger.warn("saleor_service_skipping_malformed_collection", {
          collection: collection,
          dataType: "restaurants",
        });
        continue;
      }

      restaurants.push({
        id: collection.id,
        name: collection.name,
        description: "", // Not available in Saleor collections
        imageUrl: collection.backgroundImage?.url || "", // Map backgroundImage.url to imageUrl
        tags: [], // Not available in Saleor collections
        categories: [], // Will be populated when fetchCategories is called
        deliveryLocations: [], // Not available in Saleor collections, leave empty
      });
    }

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
 * Note: Saleor does not provide a direct way to filter product types (categories) by restaurant (collection).
 * The restaurantId parameter is accepted for API consistency but is not used for filtering in this implementation.
 * Falls back to mock data if Saleor is not configured or on error.
 */
export async function fetchCategories(
  restaurantId?: string,
): Promise<Category[]> {
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

    // Saleor does not provide a direct way to filter product types by restaurant (collection).
    // We fetch all product types and return them regardless of the restaurantId parameter.
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

    const productTypesResponse = response.data?.productTypes;

    // Handle malformed response - if productTypes or edges is not as expected
    if (!productTypesResponse || !Array.isArray(productTypesResponse.edges)) {
      logger.error("saleor_service_malformed_response", {
        error: "Invalid productTypes response structure",
        dataType: "categories",
        received: productTypesResponse,
      });
      return getMockCategories();
    }

    const productTypes =
      productTypesResponse.edges
        .filter(
          (edge): edge is { node: SaleorProductType } => !!edge && !!edge.node,
        )
        .map((edge) => edge.node) || [];

    // Map Saleor product types to our Category format
    const categories: Category[] = [];

    for (const pt of productTypes) {
      // Skip malformed product type data
      if (!pt || typeof pt.id !== "string" || typeof pt.name !== "string") {
        logger.warn("saleor_service_skipping_malformed_product_type", {
          productType: pt,
          dataType: "categories",
        });
        continue;
      }

      categories.push({
        id: pt.id,
        name: pt.name,
        imageUrl: pt.backgroundImage?.url || "",
      });
    }

    logger.info("saleor_service_success", {
      count: categories.length,
      dataType: "categories",
      filter: restaurantId
        ? `restaurantId=${restaurantId} (ignored, no direct Saleor mapping)`
        : "none",
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
 * Note: Saleor does not provide a direct way to filter products by restaurant (collection).
 * The restaurantId parameter is accepted for API consistency but is not used for filtering in this implementation.
 * For now, we'll set the restaurantId on the dish objects if provided.
 * Falls back to mock data if Saleor is not configured or on error.
 */
export async function fetchDishes(
  categoryId?: string,
  restaurantId?: string,
): Promise<Dish[]> {
  // Check if Saleor is configured
  if (!isSaleorConfigured()) {
    logger.info("saleor_service_fallback", {
      reason: "Saleor not configured",
      dataType: "dishes",
    });
    return getMockDishes(categoryId, restaurantId);
  }

  try {
    const client = getSaleorClient();
    if (!client) {
      logger.info("saleor_service_fallback", {
        reason: "Saleor client not available",
        dataType: "dishes",
      });
      return getMockDishes(categoryId, restaurantId);
    }

    const response = await client.execute<{
      products: { edges: { node: SaleorProduct }[] };
    }>(PRODUCTS_QUERY);

    if (response.errors && response.errors.length > 0) {
      logger.error("saleor_service_error", {
        error: response.errors.map((e) => e.message).join(", "),
        dataType: "dishes",
      });
      return getMockDishes(categoryId, restaurantId);
    }

    const productsResponse = response.data?.products;

    // Handle malformed response - if products or edges is not as expected
    if (!productsResponse || !Array.isArray(productsResponse.edges)) {
      logger.error("saleor_service_malformed_response", {
        error: "Invalid products response structure",
        dataType: "dishes",
        received: productsResponse,
      });
      return getMockDishes(categoryId, restaurantId);
    }

    const products =
      productsResponse.edges
        .filter(
          (edge): edge is { node: SaleorProduct } => !!edge && !!edge.node,
        )
        .map((edge) => edge.node) || [];

    // Map Saleor products to our Dish format
    const dishes: Dish[] = [];

    for (const product of products) {
      // Skip malformed product data
      if (
        !product ||
        typeof product.id !== "string" ||
        typeof product.name !== "string" ||
        !product.productType ||
        typeof product.productType.id !== "string"
      ) {
        logger.warn("saleor_service_skipping_malformed_product", {
          product: product,
          dataType: "dishes",
        });
        continue;
      }

      // Filter by categoryId if provided
      if (categoryId && product.productType.id !== categoryId) {
        continue;
      }

      const firstVariant =
        Array.isArray(product.variants) && product.variants.length > 0
          ? product.variants[0]
          : null;

      let price = 0;
      let currency = "USD";
      if (firstVariant?.pricing?.price?.gross) {
        price = parseFloat(firstVariant.pricing.price.gross.amount) || 0;
        currency = firstVariant.pricing.price.gross.currency || "USD";
      }

      dishes.push({
        id: product.id,
        name: product.name,
        description: product.description || "",
        price: price,
        currency: currency,
        categoryId: product.productType.id,
        imageUrl: product.thumbnail?.url || "",
        restaurantId: restaurantId || "", // Use provided restaurantId or empty string
      });
    }

    logger.info("saleor_service_success", {
      count: dishes.length,
      dataType: "dishes",
      filter: categoryId ? `categoryId=${categoryId}` : "none",
      restaurantFilter: restaurantId
        ? `restaurantId=${restaurantId} (set on dish objects, not filtered)`
        : "none",
    });
    return dishes;
  } catch (error) {
    logger.error("saleor_service_error", {
      error: error instanceof Error ? error.message : "Unknown error",
      dataType: "dishes",
    });
    return getMockDishes(categoryId, restaurantId);
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
      description: rest.description,
      imageUrl: rest.imageUrl,
      tags: rest.tags,
      categories: [], // Empty categories - will be populated separately
      deliveryLocations: [],
    };
  });
}

/**
 * Get mock categories for development/testing, optionally filtered by restaurantId
 */
function getMockCategories(restaurantId?: string): Category[] {
  // In mock data, all categories belong to all restaurants for simplicity
  // In a real implementation, we would have a restaurant -> categories mapping
  const categories = Object.keys(TEST_CATEGORIES).map((key) => {
    const cat = TEST_CATEGORIES[key as keyof typeof TEST_CATEGORIES];
    return {
      id: cat.id,
      name: cat.name,
      imageUrl: cat.imageUrl || "",
    };
  });

  // For mock data, we return all categories regardless of restaurantId
  // since our test data doesn't have restaurant-specific categories
  return categories;
}

/**
 * Get mock dishes for development/testing, optionally filtered by categoryId
 * Note: Mock data does not filter by restaurantId to match Saleor behavior (restaurantId is set on dish objects but not used for filtering).
 */
function getMockDishes(categoryId?: string, restaurantId?: string): Dish[] {
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

  // Override restaurantId in results if requested (for consistency with service behavior)
  if (restaurantId) {
    dishes = dishes.map((dish) => ({
      ...dish,
      restaurantId: restaurantId,
    }));
  }

  return dishes;
}
