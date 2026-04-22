// Phase 10: Product Management
// Handles create/update dishes, stock, store descriptions

import {
  CreateDishInput,
  UpdateDishInput,
  UpdateStockInput,
  UpdateStoreDescriptionInput,
} from "./contracts";
import { logger } from "./logger";
import { getChannelAdmin } from "./channelAdmin";

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  categoryId: string;
  restaurantId: string;
  imageUrl: string;
  quantity: number;
}

export interface StoreDescription {
  restaurantId: string;
  description: string;
  updatedAt: string;
  updatedBy: string;
}

const memoryProducts: Map<string, Product> = new Map();
const memoryStoreDescriptions: Map<string, StoreDescription> = new Map();

function generateId(): string {
  return `dish_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function createDish(input: CreateDishInput): Product {
  const product: Product = {
    id: generateId(),
    name: input.name,
    description: input.description,
    price: input.price,
    currency: input.currency,
    categoryId: input.categoryId,
    restaurantId: input.restaurantId,
    imageUrl: input.imageUrl || "",
    quantity: 0,
  };

  memoryProducts.set(product.id, product);
  logger.info("product_created", { dishId: product.id, name: product.name });

  return product;
}

export function updateDish(input: UpdateDishInput): Product | null {
  const product = memoryProducts.get(input.dishId);

  if (!product) {
    return null;
  }

  if (input.name !== undefined) {
    product.name = input.name;
  }
  if (input.description !== undefined) {
    product.description = input.description;
  }
  if (input.price !== undefined) {
    product.price = input.price;
  }
  if (input.currency !== undefined) {
    product.currency = input.currency;
  }
  if (input.imageUrl !== undefined) {
    product.imageUrl = input.imageUrl;
  }

  memoryProducts.set(product.id, product);
  logger.info("product_updated", { dishId: product.id });

  return product;
}

export function updateStock(input: UpdateStockInput): Product | null {
  const product = memoryProducts.get(input.dishId);

  if (!product) {
    return null;
  }

  product.quantity = input.quantity;
  memoryProducts.set(product.id, product);
  logger.info("stock_updated", { dishId: input.dishId, quantity: input.quantity });

  return product;
}

export function getDish(dishId: string): Product | undefined {
  return memoryProducts.get(dishId);
}

export function getDishesByRestaurant(restaurantId: string): Product[] {
  const products: Product[] = [];
  for (const product of memoryProducts.values()) {
    if (product.restaurantId === restaurantId) {
      products.push(product);
    }
  }
  return products;
}

export function getDishesByCategory(categoryId: string): Product[] {
  const products: Product[] = [];
  for (const product of memoryProducts.values()) {
    if (product.categoryId === categoryId) {
      products.push(product);
    }
  }
  return products;
}

export function updateStoreDescription(
  input: UpdateStoreDescriptionInput,
  updatedBy: string,
): StoreDescription {
  const description: StoreDescription = {
    restaurantId: input.restaurantId,
    description: input.description,
    updatedAt: new Date().toISOString(),
    updatedBy,
  };

  memoryStoreDescriptions.set(input.restaurantId, description);
  logger.info("store_description_updated", {
    restaurantId: input.restaurantId,
  });

  return description;
}

export function getStoreDescription(
  restaurantId: string,
): StoreDescription | undefined {
  return memoryStoreDescriptions.get(restaurantId);
}

export async function isChannelAdmin(
  telegramUserId: string,
  restaurantId: string,
): Promise<boolean> {
  const admin = await getChannelAdmin(restaurantId);
  return admin?.telegramUserId === telegramUserId;
}