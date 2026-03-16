# Requirements: Saleor Telegram Mini App Backend

**Defined:** 2026-03-16
**Core Value:** Users can seamlessly place food orders through Telegram from various restaurants, with the orders integrated into the Saleor e-commerce platform for fulfillment and management.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Frontend Specifications

Requirements derived from the Telegram Mini App frontend specification.

- [ ] **FRONT-01**: Main page lists restaurants and allows selection
- [ ] **FRONT-02**: Selecting a restaurant navigates to categories
- [ ] **FRONT-03**: Selecting a category shows dish list where each dish has name, description, picture
- [ ] **FRONT-04**: Dish list allows adding items to cart
- [ ] **FRONT-05**: Cart page exists, shows items, supports quantity changes
- [ ] **FRONT-06**: Cart leads to checkout
- [ ] **FRONT-07**: Cart contains items from only one restaurant
- [ ] **FRONT-08**: Switching restaurants triggers confirmation and resets cart on confirm
- [ ] **FRONT-09**: Checkout requires geolocation OR Google Maps link
- [ ] **FRONT-10**: Checkout blocks submission without valid delivery location
- [ ] **FRONT-11**: Order submission hits backend and shows success/failure
- [ ] **FRONT-12**: Cart clears on successful order
- [ ] **FRONT-13**: App is deployable as static frontend to Cloudflare Pages
- [ ] **FRONT-14**: Backend URL is configurable for frontend deployment
- [ ] **FRONT-15**: All backend calls are HTTPS and CORS-compatible

### Authentication

- [ ] **AUTH-01**: User can access the application via Telegram Mini App with automatic authentication
- [ ] **AUTH-02**: User session is validated via Telegram Init Data header
- [ ] **AUTH-03**: Unauthorized requests return 401 status code with error message
- [ ] **AUTH-04**: Insufficient permission requests return 403 status code
- [ ] **AUTH-05**: Authentication tokens are validated against Telegram's requirements (expiration, format)

### Restaurants & Menus

- [ ] **MENU-01**: User can retrieve a list of available restaurants
- [ ] **MENU-02**: User can retrieve categories for a specific restaurant
- [ ] **MENU-03**: User can retrieve dishes for a specific category
- [ ] **MENU-04**: Restaurant data includes name, description, image, and tags
- [ ] **MENU-05**: Category data includes name, description, and image
- [ ] **MENU-06**: Dish data includes name, description, price, currency, and image

### Cart Management

- [ ] **CART-01**: User can add items to their shopping cart
- [ ] **CART-02**: User can update quantities of items in their cart
- [ ] **CART-03**: User can remove items from their cart
- [ ] **CART-04**: User can clear their entire cart
- [ ] **CART-05**: User can retrieve their current cart contents
- [ ] **CART-06**: Cart maintains single restaurant context (switching restaurants clears cart)
- [ ] **CART-07**: Cart calculates total price of items
- [ ] **CART-08**: Cart maintains item counts
- [ ] **CART-09**: Cart data persists across user sessions (with KV integration)
- [ ] **CART-10**: Cart operations require write permissions

### Order Placement

- [ ] **ORDER-01**: User can place an order with selected cart items
- [ ] **ORDER-02**: Order placement requires delivery location information
- [ ] **ORDER-03**: Orders are created in Saleor with proper user context
- [ ] **ORDER-04**: Cart is cleared after successful order placement
- [ ] **ORDER-05**: Order creation returns unique order ID and status
- [ ] **ORDER-06**: Order placement includes customer notes if provided
- [ ] **ORDER-07**: Failed orders return appropriate error messages
- [ ] **ORDER-08**: Order placement requires write permissions
- [ ] **ORDER-09**: Order items are validated before creation

### Saleor Integration

- [ ] **SALEOR-01**: Real Saleor API integration for order creation
- [ ] **SALEOR-02**: Proper mapping of order data to Saleor fields
- [ ] **SALEOR-03**: Error handling for Saleor API failures
- [ ] **SALEOR-04**: Fallback to mock implementation for development
- [ ] **SALEOR-05**: Configuration via environment variables

### Deployment

- [ ] **DEPLOY-01**: Application deploys successfully with Wrangler
- [ ] **DEPLOY-02**: All environment variables configurable via secrets
- [ ] **DEPLOY-03**: Cloudflare KV namespace configured for cart persistence
- [ ] **DEPLOY-04**: Production settings verified
- [ ] **DEPLOY-05**: Health check endpoint available

### API & GraphQL

- [ ] **API-01**: GraphQL endpoint is available at `/graphql`
- [ ] **API-02**: All queries require authenticated user context
- [ ] **API-03**: All mutations require authenticated user with write permissions
- [ ] **API-04**: API responses follow GraphQL standards
- [ ] **API-05**: Error responses include appropriate status codes and messages
- [ ] **API-06**: API supports both GET and POST operations
- [ ] **API-07**: API implements proper request/response logging
- [ ] **API-08**: API supports required queries: restaurants, restaurantCategories, categoryDishes
- [ ] **API-09**: API supports required mutations: placeOrder, addToCart, updateCartItem, removeCartItem, clearCart
- [ ] **API-10**: API handles restaurant switching logic in cart operations

### Security & Logging

- [ ] **SEC-01**: All authentication attempts are logged
- [ ] **SEC-02**: Failed authentication attempts are logged separately
- [ ] **SEC-03**: Order creation events are logged with user context
- [ ] **SEC-04**: API requests include request ID for tracing
- [ ] **SEC-05**: Personal Identifiable Information is minimized in logs
- [ ] **SEC-06**: Error responses don't expose sensitive internal information

