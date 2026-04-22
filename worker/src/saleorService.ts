// Phase 1: Saleor Data Service
// Fetches real data from Saleor OMS with fallback to mock data
// Maps Saleor's data model to our Channel/Category/Dish entities

import { logger } from "./logger";
import {
  SaleorClient,
  getSaleorClient,
  isSaleorConfigured,
  SaleorResponse,
} from "./saleorClient";
import { Channel, Restaurant, Category, Dish } from "./contracts";
import { TEST_CHANNELS, TEST_DISHES, TEST_CATEGORIES } from "./testHelpers";

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
 * Saleor Collection (legacy - maps to Restaurant)
 */
export interface SaleorCollection {
  id: string;
  name: string;
  backgroundImage: {
    url: string;
  } | null;
}

/**
 * Saleor Channel (maps to our Channel entity)
 */
export interface SaleorChannel {
  id: string;
  slug: string;
  name: string;
  isActive: boolean;
  currencyCode: string;
  defaultCountry: {
    code: string;
    country: string;
  } | null;
  warehouses: Array<{
    id: string;
    slug: string;
    name: string;
  }>;
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
 * GraphQL query for fetching collections (restaurants - legacy)
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
 * GraphQL query for fetching channels (Saleor multichannel)
 */
export const CHANNELS_QUERY = `
  query Channels {
    channels {
      id
      slug
      name
      isActive
      currencyCode
      defaultCountry {
        code
        country
      }
      warehouses {
        id
        slug
        name
      }
    }
  }
`;

/**
 * Fetch channels from Saleor and map to Restaurant for GraphQL backward compatibility
 */
export async function fetchRestaurants(): Promise<Restaurant[]> {
  return fetchChannels().then(mapChannelsToRestaurants);
}

export async function fetchChannels(): Promise<Channel[]> {
  if (!isSaleorConfigured()) {
    logger.info("saleor_service_fallback", {
      reason: "Saleor not configured",
      dataType: "channels",
    });
    return getMockChannels();
  }

  try {
    const client = getSaleorClient();
    if (!client) {
      logger.info("saleor_service_fallback", {
        reason: "Saleor client not available",
        dataType: "channels",
      });
      return getMockChannels();
    }

    const response = await client.execute<{
      channels: SaleorChannel[];
    }>(CHANNELS_QUERY);

    if (response.errors && response.errors.length > 0) {
      logger.error("saleor_service_error", {
        error: response.errors.map((e) => e.message).join(", "),
        dataType: "channels",
      });
      return getMockChannels();
    }

    const channelsResponse = response.data?.channels;

    if (!channelsResponse || !Array.isArray(channelsResponse)) {
      logger.error("saleor_service_malformed_response", {
        error: "Invalid channels response structure",
        dataType: "channels",
        received: channelsResponse,
      });
      return getMockChannels();
    }

    const channels: Channel[] = [];

    for (const ch of channelsResponse) {
      if (!ch || typeof ch.id !== "string" || typeof ch.name !== "string") {
        logger.warn("saleor_service_skipping_malformed_channel", {
          channel: ch,
          dataType: "channels",
        });
        continue;
      }

      channels.push({
        id: ch.id,
        slug: ch.slug,
        name: ch.name,
        isActive: ch.isActive,
        currencyCode: ch.currencyCode,
        defaultCountry: ch.defaultCountry
          ? { code: ch.defaultCountry.code, country: ch.defaultCountry.country }
          : undefined,
        warehouses: ch.warehouses,
        categories: [],
        deliveryLocations: [],
      });
    }

    logger.info("saleor_service_success", {
      count: channels.length,
      dataType: "channels",
    });
    return channels;
  } catch (error) {
    logger.error("saleor_service_error", {
      error: error instanceof Error ? error.message : "Unknown error",
      dataType: "channels",
    });
    return getMockChannels();
  }
}

function mapChannelsToRestaurants(channels: Channel[]): Restaurant[] {
  return channels.map((ch) => ({
    id: ch.id,
    name: ch.name,
    description: ch.description,
    imageUrl: ch.imageUrl,
    tags: ch.tags,
    categories: ch.categories,
    deliveryLocations: ch.deliveryLocations,
  }));
}

export async function fetchCategories(
  restaurantId?: string,
  channelId?: string,
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

export async function fetchDishes(
  categoryId?: string,
  restaurantId?: string,
  channelId?: string,
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

function getMockChannels(): Channel[] {
  return Object.keys(TEST_CHANNELS).map((key) => {
    const ch = TEST_CHANNELS[key as keyof typeof TEST_CHANNELS];
    return {
      id: ch.id,
      slug: ch.slug || ch.id,
      name: ch.name,
      isActive: true,
      currencyCode: "USD",
      defaultCountry: undefined,
      warehouses: [],
      categories: [],
      deliveryLocations: [],
    };
  });
}

function getMockCategories(_restaurantId?: string): Category[] {
  return Object.keys(TEST_CATEGORIES).map((key) => {
    const cat = TEST_CATEGORIES[key as keyof typeof TEST_CATEGORIES];
    return {
      id: cat.id,
      name: cat.name,
      imageUrl: cat.imageUrl || "",
    };
  });

  return categories;
}

function getMockDishes(categoryId?: string, _restaurantId?: string): Dish[] {
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
      restaurantId: restaurantId,
    };
  });

  if (categoryId) {
    dishes = dishes.filter((dish) => dish.categoryId === categoryId);
  }

  if (restaurantId) {
    dishes = dishes.map((dish) => ({
      ...dish,
      restaurantId: restaurantId,
    }));
  }

  return dishes;
}
