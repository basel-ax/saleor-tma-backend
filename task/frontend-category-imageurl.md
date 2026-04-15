# Task: Add imageUrl to Category (Backend + Frontend)

## Problem
The `restaurantCategories` query returns categories without images. Frontend needs `imageUrl` to display category images.

## Current State
Production query returns:
```json
{
  "data": {
    "restaurantCategories": [
      { "id": "...", "name": "..." }  // NO imageUrl field
    ]
  }
}
```

## Backend Implementation Required

### 1. Update GraphQL Schema (`worker/schema.graphql`)
Add `imageUrl` to Category type (line ~61):
```graphql
type Category {
  id: ID!
  name: String!
  imageUrl: String!  # ADD THIS
}
```

### 2. Update TypeScript Interface (`worker/src/contracts.ts`)
Add `imageUrl` to Category interface (line ~83):
```typescript
export interface Category {
  id: string;
  restaurantId?: string;
  name: string;
  imageUrl?: string;  // ADD THIS
}
```

### 3. Update Saleor Query (`worker/src/saleorService.ts`)
Update `PRODUCT_TYPES_QUERY` to fetch backgroundImage (around line ~101):
```typescript
export const PRODUCT_TYPES_QUERY = `
  query ProductTypes {
    productTypes(first: 100) {
      edges {
        node {
          id
          name
          backgroundImage {
            url
          }
        }
      }
    }
  }
`;
```

### 4. Update Interface (`worker/src/saleorService.ts`)
Update `SaleorProductType` interface (around line ~18):
```typescript
export interface SaleorProductType {
  id: string;
  name: string;
  backgroundImage?: {
    url: string;
  } | null;  // ADD THIS
}
```

### 5. Map backgroundImage to Category (`worker/src/saleorService.ts`)
Update `fetchCategories()` function (around line ~306) to map the field:
```typescript
categories.push({
  id: pt.id,
  name: pt.name,
  imageUrl: pt.backgroundImage?.url || "",  // ADD THIS
});
```

### 6. Deploy to Production
```bash
wrangler deploy
```

### 7. Verify
```bash
curl -X POST https://saleor-tma-backend.live-nature.net/graphql \
  -H "Content-Type: application/json" \
  -H "X-Telegram-Init-Data: hash=test&auth_date=9999999999&user={\"id\":\"12345\",\"first_name\":\"Test\"}" \
  -d '{"query": "query { restaurantCategories(restaurantId: \"Q29sbGVjdGlvbjo0\") { id name imageUrl } }"}'
```

Expected:
```json
{
  "data": {
    "restaurantCategories": [
      { "id": "...", "name": "...", "imageUrl": "https://..." }
    ]
  }
}
```

## Frontend Integration (After Backend)

### 1. Update TypeScript Types
```typescript
interface Category {
  id: string;
  restaurantId?: string;
  name: string;
  imageUrl?: string;
}
```

### 2. Update Components
- Use `imageUrl` for category cards
- Show placeholder when empty

## Files Reference
- `worker/schema.graphql` - Category type
- `worker/src/contracts.ts` - Category interface
- `worker/src/saleorService.ts` - PRODUCT_TYPES_QUERY, SaleorProductType, fetchCategories()

## Status
- [x] Backend: schema.graphql - add imageUrl to Category type
- [x] Backend: contracts.ts - add imageUrl to Category interface
- [x] Backend: saleorService.ts - update PRODUCT_TYPES_QUERY
- [x] Backend: saleorService.ts - update SaleorProductType interface
- [x] Backend: saleorService.ts - map backgroundImage to Category.imageUrl
- [ ] Backend: deploy to production
- [ ] Frontend: types need update (see FRONTEND_CATEGORY_IMAGEURL.md)
- [ ] Frontend: components need update (see FRONTEND_CATEGORY_IMAGEURL.md)

## Frontend Documentation
See: `worker/FRONTEND_CATEGORY_IMAGEURL.md`