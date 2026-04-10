/**
 * Local development server without wrangler
 * Uses Node.js http module to run the worker locally
 * 
 * Usage: 
 *   1. npm run build (bundle with esbuild)
 *   2. npm run dev:local
 */

import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Load environment variables from .dev.vars file
 * Format: KEY=value (one per line, # for comments)
 */
function loadEnvVars() {
  const envPath = resolve(__dirname, "../.dev.vars");
  
  if (!existsSync(envPath)) {
    console.warn("⚠️  .dev.vars file not found. Saleor API calls will use mock data.");
    console.warn("   Copy .dev.vars.example to .dev.vars and fill in your Saleor credentials.");
    return;
  }

  try {
    const content = readFileSync(envPath, "utf-8");
    const lines = content.split("\n");
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }
      
      // Parse KEY=value
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) continue;
      
      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim();
      
      // Set on globalThis for Cloudflare Worker compatibility
      globalThis[key] = value;
      
      // Mask sensitive values in logs
      if (key === "SALEOR_TOKEN" || key === "TELEGRAM_BOT_TOKEN") {
        const masked = value.length > 8 
          ? value.slice(0, 4) + "..." + value.slice(-4)
          : "***";
        console.log(`✅ Loaded env: ${key}=${masked}`);
      } else if (key === "SALEOR_API_URL") {
        console.log(`✅ Loaded env: ${key}=${value}`);
      } else {
        console.log(`✅ Loaded env: ${key}`);
      }
    }
    
    console.log("📦 Environment variables loaded from .dev.vars");
    
    // Check Saleor configuration status
    const saleorUrl = globalThis.SALEOR_API_URL;
    const saleorToken = globalThis.SALEOR_TOKEN;
    
    if (saleorUrl && saleorToken) {
      console.log("\n🎉 Saleor API is configured:");
      console.log(`   URL: ${saleorUrl}`);
      console.log(`   Token: ${saleorToken.slice(0, 8)}...${saleorToken.slice(-4)}`);
      console.log("   ✅ Will fetch REAL data from Saleor");
    } else {
      console.log("\n⚠️  Saleor API is NOT fully configured:");
      console.log(`   SALEOR_API_URL: ${saleorUrl ? "✅ set" : "❌ missing"}`);
      console.log(`   SALEOR_TOKEN: ${saleorToken ? "✅ set" : "❌ missing"}`);
      console.log("   ⚠️  Will use MOCK data instead");
    }
  } catch (error) {
    console.error("❌ Failed to load .dev.vars:", error);
  }
}

// Load environment variables BEFORE importing the worker
loadEnvVars();

// Dynamically import the bundled worker
const bundledWorker = await import("../dist/bundled.js");
console.log('bundledWorker:', bundledWorker);
console.log('bundledWorker.handleRequest:', bundledWorker.handleRequest);
console.log('typeof bundledWorker.handleRequest:', typeof bundledWorker.handleRequest);
const { handleRequest } = bundledWorker;

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
