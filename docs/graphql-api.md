### GraphQL API — Telegram Mini App BFF

This document describes the **public GraphQL API** of the Go backend-for-frontend (BFF) used by the **Telegram Mini App food ordering UI**. It is written in a form suitable for **AI agents** that need to call or reason about this API.

The API assumes:

- Every HTTP request includes a valid **Telegram WebApp init data** header:
  - `X-Telegram-Init-Data: <initData>`
- The backend is able to reach the **Saleor GraphQL API** configured via environment / config file.

---

### Authentication and headers

- **Transport**: HTTP(S) POST to `/query`
- **Content-Type**: `application/json`
- **Required header**:

  - `X-Telegram-Init-Data: <full Telegram WebApp initData string>`

- If this header is missing or invalid:
  - All operations respond with **401 Unauthorized** (error `unauthenticated`).

---

### Schema overview

Top-level types:

- **Queries**
  - `restaurants(search: String): [Restaurant!]!`
  - `restaurantCategories(restaurantId: ID!): [Category!]!`
  - `categoryDishes(restaurantId: ID!, categoryId: ID!): [Dish!]!`
- **Mutations**
  - `placeOrder(input: PlaceOrderInput!): PlaceOrderPayload!`

Supporting types:

- `Restaurant`
- `Category`
- `Dish`
- `Money`
- `CartItemInput`
- `DeliveryLocationInput`
- `PlaceOrderInput`
- `PlaceOrderPayload`

---

### Types

#### `type Money`

```graphql
type Money {
  amount: Float!
  currency: String!
}
```

Represents a monetary amount in a given currency. Backed by Saleor `TaxedMoney.gross`.

---

#### `type Restaurant`

```graphql
type Restaurant {
  id: ID!
  name: String!
  description: String
  imageUrl: String
  tags: [String!]!
}
```

Represents a restaurant in the mini app. Under the hood this is backed by a **Saleor Category**.

Field mapping:

- `id` – category ID from Saleor
- `name` – category `name`
- `description` – category `description`
- `imageUrl` – category `backgroundImage.url` (if available)
- `tags` – parsed from category metadata key `tma_tags`

Tags can be either a **comma-separated string** or a **JSON array of strings** in metadata.

---

#### `type Category`

```graphql
type Category {
  id: ID!
  restaurantId: ID!
  name: String!
  description: String
  imageUrl: String
}
```

Represents a dish category within a particular restaurant. Backed by a **child Saleor Category** of the restaurant’s category.

Field mapping:

- `id` – category ID
- `restaurantId` – parent category (restaurant) ID
- `name` – category `name`
- `description` – category `description`
- `imageUrl` – category `backgroundImage.url`

---

#### `type Dish`

```graphql
"""
A dish is represented by a Saleor ProductVariant (the `id` field).
"""
type Dish {
  id: ID!
  productId: ID!
  restaurantId: ID!
  categoryId: ID!
  name: String!
  description: String!
  imageUrl: String!
  price: Money!
}
```

Represents an orderable dish. Backed by:

- Saleor **Product** (for `name`, `description`, `thumbnail`)
- Product’s **first `ProductVariant`** (for `id` and pricing)

Field mapping:

- `id` – variant ID in Saleor (used when placing orders)
- `productId` – product ID in Saleor
- `restaurantId` – parent restaurant (category) ID
- `categoryId` – dish category ID within the restaurant
- `name` – product `name`
- `description` – product `description`
- `imageUrl` – product `thumbnail.url` (size ~512)
- `price` – first variant’s `pricing.price.gross`

---

#### Input and payload types

```graphql
input CartItemInput {
  dishId: ID!
  quantity: Int!
}

input DeliveryLocationInput {
  lat: Float!
  lng: Float!
}

input PlaceOrderInput {
  restaurantId: ID!
  items: [CartItemInput!]!
  deliveryLocation: DeliveryLocationInput
  googleMapsUrl: String
  comment: String
}

type PlaceOrderPayload {
  orderId: ID!
  status: String!
}
```