### Error Handling

- [ ] **ERR-01**: Missing authentication returns UNAUTHENTICATED error code
- [ ] **ERR-02**: Insufficient permissions returns FORBIDDEN error code
- [ ] **ERR-03**: Missing restaurant information returns MISSING_RESTAURANT error code
- [ ] **ERR-04**: Empty order returns EMPTY_ORDER error code
- [ ] **ERR-05**: Missing delivery address returns MISSING_ADDRESS error code
- [ ] **ERR-06**: Saleor integration failures return ORDER_CREATE_FAILED error code

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Advanced Features

- **ADV-01**: User can view their order history
- **ADV-02**: User can track current order status
- **ADV-03**: Real-time order status updates
- **ADV-04**: Advanced delivery location management
- **ADV-05**: Multiple payment method integration
- **ADV-06**: Coupon and discount code support

### Administration

- **ADMIN-01**: Admin can view all orders
- **ADMIN-02**: Admin can update order statuses
- **ADMIN-03**: Admin can manage restaurant listings
- **ADMIN-04**: Admin can view system metrics

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Real-time chat functionality | High complexity, not core to order placement value |
| User reviews and ratings | Secondary feature, focus on core ordering flow |
| Multi-vendor marketplace | Single restaurant focus per order |
| Native mobile app | Web-first, TMA-only experience |
| Inventory management | Focus on order fulfillment, not stock tracking |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FRONT-01 | Phase 1 | Pending |
| FRONT-02 | Phase 1 | Pending |
| FRONT-03 | Phase 1 | Pending |
| FRONT-04 | Phase 1 | Pending |
| FRONT-05 | Phase 1 | Pending |
| FRONT-06 | Phase 1 | Pending |
| FRONT-07 | Phase 1 | Pending |
| FRONT-08 | Phase 1 | Pending |
| FRONT-09 | Phase 1 | Pending |
| FRONT-10 | Phase 1 | Pending |
| FRONT-11 | Phase 1 | Pending |
| FRONT-12 | Phase 1 | Pending |
| FRONT-13 | Phase 1 | Pending |
| FRONT-14 | Phase 1 | Pending |
| FRONT-15 | Phase 1 | Pending |
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 1 | Pending |
| AUTH-03 | Phase 1 | Pending |
| AUTH-04 | Phase 1 | Pending |
| AUTH-05 | Phase 1 | Pending |
| MENU-01 | Phase 1 | Pending |
| MENU-02 | Phase 1 | Pending |
| MENU-03 | Phase 1 | Pending |
| MENU-04 | Phase 1 | Pending |
| MENU-05 | Phase 1 | Pending |
| MENU-06 | Phase 1 | Pending |
| CART-01 | Phase 2 | Pending |
| CART-02 | Phase 2 | Pending |
| CART-03 | Phase 2 | Pending |
| CART-04 | Phase 2 | Pending |
| CART-05 | Phase 2 | Pending |
| CART-06 | Phase 2 | Pending |
| CART-07 | Phase 2 | Pending |
| CART-08 | Phase 2 | Pending |
| CART-09 | Phase 2 | Pending |
| CART-10 | Phase 2 | Pending |
| ORDER-01 | Phase 3 | Pending |
| ORDER-02 | Phase 3 | Pending |
| ORDER-03 | Phase 3 | Pending |
| ORDER-04 | Phase 3 | Pending |
| ORDER-05 | Phase 3 | Pending |
| ORDER-06 | Phase 3 | Pending |
| ORDER-07 | Phase 3 | Pending |
| ORDER-08 | Phase 3 | Pending |
| ORDER-09 | Phase 3 | Pending |
| SALEOR-01 | Phase 4 | Pending |
| SALEOR-02 | Phase 4 | Pending |
| SALEOR-03 | Phase 4 | Pending |
| SALEOR-04 | Phase 4 | Pending |
| SALEOR-05 | Phase 4 | Pending |
| DEPLOY-01 | Phase 5 | Pending |
| DEPLOY-02 | Phase 5 | Pending |
| DEPLOY-03 | Phase 5 | Pending |
| DEPLOY-04 | Phase 5 | Pending |
| DEPLOY-05 | Phase 5 | Pending |
| API-01 | Phase 2 | Pending |
| API-02 | Phase 2 | Pending |
| API-03 | Phase 2 | Pending |
| API-04 | Phase 2 | Pending |
| API-05 | Phase 2 | Pending |
| API-06 | Phase 2 | Pending |
| API-07 | Phase 2 | Pending |
| API-08 | Phase 2 | Pending |
| API-09 | Phase 2 | Pending |
| API-10 | Phase 2 | Pending |
| SEC-01 | Phase 6 | Pending |
| SEC-02 | Phase 6 | Pending |
| SEC-03 | Phase 6 | Pending |
| SEC-04 | Phase 6 | Pending |
| SEC-05 | Phase 6 | Pending |
| SEC-06 | Phase 6 | Pending |
| ERR-01 | Phase 6 | Pending |
| ERR-02 | Phase 6 | Pending |
| ERR-03 | Phase 6 | Pending |
| ERR-04 | Phase 6 | Pending |
| ERR-05 | Phase 6 | Pending |
| ERR-06 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 57 total
- Mapped to phases: 57
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-16*
*Last updated: 2026-03-16 after requirements analysis*