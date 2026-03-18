# Project Specification: Telegram Mini App Food Ordering Backend

**Version:** 1.0  
**Status:** Consolidated from specs/ directory  
**Date:** 2026-03-17

---

## 1. Feature Description

### WHAT Users Need

Telegram Mini App users need a streamlined food ordering experience that allows them to:
- Browse restaurants and discover food options within Telegram
- View menus organized by categories
- Build an order by selecting dishes and specifying delivery details
- Place orders directly from the app without leaving Telegram

### WHY Users Need This

Users want a convenient, fast way to order food from local restaurants through a familiar interface (Telegram). The integration eliminates the need to switch between apps or use external websites, reducing friction in the ordering process. By embedding the ordering experience in Telegram, users benefit from:
- Single sign-on via Telegram authentication
- Familiar UI/UX with native feel
- Real-time order tracking through the same channel

---

## 2. User Scenarios

### Scenario 1: Browse and Select Restaurant

**Given** a user has opened the Telegram Mini App  
**When** the user views the list of available restaurants  
**Then** the user should see restaurant names, descriptions, and images  
**And** the user should be able to search restaurants by keyword  

**Acceptance Criteria:**
- [ ] Restaurant list displays with name, description, and image
- [ ] Search returns relevant results based on keyword matching

---

### Scenario 2: Browse Menu Categories

**Given** a user has selected a restaurant  
**When** the user views the menu categories for that restaurant  
**Then** the user should see all available categories (e.g., Appetizers, Main Course, Drinks)  
**And** each category should display a name and optional image  

**Acceptance Criteria:**
- [ ] Categories are displayed for the selected restaurant
- [ ] Each category shows name and image (if available)

---

### Scenario 3: View Dishes in Category

**Given** a user has selected a category within a restaurant  
**When** the user views the dishes in that category  
**Then** the user should see dish names, descriptions, prices, and images  

**Acceptance Criteria:**
- [ ] Dishes display with name, description, price, currency, and image
- [ ] Prices are clearly visible and formatted appropriately

---

### Scenario 4: Build Cart and Place Order

**Given** a user has selected dishes from a restaurant  
**When** the user reviews their cart and confirms the order  
**Then** the order should be created with the selected items  
**And** the user should receive an order confirmation with order ID  

**Acceptance Criteria:**
- [ ] User can add multiple dishes to cart with quantities
- [ ] Order includes delivery location (coordinates or Google Maps URL)
- [ ] Optional order comment is captured
- [ ] Order ID and status are returned after successful placement

---

### Scenario 5: Switch Restaurant with Active Cart

**Given** a user has items in their cart from one restaurant  
**When** the user attempts to select a different restaurant  
**Then** the user should be prompted to confirm cart reset  
**And** if confirmed, the cart should be cleared and the new restaurant selected  

**Acceptance Criteria:**
- [ ] System detects cart mismatch when switching restaurants
- [ ] User is prompted with clear choice to continue or cancel
- [ ] Cart is cleared upon confirmation and new restaurant becomes active

---

### Scenario 6: Authenticated Access Only

**Given** a user attempts to access the ordering system  
**When** the user makes a request without valid Telegram authentication  
**Then** the request should be rejected with an appropriate error  

**Acceptance Criteria:**
- [ ] Requests without authentication receive 401 error
- [ ] Requests with invalid/expired authentication receive 401 error
- [ ] Authenticated requests proceed to normal processing

---

## 3. Functional Requirements

### FR-001: Restaurant Discovery
The system MUST provide the ability to retrieve a list of restaurants with optional search filtering by keyword.

### FR-002: Category Navigation
The system MUST provide the ability to retrieve menu categories for a specific restaurant.

### FR-003: Dish Listing
The system MUST provide the ability to retrieve dishes within a specific category for a specific restaurant.

### FR-004: Cart Management
The system MUST maintain a shopping cart per user session that stores selected dishes and quantities.

### FR-005: Order Placement
The system MUST allow users to place an order with:
- Selected dishes and quantities
- Delivery location (coordinates or Google Maps URL)
- Optional comment

### FR-006: Order Confirmation
The system MUST return a unique order identifier and status after successful order placement.

### FR-007: Restaurant Switch Handling
The system MUST detect when a user with an active cart attempts to switch restaurants and SHOULD prompt for confirmation before clearing the cart.

