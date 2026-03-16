# Saleor Telegram Mini App Backend

## What This Is

A Cloudflare Worker-based backend serving as a Backend-for-Frontend (BFF) between a Telegram Mini App frontend and Saleor's e-commerce platform. The system enables users to browse restaurants, view menus, manage a cart, and place orders through Telegram, with all orders ultimately processed in Saleor.

## Core Value

Users can seamlessly place food orders through Telegram from various restaurants, with the orders integrated into the Saleor e-commerce platform for fulfillment and management.

## Current Milestone: v1.0 - Core Features

**Goal:** Complete implementation of all core functionality required for the Telegram Mini App frontend to function according to specifications.

**Target features:**
- Restaurant browsing with categories and dishes
- Cart management with single-restaurant constraint
- Order placement with delivery location support
- Telegram authentication with proper error handling
- Saleor integration for order processing
- Cloudflare KV persistence for production deployment

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->
- ✓ Restaurants browsing - users can view restaurant listings with names and descriptions
- ✓ Menu categories - users can browse categories within each restaurant
- ✓ Dish listings - users can see dishes with names, descriptions, and prices
- ✓ Shopping cart functionality - users can add, update, remove items from cart
- ✓ Telegram authentication - secure validation of users via Telegram Init Data
- ✓ Order placement - users can place orders that integrate with Saleor
- ✓ Cart persistence - in-memory cart management per user session
- ✓ Error handling - structured error responses with standardized codes

### Active

<!-- Current scope. Building toward these. -->

- [ ] Complete implementation of all GraphQL queries and mutations required by frontend
- [ ] Ensure cart persistence with Cloudflare KV for production deployment
- [ ] Implement real Saleor integration for order processing
- [ ] Verify all frontend specification requirements are met
- [ ] Test and validate deployment with Wrangler
- [ ] Finalize error handling and security measures

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- Real-time chat functionality - High complexity, not core to order placement value
- User reviews and ratings - Secondary feature, focus on core ordering flow
- Multi-vendor marketplace - Single restaurant focus per order
- Native mobile app - Web-first, TMA-only experience

## Context

This project is built as a Cloudflare Worker using TypeScript, with a GraphQL API for the frontend to interact with. The system follows a phased development approach with tight alignment between specification documents and implementation code. The architecture separates concerns between authentication, cart management, and Saleor integration, using a contract-first approach with comprehensive testing.

The system currently uses in-memory storage for carts during development, with provisions for migrating to Cloudflare KV for production. Authentication is handled via Telegram's Init Data validation, ensuring secure user identification within the Telegram ecosystem.

## Constraints

- **Deployment**: Must run on Cloudflare Workers platform
- **Authentication**: Relies solely on Telegram Init Data for user identity
- **Saleor Integration**: Limited to order creation and basic fulfillment data
- **Storage**: In-memory for development, KV for production
- **Timeline**: Phased rollout approach with MVP first
- **Performance**: <200ms response times for all operations

## Key Decisions

<!-- Decisions that constrain future work. Add throughout project lifecycle. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| GraphQL API Surface | Enables flexible frontend consumption with single endpoint | ✓ Good |
| Telegram Init Data Authentication | Leverages Telegram's secure authentication model | ✓ Good |
| In-memory to KV Cart Migration | Supports development with fallback to production KV | ✓ Good |
| Mock Saleor Integration | Enables development without live Saleor instance | ✓ Good |
| Phased Development Approach | Reduces complexity and enables incremental delivery | ✓ Good |

---
*Last updated: 2026-03-16 after codebase analysis*