Semantics:

- `CartItemInput`
  - `dishId` – ID of the `Dish` (Saleor variant ID)
  - `quantity` – must be ≥ 1

- `PlaceOrderInput`
  - `restaurantId` – the restaurant for which the cart applies
  - `items` – list of dishes and quantities
  - `deliveryLocation` **XOR** `googleMapsUrl`
    - Exactly one of these must be provided
  - `comment` – free-form text, stored as Saleor `customerNote` on the order

- `PlaceOrderPayload`
  - `orderId` – Saleor order ID (result of `draftOrderComplete`)
  - `status` – Saleor order status string

---

### Queries

#### `restaurants(search: String): [Restaurant!]!`

**Purpose**

- Populates the **main Restaurants screen** in the Telegram Mini App.

**Behavior**

- If `tma.restaurantRootCategoryId` is configured:
  - Treat that category’s **children** as restaurants.
- Otherwise:
  - Treat all **top-level categories** (level `0`) as restaurants.
- If `search` is provided, it is passed to Saleor’s `CategoryFilterInput.search`.

**Example query**

```graphql
query Restaurants($search: String) {
  restaurants(search: $search) {
    id
    name
    description
    imageUrl
    tags
  }
}
```

**Example variables**

```json
{ "search": "pizza" }
```

---

#### `restaurantCategories(restaurantId: ID!): [Category!]!`

**Purpose**

- Populates the **Categories view** after selecting a restaurant.

**Behavior**

- Finds the Saleor category by `restaurantId`
- Returns its **direct children** as dish categories

**Example query**

```graphql
query RestaurantCategories($id: ID!) {
  restaurantCategories(restaurantId: $id) {
    id
    restaurantId
    name
    description
    imageUrl
  }
}
```

**Example variables**

```json
{ "id": "UmVzdGF1cmFudENhdGVnb3J5OjE=" }
```

---

#### `categoryDishes(restaurantId: ID!, categoryId: ID!): [Dish!]!`

**Purpose**

- Populates the **Dishes view** inside a selected category.

**Behavior**

- Validates that `categoryId` is a child of `restaurantId`
- Uses Saleor `products` query with:
  - `channel` set to configured channel slug
  - `filter.categories` containing `categoryId`
- Converts the first variant of each product into a `Dish`

**Example query**

```graphql
query CategoryDishes($restaurantId: ID!, $categoryId: ID!) {
  categoryDishes(restaurantId: $restaurantId, categoryId: $categoryId) {
    id
    productId
    restaurantId
    categoryId
    name
    description
    imageUrl
    price {
      amount
      currency
    }
  }
}
```

**Example variables**

```json
{
  "restaurantId": "UmVzdGF1cmFudENhdGVnb3J5OjE=",
  "categoryId": "Q2F0ZWdvcnk6Mw=="
}
```

---

### Mutation

#### `placeOrder(input: PlaceOrderInput!): PlaceOrderPayload!`

**Purpose**

- Creates an order in Saleor based on the current cart and checkout input.
- Used on the **Checkout screen** when the user taps “Place order”.

**Validation rules**

- `restaurantId` must be non-empty
- `items` must be non-empty
- Each `items[i].quantity` must be ≥ 1
- Exactly **one** of:
  - `deliveryLocation` (lat/lng)
  - `googleMapsUrl` (non-empty URL string)
- If validation fails, the resolver returns a user-visible error and does **not** call Saleor.

**Processing steps (Saleor interactions)**

1. **Authenticate Telegram user**
   - From `X-Telegram-Init-Data` in HTTP headers.
   - Unauthenticated requests are rejected before this mutation runs.

2. **Create draft order**

   - Calls Saleor `draftOrderCreate(input: DraftOrderCreateInput!)` with:
     - `channelId` – taken from BFF config
     - `userEmail` – synthetic email: `tg-<telegramUserId>@tma.local`
     - `customerNote` – from `input.comment`
     - `metadata` – includes:
       - `tma.telegramUserId`
       - `tma.restaurantId`
       - Either:
         - `tma.delivery.lat`, `tma.delivery.lng` **or**
         - `tma.delivery.googleMapsUrl`

