## Telegram Mini App — Food Ordering (Frontend)
**AI-Agent Implementation Spec (Markdown)**

### 1) Objective
Build a **Telegram Mini App (Telegram WebApp)** for ordering dishes from restaurants:
- **Restaurant selection** on main page
- After selecting a restaurant → **Categories** page
- Inside a category → **Dish list** where dishes can be added to a **single-restaurant cart**
- **Cart** page → **Checkout** → **Place order**
- **Checkout requires** either **geolocation** *or* a **Google Maps link** to a point
- **Frontend-only** deployed on **Cloudflare Pages**
- **Backend lives in a separate repo** and receives requests from this app

---

### 2) Hard Rules (Non-negotiable)
- **Single-restaurant cart**: cart items must belong to exactly **one restaurant**.
- **Switching restaurants** while cart has items from another restaurant:
  - Show a confirmation message:
    **“Your cart will be cleared and a new cart will be created for the selected restaurant.”**
  - Actions: **Cancel** / **Continue**
  - If **Continue** → clear cart completely → set new `restaurantId` → navigate into new restaurant.

---

### 3) Primary User Flows

#### Flow A — Place an order
1. Main (Restaurants) → select restaurant
2. Categories → select category
3. Dishes → add items to cart
4. Cart → adjust quantities → Checkout
5. Checkout → provide **(geo OR Google Maps link)** → Place order
6. Success screen → option to return to restaurants (cart cleared)

#### Flow B — Switch restaurant with active cart
1. User has cart items for Restaurant A
2. User returns to Restaurants and selects Restaurant B
3. App shows **cart-reset confirmation**
4. Continue → clear cart → open Restaurant B categories

---

### 4) Pages, Routes, Responsibilities

#### 4.1 Restaurants (Main)
- **Route**: `/`
- **Purpose**: list and select restaurants
- **UI**:
  - Search/filter (optional but recommended)
  - Restaurant cards: `name`, optional `image`, optional `tags`, optional `description`
- **Behavior**:
  - Select restaurant:
    - If cart empty OR same restaurant → go to Categories
    - Else → show cart-reset confirmation

#### 4.2 Categories (Selected restaurant)
- **Route**: `/restaurants/:restaurantId`
- **Purpose**: show categories for chosen restaurant
- **UI**:
  - Restaurant header (name)
  - Category list
  - Persistent cart access (badge count if items > 0)

#### 4.3 Dishes (Inside category)
- **Route**: `/restaurants/:restaurantId/categories/:categoryId`
- **Purpose**: show dishes, allow add/remove
- **Dish card MUST show**:
  - **name**
  - **description**
  - **picture**
- **Behavior**:
  - Add dish → quantity +1
  - Remove/decrement → quantity -1, remove item when 0

#### 4.4 Cart
- **Route**: `/cart`
- **Purpose**: review cart, edit quantities, proceed
- **UI**:
  - Restaurant name (cart owner)
  - Item list with quantity stepper
  - Totals section
  - Primary CTA: **Checkout**
- **Behavior**:
  - If cart empty → show empty state + link to restaurants

#### 4.5 Checkout
- **Route**: `/checkout`
- **Purpose**: collect delivery location and create order
- **Required delivery input (one of):**
  - **Geolocation** (lat/lng from browser/Telegram WebView)
  - **Google Maps link** to a point
- **Validation**:
  - Must provide exactly one method (or allow both but backend chooses one; preferred: enforce one)
  - Block “Place order” until valid
- **Submit**:
  - Create order via backend
  - On success: show confirmation (order id), clear cart
  - On failure: show error; keep cart

---

### 5) Data Model (Frontend State)

#### 5.1 Entities (normalized or direct lists)
- **Restaurant**
  - `id: string`
  - `name: string`
  - `description?: string`
  - `imageUrl?: string`
  - `tags?: string[]`

- **Category**
  - `id: string`
  - `restaurantId: string`
  - `name: string`
  - `description?: string`
  - `imageUrl?: string`

