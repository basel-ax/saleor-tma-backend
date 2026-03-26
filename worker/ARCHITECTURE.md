# Architecture Documentation - Telegram TMA GraphQL Backend

## Overview

This document provides comprehensive architecture documentation for the Telegram Mini App GraphQL backend built on Cloudflare Workers. It covers data models, authentication flows, cart management, and system interactions.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        TELEGRAM MINI APP (Frontend)                     │
│                          (Telegram WebView)                              │
└─────────────────────────────────┬───────────────────────────────────────┘
                                   │ HTTP + X-Telegram-Init-Data Header
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    CLOUDFLARE WORKER (This Project)                     │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                     GraphQL Endpoint (/graphql)                   │   │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────────┐   │   │
│  │  │   Auth Layer  │─▶│ GraphQL Router │─▶│  Resolver Engine  │   │   │
│  │  │  (auth.ts)    │  │  (index.ts)    │  │  (resolvers.ts)   │   │   │
│  │  └───────────────┘  └───────────────┘  └───────────────────┘   │   │
│  │         │                   │                    │              │   │
│  │         ▼                   ▼                    ▼              │   │
│  │  ┌───────────────────────────────────────────────────────────┐  │   │
│  │  │                    Cart Manager (cart.ts)                  │  │   │
│  │  │           In-memory store (per-user session)             │  │   │
│  │  └───────────────────────────────────────────────────────────┘  │   │
│  │         │                   │                    │              │   │
│  │         └───────────────────┴────────────────────┘              │   │
│  │                           │                                       │   │
│  │                           ▼                                       │   │
│  │  ┌───────────────────────────────────────────────────────────┐  │   │
│  │  │             Saleor Data Service (saleorService.ts)         │  │   │
│  │  │    Fetches restaurants, categories, dishes from Saleor      │  │   │
│  │  │         with automatic fallback to mock data               │  │   │
│  │  └───────────────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                   │                                       │
│                                   ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                  Saleor Client (saleorClient.ts)               │   │
│  │              Thin HTTP client to Saleor GraphQL API             │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────┬───────────────────────────────────────┘
                                   │ GraphQL Queries/Mutations
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         SALEOR E-COMMERCE PLATFORM                      │
│                    (External Order Management API)                       │
└─────────────────────────────────────────────────────────────────────────┘
```
┌─────────────────────────────────────────────────────────────────────────┐
│                        TELEGRAM MINI APP (Frontend)                     │
│                          (Telegram WebView)                              │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │ HTTP + X-Telegram-Init-Data Header
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    CLOUDFLARE WORKER (This Project)                     │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                     GraphQL Endpoint (/graphql)                   │   │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────────┐   │   │
│  │  │   Auth Layer  │─▶│ GraphQL Router │─▶│  Resolver Engine  │   │   │
│  │  │  (auth.ts)    │  │  (index.ts)    │  │  (resolvers.ts)   │   │   │
│  │  └───────────────┘  └───────────────┘  └───────────────────┘   │   │
│  │         │                   │                    │              │   │
│  │         ▼                   ▼                    ▼              │   │
│  │  ┌───────────────────────────────────────────────────────────┐  │   │
│  │  │                    Cart Manager (cart.ts)                 │  │   │
│  │  │           In-memory store (per-user session)              │  │   │
│  │  └───────────────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                   │                                       │
│                                   ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                  Saleor Client (saleorClient.ts)               │   │
│  │              Thin HTTP client to Saleor GraphQL API            │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │ GraphQL Queries/Mutations
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         SALEOR E-COMMERCE PLATFORM                      │
│                    (External Order Management API)                      │
└─────────────────────────────────────────────────────────────────────────┘
```

## Data Models

### Core Domain Types

#### Restaurant
```typescript
interface Restaurant {
  id: string;           // Unique identifier (e.g., "rest1")
  name: string;         // Display name (e.g., "Pizza Hub")
  description?: string; // Brief description
  imageUrl?: string;    // Restaurant image
  tags?: string[];      // Cuisine tags (e.g., ["pizza", "italian"])
}
```

