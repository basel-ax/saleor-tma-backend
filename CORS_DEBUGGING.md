# CORS Debugging Guide for Saleor TMA Frontend

## Problem Analysis

Based on the curl commands you shared, here's what's happening:

1. **Frontend** runs on `http://localhost:5173` (Vite dev server)
2. **Backend** API is at `http://localhost:8787/graphql`
3. When the frontend makes requests to the backend, the browser:
   - First sends an **OPTIONS request** (CORS preflight) to check if the actual request is allowed
   - Then sends the actual **POST request** if the preflight succeeds

## What's Going Wrong

From your curl output, I can see:
- The **OPTIONS request** to `http://localhost:8787/graphql` is returning **401 Unauthorized**
- This means your backend is requiring authentication even for CORS preflight requests
- **This is incorrect behavior** - CORS preflight requests (OPTIONS) should never require authentication

## Root Cause

Your backend's CORS/middleware configuration is likely:
1. Applying authentication checks to ALL incoming requests, including OPTIONS
2. Not properly exempting OPTIONS requests from authentication
3. Or having overly strict CORS policies that don't match your frontend's origin/headers

## How to Fix It

### Backend Configuration Requirements

Your backend needs to be configured to:

#### 1. Allow CORS from `http://localhost:5173`
```javascript
// Example (adjust for your backend framework)
const corsOptions = {
  origin: 'http://localhost:5173', // Frontend dev server
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Telegram-Init-Data'],
  credentials: true // If you need cookies/auth
};
```

#### 2. **Crucially**: Exempt OPTIONS requests from authentication
Your authentication middleware should skip authentication for OPTIONS requests:
```javascript
// Pseudocode - adjust for your backend framework
app.use((req, res, next) => {
  // Skip authentication for OPTIONS (CORS preflight) requests
  if (req.method === 'OPTIONS') {
    return next(); // Continue to CORS middleware
  }
  
  // Apply authentication for all other methods
  authenticateRequest(req, res, next);
});
```

#### 3. Allow the specific headers your frontend sends:
- `Content-Type` (required for JSON payloads)
- `Telegram-Init-Data` (your custom auth header)

#### 4. Allow required HTTP methods:
- `GET` (for queries)
- `POST` (for mutations and queries)
- `OPTIONS` (for CORS preflight - MUST be allowed without auth)

## Verification Steps

Once your backend is fixed, test with:

### 1. Test OPTIONS request directly (should return 200/204, not 401):
```bash
curl -v -X OPTIONS \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type,Telegram-Init-Data" \
  http://localhost:8787/graphql
```

### 2. Test actual request (should work if OPTIONS succeeds):
```bash
curl -v -X POST \
  -H "Origin: http://localhost:5173" \
  -H "Content-Type: application/json" \
  -H "Telegram-Init-Data: test_data" \
  -d '{"query":"query GetRestaurants { restaurants { id name } }"}' \
  http://localhost:8787/graphql
```

## Frontend Considerations

Your frontend code in `src/api/index.ts` is correct:
- It sets proper headers: `Content-Type` and `Telegram-Init-Data`
- It uses the `VITE_BACKEND_BASE_URL` environment variable correctly
- It handles GraphQL responses properly

### Environment Variable
Double-check your `.env.local`:
```env
VITE_BACKEND_BASE_URL=http://localhost:8787
```
Note: The `/graphql` path is automatically appended in `src/api/index.ts`.

## Quick Checks

1. **Is your backend actually running on port 8787?**
   ```bash
   curl -v http://localhost:8787/graphql
   ```
   Should return a GraphQL response (not connection refused).

2. **Does your backend have a `/graphql` endpoint?**
   Verify the route exists in your backend code.

3. **Check backend logs**
   Look for:
   - Why OPTIONS requests are getting 401
   - What authentication is being applied
   - Any CORS-related error messages

## Summary

**The issue is 100% on the backend side** - your frontend is making correct requests. The backend needs to:
1. Allow CORS from `http://localhost:5173`
2. Allow `Content-Type` and `Telegram-Init-Data` headers
3. Allow POST and OPTIONS methods
4. **MOST IMPORTANTLY**: Not require authentication for OPTIONS requests

Fix the backend's CORS/authentication configuration, and the 401 errors on OPTIONS requests will disappear, allowing your frontend to communicate properly with the backend.