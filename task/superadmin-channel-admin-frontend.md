# Frontend Task: Superadmin & Channel Admin Features

## Overview

This document describes the GraphQL changes needed for the frontend to support superadmin and channel admin functionality.

## Current User

- **Superadmin Telegram ID**: 198928952

---

## GraphQL API Changes

### New Queries

#### 1. `isSuperadmin`

Check if the current user is a superadmin.

```graphql
query {
  isSuperadmin
}
```

**Response:**
```json
{
  "data": {
    "isSuperadmin": true
  }
}
```

**Permission:** Requires valid X-Telegram-Init-Data header.

---

#### 2. `channelAdmin`

Get admin info for a specific channel (restaurant).

```graphql
query {
  channelAdmin(restaurantId: "rest_abc123")
}
```

**Response:**
```json
{
  "data": {
    "channelAdmin": {
      "restaurantId": "rest_abc123",
      "telegramUserId": "198928952",
      "assignedAt": "2026-04-22T10:30:00.000Z",
      "assignedBy": "198928952"
    }
  }
}
```

**Returns:** `null` if no admin assigned.

---

#### 3. `myChannels`

Get all channels where current user is assigned as admin.

```graphql
query {
  myChannels {
    id
    name
    description
    hasAdmin
  }
}
```

**Response:**
```json
{
  "data": {
    "myChannels": [
      {
        "id": "rest_abc123",
        "name": "Pizza Palace",
        "description": "Best pizza in town",
        "hasAdmin": true
      }
    ]
  }
}
```

---

### New Mutations

#### 4. `linkChannelToTelegram`

Link a channel to a telegram user as admin. **Superadmin only.**

```graphql
mutation {
  linkChannelToTelegram(input: {
    restaurantId: "rest_abc123",
    telegramUserId: "198928952"
  }) {
    success
    channelAdmin {
      restaurantId
      telegramUserId
      assignedAt
      assignedBy
    }
  }
}
```

**Response:**
```json
{
  "data": {
    "linkChannelToTelegram": {
      "success": true,
      "channelAdmin": {
        "restaurantId": "rest_abc123",
        "telegramUserId": "198928952",
        "assignedAt": "2026-04-22T10:30:00.000Z",
        "assignedBy": "198928952"
      }
    }
  }
}
```

**Errors:**
- `FORBIDDEN` (403) if caller is not superadmin

---

#### 5. `unlinkChannel`

Remove admin link from a channel. **Superadmin only.**

```graphql
mutation {
  unlinkChannel(input: {
    restaurantId: "rest_abc123"
  }) {
    success
  }
}
```

**Response:**
```json
{
  "data": {
    "unlinkChannel": {
      "success": true
    }
  }
}
```

---

## Frontend Implementation Guide

### 1. Superadmin Check

```typescript
async function checkIsSuperadmin(): Promise<boolean> {
  const response = await fetch('/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Init-Data': telegramInitData,
    },
    body: JSON.stringify({
      query: `{ isSuperadmin }`
    }),
  });
  
  const result = await response.json();
  return result.data?.isSuperadmin ?? false;
}
```

### 2. Link Channel to Telegram User

```typescript
async function linkChannelToTelegram(
  restaurantId: string,
  telegramUserId: string
): Promise<LinkChannelPayload> {
  const response = await fetch('/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Init-Data': telegramInitData,
    },
    body: JSON.stringify({
      query: `
        mutation LinkChannel($restaurantId: ID!, $telegramUserId: ID!) {
          linkChannelToTelegram(input: {
            restaurantId: $restaurantId,
            telegramUserId: $telegramUserId
          }) {
            success
            channelAdmin {
              restaurantId
              telegramUserId
              assignedAt
              assignedBy
            }
          }
        }
      `,
      variables: { restaurantId, telegramUserId }
    }),
  });
  
  const result = await response.json();
  if (result.errors) {
    throw new Error(result.errors[0].message);
  }
  return result.data.linkChannelToTelegram;
}
```

