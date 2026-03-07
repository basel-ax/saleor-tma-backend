// Phase 9: Real Saleor Client Integration
// Provides GraphQL client for Saleor API communication
// See: task/phase-9-improve-code.md

import { logger } from "./logger";

/**
 * Saleor client configuration
 */
export interface SaleorConfig {
  apiUrl: string;
  token: string;
}

/**
 * GraphQL query/mutation result wrapper
 */
export interface SaleorResponse<T = any> {
  data?: T;
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: string[];
  }>;
}

/**
 * Saleor GraphQL client for executing queries and mutations
 */
export class SaleorClient {
  private apiUrl: string;
  private token: string;

  constructor(config: SaleorConfig) {
    this.apiUrl = config.apiUrl;
    this.token = config.token;
  }

  /**
   * Execute a GraphQL query/mutation against Saleor API
   */
  async execute<T = any>(
    query: string,
    variables?: Record<string, any>,
    operationName?: string
  ): Promise<SaleorResponse<T>> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // Add authorization header if token is available
    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(this.apiUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          query,
          variables,
          operationName,
        }),
      });

      if (!response.ok) {
        logger.error("saleor_api_error", {
          status: response.status,
          statusText: response.statusText,
        });
        return {
          errors: [
            {
              message: `Saleor API error: ${response.status} ${response.statusText}`,
            },
          ],
        };
      }

      return await response.json();
    } catch (error) {
      logger.error("saleor_network_error", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return {
        errors: [
          {
            message: error instanceof Error ? error.message : "Network error connecting to Saleor",
          },
        ],
      };
    }
  }

  /**
   * Execute a mutation with error handling
   */
  async mutate<T = any>(
    mutation: string,
    variables?: Record<string, any>,
    operationName?: string
  ): Promise<{ data?: T; error?: string }> {
    const response = await this.execute<T>(mutation, variables, operationName);

    if (response.errors && response.errors.length > 0) {
      const errorMessage = response.errors.map((e) => e.message).join(", ");
      logger.error("saleor_mutation_error", { error: errorMessage });
      return { error: errorMessage };
    }

    return { data: response.data };
  }
}

// ============================================================
// Saleor GraphQL Fragments and Mutations
// ============================================================

/**
 * OrderCreate mutation for creating orders in Saleor
 */
export const ORDER_CREATE_MUTATION = `
  mutation OrderCreate($input: OrderCreateInput!) {
    orderCreate(input: $input) {
      order {
        id
        number
        status
        total {
          gross {
            amount
            currency
          }
        }
        shippingAddress {
          streetAddress1
          city
          country {
            code
          }
        }
        lines {
          id
          productName
          quantity
        }
        createdAt
      }
      errors {
        field
        message
        code
      }
    }
  }
`;

/**
 * Check if Saleor client is configured
 */
export function isSaleorConfigured(): boolean {
  if (typeof globalThis !== "undefined") {
    const env = (globalThis as any).__env__ as Record<string, string> | undefined;
    return !!(env?.SALEOR_API_URL && env?.SALEOR_TOKEN);
  }
  return false;
}

/**
 * Get Saleor client instance from environment
 */
export function getSaleorClient(): SaleorClient | null {
  if (typeof globalThis !== "undefined") {
    const env = (globalThis as any).__env__ as Record<string, string> | undefined;
    if (env?.SALEOR_API_URL && env?.SALEOR_TOKEN) {
      return new SaleorClient({
        apiUrl: env.SALEOR_API_URL,
        token: env.SALEOR_TOKEN,
      });
    }
  }
  return null;
}

// ============================================================
// Phase 9 Notes: Real Saleor Integration
// ============================================================
//
// Current implementation provides real Saleor API client
// with fallback to mock for development/testing.
//
// Configuration:
// - SALEOR_API_URL: GraphQL endpoint (e.g., https://store.saleor.io/graphql/)
// - SALEOR_TOKEN: API token for authentication
//
// Error handling:
// - Network errors are caught and logged
// - GraphQL errors are extracted and returned
// - Rate limiting should be handled by caller
//
// See: wrangler.toml for environment configuration
// ============================================================