3. **Add order lines**

   - Calls `orderLinesCreate(id: ID!, input: [OrderLineCreateInput!]!)` with:
     - `id` – draft order ID
     - `input` – for each `CartItemInput`:
       - `variantId` – `dishId`
       - `quantity`

4. **Complete draft order**

   - Calls `draftOrderComplete(id: ID!)`
   - Reads final order `id` and `status`

5. **Return payload**

   - `orderId` – Saleor order ID
   - `status` – Saleor order status string (e.g. `"UNCONFIRMED"`, `"UNFULFILLED"`)

**Example mutation**

```graphql
mutation PlaceOrder($input: PlaceOrderInput!) {
  placeOrder(input: $input) {
    orderId
    status
  }
}
```

**Example variables (geolocation mode)**

```json
{
  "input": {
    "restaurantId": "UmVzdGF1cmFudENhdGVnb3J5OjE=",
    "items": [
      { "dishId": "UHJvZHVjdFZhcmlhbnQ6MQ==", "quantity": 2 },
      { "dishId": "UHJvZHVjdFZhcmlhbnQ6NA==", "quantity": 1 }
    ],
    "deliveryLocation": { "lat": 52.520008, "lng": 13.404954 },
    "googleMapsUrl": null,
    "comment": "Buzzer 12, phone 1234567"
  }
}
```

**Example variables (Google Maps URL mode)**

```json
{
  "input": {
    "restaurantId": "UmVzdGF1cmFudENhdGVnb3J5OjE=",
    "items": [
      { "dishId": "UHJvZHVjdFZhcmlhbnQ6MQ==", "quantity": 1 }
    ],
    "deliveryLocation": null,
    "googleMapsUrl": "https://maps.google.com/?q=52.520008,13.404954",
    "comment": "Leave at reception"
  }
}
```

---

### Error handling

- GraphQL errors follow standard conventions:
  - HTTP status is usually **200** even when there is a logical error.
  - `errors` array in the response describes failures.

Common error categories:

- **Authentication**
  - Missing or invalid `X-Telegram-Init-Data`
  - Returned as GraphQL error with message `"unauthenticated"` (401 at HTTP layer).

- **Validation**
  - Wrong or missing fields in `PlaceOrderInput`
  - Returned as GraphQL errors with descriptive messages (e.g. “items must not be empty”, “provide exactly one of deliveryLocation or googleMapsUrl”).

- **Saleor errors**
  - Underlying `draftOrderCreate`, `orderLinesCreate`, or `draftOrderComplete` errors
  - Propagated as user-readable messages from Saleor’s error payload (first error in the list).

AI agents should:

- Inspect the `errors` array
- Surface the human-readable `message` to the user
- Allow safe retries (for temporary issues)

---

### Mapping to Telegram Mini App flows

**Flow A — Place an order**

1. **Main (Restaurants)** → `restaurants(search)`
2. **Categories** → `restaurantCategories(restaurantId)`
3. **Dishes** → `categoryDishes(restaurantId, categoryId)`
4. **Cart** → client-side state only
5. **Checkout** → `placeOrder(input)`

**Flow B — Switch restaurant with active cart**

- Entirely **frontend-managed**:
  - The BFF does **not** persist cart state.
  - The frontend enforces **single-restaurant cart** rules and confirmation dialog.

---

### Usage guidelines for AI agents

- Always include `X-Telegram-Init-Data` when constructing HTTP requests.
- Use **ID values returned from the API as-is** (opaque; they are Saleor’s global GraphQL IDs).
- Maintain cart state **client-side** and only send it once at `placeOrder`.
- Respect validation rules around `deliveryLocation` vs `googleMapsUrl`.
- For restaurant filtering, pass a human-entered search term to `restaurants(search: String)`.