#### Category
```typescript
interface Category {
  id: string;           // Unique identifier (e.g., "cat1")
  restaurantId: string; // Parent restaurant ID
  name: string;         // Category name (e.g., "Pizzas")
  description?: string;
  imageUrl?: string;
}
```

#### Dish
```typescript
interface Dish {
  id: string;           // Unique identifier (e.g., "dish1")
  restaurantId: string; // Parent restaurant ID
  categoryId: string;   // Parent category ID
  name: string;         // Dish name (e.g., "Margherita")
  description?: string; // Ingredients, allergens
  imageUrl?: string;
  price?: number;       // Price value
  currency?: string;    // Currency code (e.g., "USD")
}
```

### Cart Types

#### CartItem
```typescript
interface CartItem {
  dishId: string;       // Reference to Dish.id
  quantity: number;    // Item quantity
  name?: string;       // Snapshot: dish name at add time
  price?: number;      // Snapshot: price at add time
  currency?: string;   // Snapshot: currency at add time
}
```

#### CartState
```typescript
interface CartState {
  restaurantId: string | null; // Active restaurant (enforces single-restaurant cart)
  items: CartItem[];           // Cart items
}
```

### Authentication Types

#### AuthContext
```typescript
interface AuthContext {
  userId: string;        // Telegram user ID
  name?: string;        // User's first + last name
  language?: string;    // User's language code
  valid: boolean;       // Validation status
  errorCode?: string;   // Error code if invalid
}
```

#### GraphQLContext
```typescript
interface GraphQLContext {
  auth: AuthContext;    // Authentication context from Telegram Init Data
}
```

### Order Types

#### PlaceOrderInput
```typescript
interface PlaceOrderInput {
  restaurantId: string;          // Restaurant to order from
  items: OrderItemInput[];        // Items to order
  deliveryLocation?: DeliveryLocation;  // Delivery coordinates
  googleMapsUrl?: string;        // Optional Google Maps link
  comment?: string;              // Delivery instructions
}
```

#### OrderItemInput
```typescript
interface OrderItemInput {
  dishId: string;     // Dish reference
  quantity: number;  // Quantity to order
}
```

#### DeliveryLocation
```typescript
interface DeliveryLocation {
  lat: number;  // Latitude
  lng: number;  // Longitude
}
```

#### PlaceOrderPayload
```typescript
interface PlaceOrderPayload {
  orderId: string;      // Saleor order ID
  status: string;       // Order status (e.g., "CREATED")
  estimatedDelivery?: string;  // ETA if available
}
```

## Authentication Flow

### Telegram Init Data Validation

```
┌──────────────────┐
│  Incoming Request │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────────┐
│  Check X-Telegram-Init-Data     │
│  Header Present?                 │
└────────┬────────────────────────┘
         │
    ┌────┴────┐
    │ Yes     │ No
    ▼         ▼
┌─────────────┐    ┌─────────────────┐
│ Parse Init  │    │ Return 401      │
│ Data        │    │ Unauthorized    │
└────┬────────┘    └─────────────────┘
     │
     ▼
┌──────────────────────────────────┐
│ Validate Required Fields        │
│ (hash, auth_date, user)          │
└────────┬────────────────────────┘
         │
    ┌────┴────┐
    │ Valid   │ Invalid
    ▼         ▼
┌─────────────┐    ┌─────────────────┐
│ Check       │    │ Return 401      │
│ Expiration  │    │ Invalid Data    │
└────┬────────┘    └─────────────────┘
     │
     ▼
┌──────────────────────────────────┐
│ (Production: HMAC-SHA256        │
│  Verification against            │
│  TELEGRAM_BOT_TOKEN)            │
└────────┬────────────────────────┘
         │
    ┌────┴────┐
    │ Valid   │ Invalid
    ▼         ▼
┌─────────────┐    ┌─────────────────┐
│ Extract     │    │ Return 401      │
│ User Info   │    │ Hash Mismatch   │
└────┬────────┘    └─────────────────┘
     │
     ▼
┌──────────────────────────────────┐
│ Create AuthContext              │
│ Inject into GraphQL Context     │
└──────────────────────────────────┘
```