### 3. Get User's Channels

```typescript
async function getMyChannels(): Promise<ChannelInfo[]> {
  const response = await fetch('/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Init-Data': telegramInitData,
    },
    body: JSON.stringify({
      query: `
        query {
          myChannels {
            id
            name
            description
            hasAdmin
          }
        }
      `
    }),
  });
  
  const result = await response.json();
  return result.data?.myChannels ?? [];
}
```

---

## Channel Admin Features (Future)

Channel admins will have these capabilities:

| Feature | Description |
|--------|-------------|
| Add Products | Add new dishes/products to their channel |
| Manage Inventory | Update stock levels |
| Edit Products | Modify product details |
| Edit Store Description | Update channel description |

*These features will be implemented in a future phase.*

---

## Error Handling

All errors follow this format:

```json
{
  "errors": [
    {
      "message": "Human-readable error message",
      "code": "ERROR_CODE",
      "field": "optional_field_name"
    }
  ]
}
```

### Error Codes

| Code | HTTP | Description |
|------|-----|-------------|
| `UNAUTHENTICATED` | 401 | Missing/invalid X-Telegram-Init-Data |
| `FORBIDDEN` | 403 | Permission denied (not superadmin) |
| `BAD_USER_INPUT` | 400 | Invalid input |

---

## Channel Admin Features

### 6. `createDish`

Create a new dish/product. **Channel admin only.**

```graphql
mutation {
  createDish(input: {
    name: "Margherita Pizza"
    description: "Tomato sauce, mozzarella, fresh basil"
    price: 12.99
    currency: "USD"
    categoryId: "cat_pizza"
    restaurantId: "rest_abc123"
    imageUrl: "https://example.com/pizza.jpg"
  }) {
    success
    dish {
      id
      name
      description
      price
      currency
      categoryId
      imageUrl
    }
  }
}
```

**Response:**
```json
{
  "data": {
    "createDish": {
      "success": true,
      "dish": {
        "id": "dish_abc123",
        "name": "Margherita Pizza",
        "description": "Tomato sauce, mozzarella, fresh basil",
        "price": 12.99,
        "currency": "USD",
        "categoryId": "cat_pizza",
        "imageUrl": "https://example.com/pizza.jpg"
      }
    }
  }
}
```

**Permission:** Caller must be channel admin for the restaurantId.

---

### 7. `updateDish`

Update an existing dish. **Channel admin only.**

```graphql
mutation {
  updateDish(input: {
    dishId: "dish_abc123"
    name: "Margherita Pizza (Large)"
    price: 15.99
    description: "Tomato sauce, mozzarella, fresh basil, extra cheese"
    restaurantId: "rest_abc123"
  }) {
    success
    dish {
      id
      name
      description
      price
    }
  }
}
```

**Response:**
```json
{
  "data": {
    "updateDish": {
      "success": true,
      "dish": {
        "id": "dish_abc123",
        "name": "Margherita Pizza (Large)",
        "description": "Tomato sauce, mozzarella, fresh basil, extra cheese",
        "price": 15.99
      }
    }
  }
}
```

---

### 8. `updateStock`

Update stock quantity. **Channel admin only.**

```graphql
mutation {
  updateStock(input: {
    dishId: "dish_abc123"
    quantity: 50
    restaurantId: "rest_abc123"
  }) {
    success
    dishId
    quantity
  }
}
```

**Response:**
```json
{
  "data": {
    "updateStock": {
      "success": true,
      "dishId": "dish_abc123",
      "quantity": 50
    }
  }
}
```

---

### 9. `updateStoreDescription`

Update store/channel description. **Channel admin only.**

```graphql
mutation {
  updateStoreDescription(input: {
    restaurantId: "rest_abc123"
    description: "Welcome to Pizza Palace - Best pizza in town since 1990!"
  }) {
    success
    restaurantId
    description
  }
}
```

