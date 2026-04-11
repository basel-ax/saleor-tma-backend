# GraphQL API Documentation for Frontend Developers

This document provides a complete reference for the Telegram Mini App GraphQL API. All endpoints require Telegram authentication via the `X-Telegram-Init-Data` header.

## Table of Contents

- [Base URL](#base-url)
- [Authentication](#authentication)
- [Queries](#queries)
  - [restaurants](#restaurants)
  - [restaurantCategories](#restaurantcategories)
  - [categoryDishes](#categorydishes)
  - [cart](#cart)
- [Mutations](#mutations)
  - [placeOrder](#placeorder)
  - [addToCart](#addtocart)
  - [updateCartItem](#updatecartitem)
  - [removeCartItem](#removecartitem)
  - [clearCart](#clearcart)
- [Type Definitions](#type-definitions)
- [Error Handling](#error-handling)
- [Example Requests](#example-requests)

---

## Base URL

```
Production: https://your-worker.subdomain.workers.dev/graphql
Development: http://localhost:8787/graphql
```

---

## Authentication

All GraphQL requests require authentication via the `X-Telegram-Init-Data` header.

### Header Format

```
X-Telegram-Init-Data: <telegram-init-data-string>
```

The init data is obtained from Telegram WebView via `window.Telegram.WebApp.initData`.

### Example (JavaScript)

```javascript
const query = `
  query {
    restaurants {
      id
      name
    }
  }
`;

const response = await fetch('/graphql', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Telegram-Init-Data': window.Telegram.WebApp.initData,
  },
  body: JSON.stringify({ query }),
});

const result = await response.json();
```

### Error Responses

| HTTP Status | Code | Description |
|-------------|------|-------------|
| 401 | `UNAUTHENTICATED` | Missing or invalid `X-Telegram-Init-Data` header |
| 403 | `FORBIDDEN` | Valid auth but user lacks required permissions |

---

## Queries

### restaurants

Get all available restaurants.

**Signature:**
```graphql
restaurants(search: String): [Restaurant!]!
```

**Response Type:** `Restaurant[]`

**Example Request:**
```graphql
query {
  restaurants {
    id
    name
    categories {
      id
      name
    }
  }
}
```

**Example Response:**
```json
{
  "data": {
    "restaurants": [
      {
        "id": "restA",
        "name": "Pizza Palace",
        "categories": [
          { "id": "catA", "name": "Pizza" },
          { "id": "catB", "name": "Drinks" }
        ]
      },
      {
        "id": "restB",
        "name": "Sushi House",
        "categories": []
      }
    ]
  }
}
```

---

### restaurantCategories

Get categories for a specific restaurant.

**Signature:**
```graphql
restaurantCategories(restaurantId: ID!): [Category!]!
```

**Arguments:**

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `restaurantId` | `ID!` | Yes | The restaurant ID |

**Example Request:**
```graphql
query {
  restaurantCategories(restaurantId: "restA") {
    id
    name
  }
}
```

**Example Response:**
```json
{
  "data": {
    "restaurantCategories": [
      { "id": "catA", "name": "Pizza" },
      { "id": "catB", "name": "Drinks" }
    ]
  }
}
```

---

### categoryDishes

Get dishes for a specific category within a restaurant.

**Signature:**
```graphql
categoryDishes(categoryId: ID!, restaurantId: ID!): [Dish!]!
```

**Arguments:**

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `categoryId` | `ID!` | Yes | The category ID |
| `restaurantId` | `ID!` | Yes | The restaurant ID |

**Example Request:**
```graphql
query {
  categoryDishes(categoryId: "catA", restaurantId: "restA") {
    id
    name
    description
    price
    currency
    imageUrl
  }
}
```

**Example Response:**
```json
{
  "data": {
    "categoryDishes": [
      {
        "id": "dish1",
        "name": "Margherita Pizza",
        "description": "Classic tomato and mozzarella",
        "price": 12.99,
        "currency": "USD",
        "imageUrl": "https://example.com/pizza.jpg"
      }
    ]
  }
}
```

---

### cart

Get the current user's shopping cart.

**Signature:**
```graphql
cart: Cart!
```

**Example Request:**
```graphql
query {
  cart {
    restaurantId
    items {
      dishId
      name
      quantity
      price
      currency
    }
    total
    itemCount
  }
}
```

**Example Response:**
```json
{
  "data": {
    "cart": {
      "restaurantId": "restA",
      "items": [
        {
          "dishId": "dish1",
          "name": "Margherita Pizza",
          "quantity": 2,
          "price": 12.99,
          "currency": "USD"
        }
      ],
      "total": 25.98,
      "itemCount": 2
    }
  }
}
```

---

## Mutations

### placeOrder

Place an order with items from the cart or provided items.

**Signature:**
```graphql
placeOrder(input: PlaceOrderInput!): PlaceOrderPayload!
```

**Arguments:**

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `input` | `PlaceOrderInput!` | Yes | Order details |

**PlaceOrderInput:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `restaurantId` | `ID!` | Yes | The restaurant ID |
| `deliveryLocation` | `DeliveryLocationInput!` | Yes | Delivery address |
| `items` | `[OrderItemInput!]!` | No* | Order items (uses cart if not provided) |
| `customerNote` | `String` | No | Special instructions |

*If `items` is not provided, the cart contents will be used.

**OrderItemInput:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `dishId` | `ID!` | Yes | The dish ID |
| `quantity` | `Int!` | Yes | Quantity |
| `notes` | `String` | No | Special instructions for item |

**DeliveryLocationInput:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `address` | `String!` | Yes | Street address |
| `city` | `String` | No | City |
| `country` | `String` | No | Country |
| `latitude` | `Float` | No | GPS latitude |
| `longitude` | `Float` | No | GPS longitude |

**Example Request:**
```graphql
mutation {
  placeOrder(input: {
    restaurantId: "restA"
    deliveryLocation: {
      address: "123 Main Street"
      city: "New York"
      country: "USA"
      latitude: 40.7128
      longitude: -74.006
    }
    customerNote: "Please ring the doorbell"
  }) {
    orderId
    status
    estimatedDelivery
  }
}
```

**Example Response:**
```json
{
  "data": {
    "placeOrder": {
      "orderId": "order_1234567890_user123",
      "status": "CREATED",
      "estimatedDelivery": "2024-01-15T14:30:00Z"
    }
  }
}
```

**Error Codes:**

| Code | Description |
|------|-------------|
| `MISSING_RESTAURANT` | Restaurant ID is required |
| `EMPTY_ORDER` | Cart is empty or no items provided |
| `MISSING_ADDRESS` | Delivery address is required |
| `ORDER_CREATE_FAILED` | Failed to create order in backend |

---

### addToCart

Add an item to the shopping cart. If the restaurant changes, the cart is cleared first.

**Signature:**
```graphql
addToCart(input: AddToCartInput!): Cart!
```

**Arguments:**

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `input` | `AddToCartInput!` | Yes | Item details |

**AddToCartInput:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `dishId` | `ID!` | Yes | The dish ID |
| `quantity` | `Int!` | Yes | Quantity |
| `name` | `String` | No | Dish name |
| `price` | `Float` | No | Dish price |
| `currency` | `String` | No | Currency code |
| `restaurantId` | `ID!` | Yes | The restaurant ID |

**Example Request:**
```graphql
mutation {
  addToCart(input: {
    dishId: "dish1"
    quantity: 2
    name: "Margherita Pizza"
    price: 12.99
    currency: "USD"
    restaurantId: "restA"
  }) {
    restaurantId
    items {
      dishId
      name
      quantity
      price
    }
    total
    itemCount
  }
}
```

**Example Response:**
```json
{
  "data": {
    "addToCart": {
      "restaurantId": "restA",
      "items": [
        {
          "dishId": "dish1",
          "name": "Margherita Pizza",
          "quantity": 2,
          "price": 12.99
        }
      ],
      "total": 25.98,
      "itemCount": 2
    }
  }
}
```

---

### updateCartItem

Update the quantity of an item in the cart. Set quantity to 0 to remove the item.

**Signature:**
```graphql
updateCartItem(input: UpdateCartItemInput!): Cart!
```

**Arguments:**

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `input` | `UpdateCartItemInput!` | Yes | Update details |

**UpdateCartItemInput:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `dishId` | `ID!` | Yes | The dish ID |
| `quantity` | `Int!` | Yes | New quantity (0 to remove) |

**Example Request:**
```graphql
mutation {
  updateCartItem(input: {
    dishId: "dish1"
    quantity: 3
  }) {
    restaurantId
    items {
      dishId
      quantity
    }
    total
    itemCount
  }
}
```

**Example Response:**
```json
{
  "data": {
    "updateCartItem": {
      "restaurantId": "restA",
      "items": [
        { "dishId": "dish1", "quantity": 3 }
      ],
      "total": 38.97,
      "itemCount": 3
    }
  }
}
```

---

### removeCartItem

Remove an item from the cart.

**Signature:**
```graphql
removeCartItem(dishId: ID!): Cart!
```

**Arguments:**

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `dishId` | `ID!` | Yes | The dish ID to remove |

**Example Request:**
```graphql
mutation {
  removeCartItem(dishId: "dish1") {
    restaurantId
    items {
      dishId
    }
    total
    itemCount
  }
}
```

**Example Response:**
```json
{
  "data": {
    "removeCartItem": {
      "restaurantId": "restA",
      "items": [],
      "total": 0,
      "itemCount": 0
    }
  }
}
```

---

### clearCart

Clear all items from the cart.

**Signature:**
```graphql
clearCart: Cart!
```

**Example Request:**
```graphql
mutation {
  clearCart {
    restaurantId
    items {
      dishId
    }
    total
    itemCount
  }
}
```

**Example Response:**
```json
{
  "data": {
    "clearCart": {
      "restaurantId": null,
      "items": [],
      "total": 0,
      "itemCount": 0
    }
  }
}
```

---

## Type Definitions

### Restaurant

```graphql
type Restaurant {
  id: ID!
  name: String!
  categories: [Category!]!
  deliveryLocations: [DeliveryLocation!]!
}
```

### Category

```graphql
type Category {
  id: ID!
  name: String!
}
```

### Dish

```graphql
type Dish {
  id: ID!
  name: String!
  description: String!
  price: Float!
  currency: String!
  categoryId: ID!
  imageUrl: String!
}
```

### Cart

```graphql
type Cart {
  restaurantId: ID
  items: [CartItem!]!
  total: Float!
  itemCount: Int!
}
```

### CartItem

```graphql
type CartItem {
  dishId: ID!
  quantity: Int!
  name: String
  price: Float
  currency: String
  description: String
  imageUrl: String
}
```

### DeliveryLocation

```graphql
type DeliveryLocation {
  id: ID!
  address: String!
  city: String
  country: String
  latitude: Float
  longitude: Float
}
```

### PlaceOrderPayload

```graphql
type PlaceOrderPayload {
  orderId: ID!
  status: String!
  estimatedDelivery: String
}
```

---

## Error Handling

All GraphQL responses that encounter errors return an `errors` array.

### Error Response Format

```json
{
  "errors": [
    {
      "message": "Human-readable error description",
      "code": "ERROR_CODE",
      "field": "optional_field_name",
      "internalId": "optional_internal_trace_id"
    }
  ]
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHENTICATED` | 401 | Missing or invalid `X-Telegram-Init-Data` header |
| `FORBIDDEN` | 403 | User lacks required permissions |
| `BAD_USER_INPUT` | 400 | Invalid input - check `field` for details |
| `NOT_FOUND` | 404 | Requested resource not found |
| `INTERNAL_ERROR` | 500 | Server error - check `internalId` for support |

### Handling Errors in Client Code

```javascript
async function graphqlRequest(query, variables = {}) {
  const response = await fetch('/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Init-Data': window.Telegram.WebApp.initData,
    },
    body: JSON.stringify({ query, variables }),
  });

  const result = await response.json();

  if (result.errors) {
    const error = result.errors[0];
    
    switch (error.code) {
      case 'UNAUTHENTICATED':
        // Prompt user to refresh or re-authenticate
        window.Telegram.WebApp.showAlert('Please refresh the page');
        break;
      case 'FORBIDDEN':
        window.Telegram.WebApp.showAlert('Access denied');
        break;
      case 'BAD_USER_INPUT':
        // Highlight the problematic field
        console.error(`Invalid input: ${error.field} - ${error.message}`);
        window.Telegram.WebApp.showAlert(error.message);
        break;
      case 'NOT_FOUND':
        window.Telegram.WebApp.showAlert('Item not found');
        break;
      default:
        window.Telegram.WebApp.showAlert('Something went wrong');
    }
    
    throw new Error(error.message);
  }

  return result.data;
}
```

---

## Example Requests

### Full Shopping Flow

```javascript
// 1. Fetch restaurants
const restaurantsQuery = `
  query {
    restaurants {
      id
      name
    }
  }
`;

// 2. Fetch categories for a restaurant
const categoriesQuery = `
  query($restaurantId: ID!) {
    restaurantCategories(restaurantId: $restaurantId) {
      id
      name
    }
  }
`;

// 3. Fetch dishes for a category
const dishesQuery = `
  query($categoryId: ID!, $restaurantId: ID!) {
    categoryDishes(categoryId: $categoryId, restaurantId: $restaurantId) {
      id
      name
      description
      price
      currency
      imageUrl
    }
  }
`;

// 4. Add item to cart
const addToCartMutation = `
  mutation($input: AddToCartInput!) {
    addToCart(input: $input) {
      restaurantId
      items { dishId quantity }
      total
      itemCount
    }
  }
`;

// 5. View cart
const cartQuery = `
  query {
    cart {
      restaurantId
      items { dishId name quantity price }
      total
      itemCount
    }
  }
`;

// 6. Place order
const placeOrderMutation = `
  mutation($input: PlaceOrderInput!) {
    placeOrder(input: $input) {
      orderId
      status
      estimatedDelivery
    }
  }
`;
```

---

## Notes

1. **Cart Behavior**: Changing restaurants clears the cart to prevent mixing items from different restaurants.

2. **Authentication**: All requests must include valid Telegram init data. If the data expires, the frontend should refresh it via `window.Telegram.WebApp.initData`.

3. **IDs**: Restaurant, category, and dish IDs come from the Saleor backend. Use the IDs returned from query responses for subsequent requests.

4. **Prices**: All prices include currency code. Display currency accordingly.