### FR-008: Authentication Enforcement
The system MUST reject all requests without valid Telegram Init Data authentication and MUST return a 401 error.

### FR-009: Input Validation
The system MUST validate all user inputs and MUST return descriptive error messages for invalid requests without losing cart state.

### FR-010: Error Response Format
The system MUST return errors in a consistent format with error codes and human-readable messages.

### FR-011: Backend Integration
The system MUST integrate with the underlying order management backend to create orders and retrieve menu data.

---

## 4. Success Criteria

### SC-001: Restaurant Query Success
When valid restaurant data exists, the query MUST return a non-empty list with complete restaurant information (name, description, image).

### SC-002: Category Query Success
When a valid restaurant ID is provided, the query MUST return all associated categories.

### SC-003: Dish Query Success
When valid restaurant and category IDs are provided, the query MUST return all associated dishes with pricing information.

### SC-004: Order Placement Success
When all required order information is provided and authentication is valid, the mutation MUST return an order ID and status of "created".

### SC-005: Cart Switch Confirmation
When a user with an active cart selects a different restaurant, the system MUST present a confirmation dialog before allowing the switch.

### SC-006: Invalid Input Handling
When invalid input is provided to placeOrder, the system MUST return a 400 error with a descriptive message.

### SC-007: Backend Error Handling
When the backend service returns an error, the system MUST return a 500 error with diagnostic information to the client.

### SC-008: Authentication Rejection
When a request lacks valid authentication, the system MUST return a 401 error before processing any GraphQL operations.

---

## 5. Key Entities

- **Restaurant** — A food establishment offering items for order
- **Category** — A menu section within a restaurant (e.g., Appetizers, Mains)
- **Dish** — An individual food item available for ordering with a price
- **Cart** — A collection of selected dishes with quantities for a single order
- **Order** — A placed request for delivery with items, location, and status
- **User** — A Telegram user identified by their Telegram ID

---

## 6. Edge Cases and Known Failure Modes

### EC-001: Empty Restaurant List
If no restaurants match the search criteria or none exist, the system MUST return an empty list (not an error).

### EC-002: Invalid Restaurant/Category/Dish IDs
If an invalid ID is provided for restaurant, category, or dish queries, the system MUST return an appropriate error rather than crashing or returning null.

### EC-003: Cart State Preservation on Error
When a user provides invalid input for order placement, the cart MUST remain intact so the user can correct and retry.

### EC-004: Order with No Items
The system MUST reject order placement attempts with an empty item list.

### EC-005: Missing Delivery Location
The system MUST handle orders with missing delivery location — either require it or allow it as optional based on business rules.

### EC-006: Expired Authentication
If Telegram Init Data has expired, the system MUST reject the request with a 401 error.

### EC-007: Concurrent Cart Modifications
If multiple requests modify the same cart simultaneously, the system MUST handle race conditions gracefully (last-write-wins or atomic operations).

### EC-008: Backend Unavailability
If the backend order management service is unavailable, the system MUST return a meaningful error and NOT expose internal stack traces to clients.

---

## 7. Items Requiring Clarification

### [NEEDS CLARIFICATION] Item 1: Delivery Location Requirement
The current API accepts both latitude/longitude coordinates AND a Google Maps URL as delivery location. It is unclear whether both are required, one is required, or they are truly optional. This affects:
- Validation logic implementation
- Frontend UI requirements
- Backend order creation behavior

**Impact on scope:** HIGH — Changes core order flow and validation

---

### [NEEDS CLARIFICATION] Item 2: Cart Persistence Strategy
The specification mentions in-memory cart for tests but suggests KV storage for production. The transition strategy and data migration approach between in-memory and persistent storage is not defined.

**Impact on scope:** MEDIUM — Affects production deployment and data integrity

---

### [NEEDS CLARIFICATION] Item 3: Authentication Token Expiration Handling
The spec references "expired init data" as a 401 case but does not define the exact expiration window or whether the frontend should handle token refresh vs. re-authentication.

**Impact on scope:** MEDIUM — Affects security model and user experience

---

## 8. References

- Original specs: `specs/01-api-contract.md`
- Original specs: `specs/02-interaction-flow.md`
- Original specs: `specs/03-autotests.md`
- Original specs: `specs/04-deployment.md`
- Original specs: `specs/05-telegram-auth.md`
- Original specs: `specs/06-contract-helpers.md`