- **Dish**
  - `id: string`
  - `restaurantId: string`
  - `categoryId: string`
  - `name: string` (required)
  - `description: string` (required)
  - `imageUrl: string` (required)
  - `price: number`
  - `currency: string`

#### 5.2 Cart (single restaurant)
- **Cart**
  - `restaurantId: string`
  - `items: CartItem[]`
  - `updatedAt: string` (ISO)

- **CartItem**
  - `dishId: string`
  - `quantity: number (>=1)`
  - Snapshot fields (recommended for stable UI):
    - `name: string`
    - `price: number`
    - `currency: string`
    - `imageUrl?: string`
    - `description?: string`

#### 5.3 Persistence
- Persist cart in `localStorage` (or equivalent) to survive reloads.
- Clear cart:
  - After successful order
  - When user confirms restaurant switch

---

### 6) Backend Integration (Assumptions + Contract Shape)
Backend is authoritative for prices/availability/totals.

#### 6.1 Auth / Identity (Telegram WebApp)
- Frontend obtains Telegram WebApp init data and sends it to backend on each request.
- Recommended header: `X-Telegram-Init-Data: <initData>` (exact name can be adapted to backend).

#### 6.2 Minimal API endpoints (suggested)
- `GET /restaurants`
  - returns `Restaurant[]`
- `GET /restaurants/:restaurantId/categories`
  - returns `Category[]`
- `GET /restaurants/:restaurantId/categories/:categoryId/dishes`
  - returns `Dish[]`
- `POST /orders`
  - request body:

```json
{
  "restaurantId": "string",
  "items": [{ "dishId": "string", "quantity": 1 }],
  "deliveryLocation": { "lat": 0.0, "lng": 0.0 },
  "googleMapsUrl": null,
  "comment": "string or null"
}
```

Or (Google Maps link mode):

```json
{
  "restaurantId": "string",
  "items": [{ "dishId": "string", "quantity": 1 }],
  "deliveryLocation": null,
  "googleMapsUrl": "https://maps.google.com/?q=...",
  "comment": "string or null"
}
```

- response success:

```json
{ "orderId": "string", "status": "created" }
```

- response error:
  - `{ "message": "human readable", "code": "string" }`

---

### 7) UI/UX Requirements (Telegram-appropriate)
- Must work in Telegram in-app browser (mobile first).
- Respect Telegram theme (dark/light) if feasible.
- Provide clear back navigation (Telegram BackButton integration recommended).
- Clear, user-friendly error states: loading, empty, retry.

---

### 8) Validation & Edge Cases
- **Cart mismatch**: prevent adding dishes from a different restaurant without reset confirmation (should be impossible via routing, but enforce in cart logic too).
- **Dish image missing/broken**: show placeholder.
- **Checkout location**:
  - If geolocation denied/unavailable → user can paste Google Maps link.
  - Basic URL validation client-side; backend validates definitively.
- **Backend errors**:
  - Show message; allow retry; do not lose cart.

---

### 9) Observability (Frontend-side, minimal)
- Log key events (console in dev; optional remote logging later):
  - restaurant_selected
  - dish_added / dish_removed
  - cart_cleared_due_to_switch
  - checkout_submit / checkout_success / checkout_failure

---

### 10) Deployment: Cloudflare Pages (Frontend only)
- Build output is static assets served by Cloudflare Pages.
- Backend URL must be configurable:
  - `BACKEND_BASE_URL` (build-time environment variable)
- All backend calls must be HTTPS and CORS-compatible.

---

### 11) Acceptance Criteria (Definition of Done)
- Main page lists restaurants and allows selection.
- Selecting a restaurant navigates to categories.
- Selecting a category shows dish list where each dish has **name, description, picture** and can be added.
- Cart page exists, shows items, supports quantity changes, and leads to checkout.
- Cart contains items from **only one restaurant**; switching restaurants triggers confirmation and resets cart on confirm.
- Checkout requires **geolocation OR Google Maps link** and blocks submission otherwise.
- Order submission hits backend and shows success/failure; cart clears on success.
- App is deployable as a static frontend to Cloudflare Pages; backend is external.