### Auth Context Usage

```typescript
// In worker/src/index.ts
function createContext(request: Request): GraphQLContext {
  const auth = extractAuthContext(request);
  return { auth };
}

// All resolvers receive this context
async function resolveGraphQL(query: string, variables: any, context: GraphQLContext) {
  // context.auth.userId is available for:
  // - User-specific cart operations
  // - Logging and tracing
  // - Saleor order creation
}
```

## Cart Management Flow

### Cart Operations

```
┌─────────────────────────────────────────────────────────────────┐
│                        CART OPERATIONS                           │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│    Add to Cart  │      │ Update Quantity │      │ Remove Item     │
└────────┬────────┘      └────────┬────────┘      └────────┬────────┘
         │                        │                        │
         ▼                        ▼                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Cart Manager (cart.ts)                       │
│                                                                  │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │
│  │ getCart()   │    │ setCart()   │    │ clearCart() │        │
│  └─────────────┘    └─────────────┘    └─────────────┘        │
│                                                                  │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │
│  │ addToCart() │    │updateCartItm│    │removeFromCart│        │
│  └─────────────┘    └─────────────┘    └─────────────┘        │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ getCartTotal() | getCartItemCount()                      │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│              In-Memory Store (Map<string, CartState>)            │
│                                                                  │
│  Key: userId (from Telegram)                                     │
│  Value: { restaurantId: string, items: CartItem[] }            │
└─────────────────────────────────────────────────────────────────┘
```

### Restaurant Switching Behavior

```
User has items from Restaurant A
         │
         ▼
User adds item from Restaurant B
         │
         ▼
┌─────────────────────────────────────┐
│ Check: cart.restaurantId !==       │
│         newItem.restaurantId?       │
└────────┬────────────────────────────┘
         │
    ┌────┴────┐
    │ Yes     │ No
    ▼         ▼
┌────────────┐    ┌────────────────────┐
│ Clear Cart │    │ Add/Update Item   │
│ Add New    │    │ (Normal Flow)     │
│ Item       │    └────────────────────┘
└────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ Frontend receives updated cart     │
│ with new restaurantId              │
└─────────────────────────────────────┘
```

## GraphQL Operation Flow

### Query: Restaurants

```
Frontend Query                    Worker Resolver                 Saleor Data Service          Saleor
     │                                │                                  │                      │
     │ { restaurants(search) }       │                                  │                      │
     │───────────────────────────────▶│                                  │                      │
     │                                │ Validate Auth                    │                      │
     │                                │─────────────────▶                │                      │
     │                                │                                  │                      │
     │                                │ Get Restaurants                  │                      │
     │                                │─────────────────────────────────▶│                      │
     │                                │                                  │ Query Collections    │
     │                                │                                  │─────────────────────▶│
     │                                │                                  │                      │
     │                                │ { restaurants: [...] }          │                      │
     │◀───────────────────────────────│◀─────────────────────────────────│                      │
     │                                │                                  │                      │
     │                                │                                  │                      │
     │   (Falls back to mock data if Saleor unavailable)                │                      │
```

### Mutation: PlaceOrder

```
Frontend Mutation                 Worker Resolver                 Saleor
     │                                │                            │
     │ placeOrder(input)              │                            │
     │───────────────────────────────▶│                            │
     │                                │ Validate Auth              │
     │                                │─────────────────▶          │
     │                                │                            │
     │                                │ Create Draft Order         │
     │                                │───────────────────────────▶
     │                                │                            │
     │                                │ Add Order Lines            │
     │                                │───────────────────────────▶
     │                                │                            │
     │                                │ Complete Order            │
     │                                │───────────────────────────▶
     │                                │                            │
     │ { orderId, status }            │                            │
     │◀───────────────────────────────│                            │
     │                                │                            │
```

