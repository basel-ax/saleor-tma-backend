# Phase 9 — Alignment Questions and Next Steps

## Summary of Improvements

This patch implements all Phase 9 improvements as described in the task:

### ✅ Implemented Features

1. **KV Cart Persistence** - Replaced in-memory cart with Cloudflare KV storage
2. **Real Saleor Integration** - Added Saleor client with fallback to mock
3. **403 Permission Support** - Added permission checking and 403 error handling
4. **CI/CD Pipeline** - Created GitHub Actions workflow for automated testing/deployment
5. **Minimal Surface Area** - Updated contracts to focus on core functionality
6. **Production-Ready Configuration** - Updated wrangler.toml with KV namespace

### 🎯 Key Decisions Made

- **KV from start**: Implemented KV cart persistence by default for production migration path
- **Real Saleor**: Added Saleor client with mock fallback for development
- **403 support**: Added permission checking alongside existing 401 auth
- **Minimal surface**: Kept only essential queries/mutations as specified
- **CI/CD**: Created automated pipeline with staging/production environments

### 📁 Files Modified

- `worker/src/cart.ts` - KV persistence layer with sync fallback
- `worker/src/saleorClient.ts` - Real Saleor client with mock fallback
- `worker/src/saleorOrder.ts` - Updated to use real Saleor integration
- `worker/src/auth.ts` - Added 403 permission checking
- `worker/src/contracts.ts` - Updated for minimal surface area
- `wrangler.toml` - Added KV namespace configuration
- `.github/workflows/ci-cd.yml` - CI/CD pipeline

### 🚀 Deployment Notes

**Prerequisites:**
- Cloudflare account with KV namespace created
- Saleor API URL and token
- Telegram bot token

**Secrets to set:**
```bash
wrangler secret put SALEOR_API_URL
wrangler secret put SALEOR_TOKEN
wrangler secret put TELEGRAM_BOT_TOKEN
```

**Environment variables:**
- `DEBUG=true` for development (enables debug logging)
- `DEBUG=false` for production (minimal logging)

### 🔧 Testing

**Local development:**
```bash
cd worker
npm install
npm run build
wrangler dev
```

**Contract tests:**
```bash
SPEC_KIT_BASE_URL=http://localhost:8787 npm test
```

**Production deployment:**
```bash
wrangler deploy --env production
```

### 📋 Next Steps

1. **Create KV namespace:** `wrangler kv:namespace create CARTS`
2. **Set secrets:** Use `wrangler secret put` for required environment variables
3. **Deploy:** Run `wrangler deploy` for initial deployment
4. **Test:** Verify with contract tests against production endpoint
5. **Monitor:** Check logs for any issues in production

### 🎯 Minimum Viable Surface Area

**Queries:**
- `restaurants` - Get all restaurants
- `restaurantCategories` - Get categories for a restaurant
- `categoryDishes` - Get dishes for a category
- `cart` - Get current user's cart

**Mutations:**
- `placeOrder` - Create an order
- `addToCart` - Add item to cart
- `updateCartItem` - Update cart item quantity
- `removeCartItem` - Remove item from cart
- `clearCart` - Clear entire cart

### 🔒 Security Posture

- **401**: Missing/invalid X-Telegram-Init-Data header
- **403**: User lacks required permissions
- **Input validation**: All inputs validated before processing
- **Error handling**: Standardized error codes and messages
- **Logging**: Structured logging with minimal PII exposure

### 📈 Production Considerations

- **Cart TTL**: 24-hour expiration for cart data
- **Fallback**: Mock Saleor orders when API not configured
- **Sync versions**: Maintained for test compatibility
- **Environment detection**: Automatic switch between memory/KV

This implementation provides a production-ready foundation with clear migration paths and comprehensive testing coverage.

---

*Patch created: 2026-03-07*
*Phase 9 complete: Alignment Questions and Next Steps*