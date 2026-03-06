# GraphQL Contract Tests

## Overview
This file defines contract tests for the Telegram TMA GraphQL API.
Tests are run using spec-kit against the GraphQL endpoint.

## Prerequisites
- GraphQL worker running at http://localhost:8787 (wrangler dev)
- All requests must include X-Telegram-Init-Data header

## Test Data
- Restaurant A: restA (Pizza Place)
  - Category: catA (Pizzas)
    - dishA1: Margherita Pizza ($9.50)
    - dishA2: Pepperoni Pizza ($11.00)
- Restaurant B: restB (Sushi House)
  - Category: catB (Nigiri)
    - dishB1: Salmon Nigiri ($2.50)

## Tests

### Test 1: Query Restaurants
**Description:** Query all restaurants returns 200 and non-empty list

**Request:**
```graphql
query Restaurants {
  restaurants {
    id
    name
  }
}
```

**Expected Response:**
```json
{
  "data": {
    "restaurants": [
      { "id": "rest1", "name": "Pizza Hub" },
      { "id": "rest2", "name": "Sushi Lane" }
    ]
  }
}
```

**Headers:**
- X-Telegram-Init-Data: auth_date=1700000000&hash=test_hash&user={"id":"123456789","first_name":"Test","last_name":"User","language_code":"en"}

---

### Test 2: Query Restaurant Categories
**Description:** Query categories for a valid restaurant

**Request:**
```graphql
query RestaurantCategories($restaurantId: ID!) {
  restaurantCategories(restaurantId: $restaurantId) {
    id
    name
  }
}
```

**Variables:**
```json
{
  "restaurantId": "rest1"
}
```

**Expected Response:**
```json
{
  "data": {
    "restaurantCategories": [
      { "id": "cat1", "name": "Pizzas" },
      { "id": "cat2", "name": "Nigiri" }
    ]
  }
}
```

---

### Test 3: Query Category Dishes
**Description:** Query dishes for a category

**Request:**
```graphql
query CategoryDishes($categoryId: ID!) {
  categoryDishes(categoryId: $categoryId) {
    id
    name
    price
    categoryId
  }
}
```

**Variables:**
```json
{
  "categoryId": "cat1"
}
```

**Expected Response:**
```json
{
  "data": {
    "categoryDishes": [
      { "id": "dish1", "name": "Margherita", "price": 9.5, "categoryId": "cat1" },
      { "id": "dish2", "name": "Pepperoni", "price": 11.0, "categoryId": "cat1" }
    ]
  }
}
```

---

### Test 4: Place Order with Delivery Location
**Description:** Place an order with lat/lng delivery location

**Request:**
```graphql
mutation PlaceOrder($input: PlaceOrderInput!) {
  placeOrder(input: $input) {
    orderId
    status
    estimatedDelivery
  }
}
```

**Variables:**
```json
{
  "input": {
    "restaurantId": "rest1",
    "items": [
      { "dishId": "dish1", "quantity": 2 }
    ],
    "deliveryLocation": {
      "address": "123 Main St",
      "city": "New York",
      "country": "US",
      "latitude": 40.7128,
      "longitude": -74.006
    },
    "customerNote": "Leave at door"
  }
}
```

**Expected Response:**
```json
{
  "data": {
    "placeOrder": {
      "orderId": "order-123",
      "status": "CREATED",
      "estimatedDelivery": "2024-01-01T12:00:00Z"
    }
  }
}
```

---

### Test 5: Place Order with Google Maps URL
**Description:** Place an order with Google Maps URL for delivery

**Request:**
```graphql
mutation PlaceOrder($input: PlaceOrderInput!) {
  placeOrder(input: $input) {
    orderId
    status
  }
}
```

**Variables:**
```json
{
  "input": {
    "restaurantId": "rest1",
    "items": [
      { "dishId": "dish1", "quantity": 1 }
    ],
    "deliveryLocation": {
      "address": "123 Main St",
      "latitude": 40.7128,
      "longitude": -74.006
    }
  }
}
```

**Expected Response:**
```json
{
  "data": {
    "placeOrder": {
      "orderId": "order-456",
      "status": "CREATED"
    }
  }
}
```

---

### Test 6: Cart - Add Item
**Description:** Add item to cart

**Request:**
```graphql
mutation AddToCart($input: AddToCartInput!) {
  addToCart(input: $input) {
    restaurantId
    items {
      dishId
      quantity
      name
      price
    }
    total
    itemCount
  }
}
```

**Variables:**
```json
{
  "input": {
    "dishId": "dish1",
    "quantity": 2,
    "name": "Margherita",
    "price": 9.5,
    "currency": "USD",
    "restaurantId": "rest1"
  }
}
```