## File Structure Reference

| File | Purpose | Key Exports |
|------|---------|-------------|
| [`worker/src/index.ts`](worker/src/index.ts) | Main entry, GraphQL routing | `handleRequest`, `createContext` |
| [`worker/src/auth.ts`](worker/src/auth.ts) | Telegram Init Data validation | `validateInitData`, `extractAuthContext` |
| [`worker/src/cart.ts`](worker/src/cart.ts) | In-memory cart management | `getCart`, `addToCart`, `clearCart` |
| [`worker/src/resolvers.ts`](worker/src/resolvers.ts) | GraphQL resolver implementations | Query/mutation resolvers |
| [`worker/src/contracts.ts`](worker/src/contracts.ts) | TypeScript interfaces | All domain types |
| [`worker/src/saleorClient.ts`](worker/src/saleorClient.ts) | Saleor API client | GraphQL query executor |
| [`worker/src/saleorService.ts`](worker/src/saleorService.ts) | Saleor data service | `fetchRestaurants`, `fetchCategories`, `fetchDishes` |
| [`worker/src/saleorService.test.ts`](worker/src/saleorService.test.ts) | Saleor service tests | Unit tests for data service |
| [`worker/src/errors.ts`](worker/src/errors.ts) | Error handling | `AppError`, error codes |
| [`worker/src/logger.ts`](worker/src/logger.ts) | Structured logging | `logger`, `SecurityEvents` |
| [`worker/schema.graphql`](worker/schema.graphql) | GraphQL schema definition | SDL schema |

## Environment Configuration

| Variable | Description | Required | Location |
|----------|-------------|----------|----------|
| `SALEOR_API_URL` | Saleor GraphQL endpoint | Yes | Production secrets |
| `SALEOR_TOKEN` | Saleor API token | Yes | Production secrets |
| `TELEGRAM_BOT_TOKEN` | Bot token for auth verification | Yes | Production secrets |
| `BACKEND_BASE_URL` | Base URL for webhooks | No | Production secrets |
| `DEBUG` | Enable debug logging | No | wrangler.toml vars |

## Error Handling

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHENTICATED` | 401 | Missing or invalid Telegram Init Data |
| `INVALID_INPUT` | 400 | Invalid GraphQL input |
| `NOT_FOUND` | 404 | Resource not found |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

### Error Response Format

```json
{
  "errors": [
    {
      "message": "Descriptive error message",
      "code": "UNAUTHENTICATED"
    }
  ]
}
```

## Testing Strategy

### Test Types

1. **Unit Tests**: Cart operations, auth validation
2. **Integration Tests**: GraphQL endpoint with mocked Saleor
3. **Contract Tests**: SpecKit against GraphQL schema

### Test Files

- [`worker/src/graphql.test.ts`](worker/src/graphql.test.ts) - Main test suite
- [`worker/src/testHelpers.ts`](worker/src/testHelpers.ts) - Test utilities
- [`worker/src/saleorService.test.ts`](worker/src/saleorService.test.ts) - Saleor data service tests

## Completed Features

### Phase 1: Saleor Data Service (Completed)
- Real data fetching from Saleor Collections (restaurants)
- Real data fetching from Saleor Product Types (categories)
- Real data fetching from Saleor Products with pricing (dishes)
- Automatic fallback to mock data when Saleor is unavailable
- Robust error handling for malformed responses

## Future Considerations

### Production Enhancements

1. **Persistent Cart Storage**: Replace in-memory Map with Cloudflare KV
2. **Full HMAC Verification**: Implement complete Telegram hash validation
3. **Rate Limiting**: Add request rate limiting per user
4. **Caching**: Implement caching for restaurant/category/dish queries
5. **Webhooks**: Handle Saleor webhook events for order status updates

### Scaling Considerations

- KV storage for cart persistence across worker instances
- Redis or Durable Objects for distributed cart state
- CDN for static assets (restaurant images)