**Response:**
```json
{
  "data": {
    "updateStoreDescription": {
      "success": true,
      "restaurantId": "rest_abc123",
      "description": "Welcome to Pizza Palace - Best pizza in town since 1990!"
    }
  }
}
```

---

## Frontend Implementation Guide

### Product Management Examples

#### Create Dish

```typescript
async function createDish(input: {
  name: string;
  description: string;
  price: number;
  currency: string;
  categoryId: string;
  restaurantId: string;
  imageUrl?: string;
}): Promise<ProductPayload> {
  const response = await fetch('/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Init-Data': telegramInitData,
    },
    body: JSON.stringify({
      query: `
        mutation CreateDish($input: CreateDishInput!) {
          createDish(input: $input) {
            success
            dish {
              id
              name
              description
              price
              currency
            }
          }
        }
      `,
      variables: { input }
    }),
  });
  
  const result = await response.json();
  if (result.errors) {
    throw new Error(result.errors[0].message);
  }
  return result.data.createDish;
}
```

#### Update Dish

```typescript
async function updateDish(input: {
  dishId: string;
  name?: string;
  description?: string;
  price?: number;
  currency?: string;
  imageUrl?: string;
  restaurantId: string;
}): Promise<ProductPayload> {
  const response = await fetch('/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Init-Data': telegramInitData,
    },
    body: JSON.stringify({
      query: `
        mutation UpdateDish($input: UpdateDishInput!) {
          updateDish(input: $input) {
            success
            dish {
              id
              name
              price
            }
          }
        }
      `,
      variables: { input }
    }),
  });
  
  const result = await response.json();
  if (result.errors) {
    throw new Error(result.errors[0].message);
  }
  return result.data.updateDish;
}
```

#### Update Stock

```typescript
async function updateStock(dishId: string, quantity: number, restaurantId: string): Promise<StockPayload> {
  const response = await fetch('/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Init-Data': telegramInitData,
    },
    body: JSON.stringify({
      query: `
        mutation UpdateStock($input: UpdateStockInput!) {
          updateStock(input: $input) {
            success
            dishId
            quantity
          }
        }
      `,
      variables: { input: { dishId, quantity, restaurantId } }
    }),
  });
  
  const result = await response.json();
  if (result.errors) {
    throw new Error(result.errors[0].message);
  }
  return result.data.updateStock;
}
```

#### Update Store Description

```typescript
async function updateStoreDescription(
  restaurantId: string, 
  description: string
): Promise<StoreDescriptionPayload> {
  const response = await fetch('/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Init-Data': telegramInitData,
    },
    body: JSON.stringify({
      query: `
        mutation UpdateStoreDescription($input: UpdateStoreDescriptionInput!) {
          updateStoreDescription(input: $input) {
            success
            restaurantId
            description
          }
        }
      `,
      variables: { input: { restaurantId, description } }
    }),
  });
  
  const result = await response.json();
  if (result.errors) {
    throw new Error(result.errors[0].message);
  }
  return result.data.updateStoreDescription;
}
```

---

### Test as Superadmin

Set the X-Telegram-Init-Data header with user ID 198928952.

### Test as Non-Superadmin

Use any other valid Telegram user ID.

---

## Files Modified

| File | Changes |
|------|---------|
| `worker/schema.graphql` | Added new types and operations |
| `worker/src/contracts.ts` | Added TypeScript interfaces |
| `worker/src/auth.ts` | Added superadmin permission check |
| `worker/src/channelAdmin.ts` | New KV storage module |
| `worker/src/products.ts` | New product management module |
| `worker/src/resolvers.ts` | Added query/mutation resolvers |
| `worker/src/index.ts` | Added routing for new operations |

---

## Related Documentation

- [Telegram Auth Specs](../docs/specs/05-telegram-auth.md)
- [API Contract](../docs/specs/01-api-contract.md)