**Expected Response:**
```json
{
  "data": {
    "addToCart": {
      "restaurantId": "rest1",
      "items": [
        { "dishId": "dish1", "quantity": 2, "name": "Margherita", "price": 9.5 }
      ],
      "total": 19.0,
      "itemCount": 2
    }
  }
}
```

---

### Test 7: Cart - Get Cart
**Description:** Get current user's cart

**Request:**
```graphql
query Cart {
  cart {
    restaurantId
    items {
      dishId
      quantity
      name
      price
      currency
    }
    total
    itemCount
  }
}
```

**Expected Response:**
```json
{
  "data": {
    "cart": {
      "restaurantId": "rest1",
      "items": [],
      "total": 0,
      "itemCount": 0
    }
  }
}
```

---

### Test 8: Invalid Input - Missing Restaurant
**Description:** Place order without restaurant ID returns helpful error

**Request:**
```graphql
mutation PlaceOrder($input: PlaceOrderInput!) {
  placeOrder(input: $input) {
    orderId
    status
  }
}
```

**Variables:**
```json
{
  "input": {
    "items": [
      { "dishId": "dish1", "quantity": 1 }
    ],
    "deliveryLocation": {
      "address": "123 Main St"
    }
  }
}
```

**Expected Response:**
```json
{
  "errors": [
    { "message": "Restaurant is required" }
  ]
}
```

---

### Test 9: Invalid Input - Empty Cart
**Description:** Place order with empty cart returns helpful error

**Request:**
```graphql
mutation PlaceOrder($input: PlaceOrderInput!) {
  placeOrder(input: $input) {
    orderId
    status
  }
}
```

**Variables:**
```json
{
  "input": {
    "restaurantId": "rest1",
    "items": [],
    "deliveryLocation": {
      "address": "123 Main St"
    }
  }
}
```

**Expected Response:**
```json
{
  "errors": [
    { "message": "Cart is empty. Add items to your cart before placing an order." }
  ]
}
```

---

### Test 10: Invalid Input - Missing Address
**Description:** Place order without delivery address returns helpful error

**Request:**
```graphql
mutation PlaceOrder($input: PlaceOrderInput!) {
  placeOrder(input: $input) {
    orderId
    status
  }
}
```

**Variables:**
```json
{
  "input": {
    "restaurantId": "rest1",
    "items": [
      { "dishId": "dish1", "quantity": 1 }
    ]
  }
}
```

**Expected Response:**
```json
{
  "errors": [
    { "message": "Delivery address is required" }
  ]
}
```

---

### Test 11: Authentication - Missing Header
**Description:** Request without X-Telegram-Init-Data returns 401

**Request:**
```graphql
query Restaurants {
  restaurants {
    id
    name
  }
}
```

**Expected Response:**
```json
{
  "errors": [
    { "message": "Missing X-Telegram-Init-Data header" }
  ]
}
```

---

### Test 12: Authentication - Invalid Init Data
**Description:** Request with invalid init data returns error

**Headers:**
- X-Telegram-Init-Data: invalid_data

**Request:**
```graphql
query Restaurants {
  restaurants {
    id
    name
  }
}
```

**Expected Response:**
```json
{
  "errors": [
    { "message": "Invalid init data: missing required fields (hash, auth_date)" }
  ]
}
```

---

### Test 13: Cart - Clear Cart
**Description:** Clear entire cart

**Request:**
```graphql
mutation ClearCart {
  clearCart {
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

**Expected Response:**
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

### Test 14: Cart - Update Item Quantity
**Description:** Update quantity of cart item

**Request:**
```graphql
mutation UpdateCartItem($input: UpdateCartItemInput!) {
  updateCartItem(input: $input) {
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

**Variables:**
```json
{
  "input": {
    "dishId": "dish1",
    "quantity": 3
  }
}
```

**Expected Response:**
```json
{
  "data": {
    "updateCartItem": {
      "restaurantId": "rest1",
      "items": [
        { "dishId": "dish1", "quantity": 3 }
      ],
      "total": 28.5,
      "itemCount": 3
    }
  }
}
```

---

### Test 15: Cart - Remove Item
**Description:** Remove item from cart

**Request:**
```graphql
mutation RemoveCartItem($dishId: ID!) {
  removeCartItem(dishId: $dishId) {
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

**Variables:**
```json
{
  "dishId": "dish1"
}
```

**Expected Response:**
```json
{
  "data": {
    "removeCartItem": {
      "restaurantId": "rest1",
      "items": [],
      "total": 0,
      "itemCount": 0
    }
  }
}
```
