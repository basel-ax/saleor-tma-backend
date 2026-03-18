/**
 * Local development server without wrangler
 * Uses Node.js http module to run the worker locally
 * 
 * Usage: 
 *   1. npm run build (bundle with esbuild)
 *   2. npm run dev:local
 */

import { createServer } from "http";

// Dynamically import the bundled worker
const { handleRequest } = await import("../dist/bundled.js");

const PORT = process.env.PORT || 8787;

async function main() {
  const server = createServer(async (req, res) => {
    try {
      // Convert Node request to Fetch Request
      const url = new URL(req.url, `http://localhost:${PORT}`);
      const headers = new Headers();
      
      for (const [key, value] of Object.entries(req.headers)) {
        if (value && typeof value === "string") {
          headers.set(key, value);
        } else if (Array.isArray(value)) {
          headers.set(key, value[0]);
        }
      }

      // Read body if present
      let body = undefined;
      if (req.method !== "GET" && req.method !== "HEAD") {
        body = await new Promise((resolve) => {
          let data = "";
          req.on("data", chunk => data += chunk);
          req.on("end", () => resolve(data));
        });
      }

      const request = new Request(url.toString(), {
        method: req.method,
        headers,
        body: body || undefined,
      });

      // Call the worker handler directly
      const response = await handleRequest(request);

      // Set response headers
      for (const [key, value] of response.headers) {
        res.setHeader(key, value);
      }

      // Send response
      res.statusCode = response.status;
      const responseBody = await response.text();
      res.end(responseBody);
    } catch (error) {
      console.error("Server error:", error);
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Internal Server Error" }));
    }
  });

  server.listen(PORT, () => {
    console.log(`
🚀 Local dev server running at http://localhost:${PORT}
   
   Example queries:
   - Restaurants:   curl -X POST http://localhost:${PORT}/graphql -H "Content-Type: application/json" -d '{"query": "{ restaurants { id name } }"}'
   - Categories:    curl -X POST http://localhost:${PORT}/graphql -H "Content-Type: application/json" -d '{"query": "{ restaurantCategories(restaurantId: \\"rest1\\") { id name } }"}'
   - Dishes:        curl -X POST http://localhost:${PORT}/graphql -H "Content-Type: application/json" -d '{"query": "{ categoryDishes(restaurantId: \\"rest1\\", categoryId: \\"cat1\\") { id name price } }"}'
   
   Note: For authenticated endpoints, add header: X-Telegram-Init-Data
   Press Ctrl+C to stop
`);
  });

  // Handle shutdown
  process.on("SIGINT", () => {
    console.log("\n🛑 Shutting down...");
    server.close();
    process.exit(0);
  });
}

main().catch(console.error);
