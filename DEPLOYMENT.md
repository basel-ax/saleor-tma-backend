### Deployment

This service is a stateless Go HTTP API and can be deployed as a container, binary, or behind a Cloudflare Worker.

---

### Containerizing (example)

Create a minimal `Dockerfile` similar to:

```dockerfile
FROM golang:1.25 AS build
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /app/server ./cmd/api

FROM gcr.io/distroless/static-debian12
WORKDIR /app
COPY --from=build /app/server /app/server
EXPOSE 8080
ENTRYPOINT ["/app/server"]
```

Build and run:

```bash
docker build -t saleor-tma-backend .
docker run --rm -p 8080:8080 \
  -e SALEOR_API_URL="https://your-saleor/graphql/" \
  -e SALEOR_TOKEN="..." \
  -e SALEOR_CHANNEL_ID="..." \
  -e SALEOR_CHANNEL_SLUG="default-channel" \
  -e TELEGRAM_BOT_TOKEN="..." \
  saleor-tma-backend
```

Deploy the container to your platform of choice (Kubernetes, ECS, Cloud Run, etc.). Ensure:

- The service is reachable over HTTPS from the **frontend** (Cloudflare Pages)
- Environment variables are securely configured

---

### Deploying behind a Cloudflare Worker

Cloudflare Workers cannot natively run this Go HTTP server, but you can place a **Worker in front of the Go backend** as an edge proxy. This gives you:

- A stable, Cloudflare‑managed public URL for the Telegram Mini App
- Global edge presence, caching, and WAF in front of your BFF

#### 1. Run the Go backend as an origin

Deploy the Go service as described above (container or VM), and note its HTTPS base URL, for example:

- `https://bff.example.com` (must expose `/query`)

#### 2. Create a Cloudflare Worker project

```bash
npm create cloudflare@latest my-tma-worker
cd my-tma-worker
```

In `wrangler.toml`, set:

```toml
name = "tma-bff-proxy"
main = "src/index.ts"
compatibility_date = "2025-09-01"

vars = { ORIGIN_URL = "https://bff.example.com" }

routes = [
  { pattern = "api.example.com/*", zone_name = "example.com" }
]
```

#### 3. Implement the Worker proxy

Example `src/index.ts`:

```ts
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const originURL = new URL(env.ORIGIN_URL);
    originURL.pathname = "/query";

    const init: RequestInit = {
      method: request.method,
      headers: request.headers,
      body: request.body,
    };

    // Ensure Telegram header is forwarded verbatim
    init.headers.set("X-Telegram-Init-Data", request.headers.get("X-Telegram-Init-Data") || "");

    return fetch(originURL.toString(), init);
  },
} satisfies ExportedHandler<Env>;
```

Key points:

- The Worker **does not modify** the GraphQL body; it simply forwards it.
- `X-Telegram-Init-Data` is preserved so the Go backend can verify it.
- You can add rate limiting, logging, and CORS here if desired.

#### 4. Deploy the Worker

```bash
pnpm install   # or npm install / yarn
pnpm run deploy
```

After deployment:

- Point the frontend’s `BACKEND_BASE_URL` to the Worker route (for example `https://api.example.com`).
- The Worker will proxy all GraphQL requests to your Go backend at `ORIGIN_URL`.

This pattern lets you keep the Go service simple and focused while benefiting from Cloudflare’s edge and security features.

