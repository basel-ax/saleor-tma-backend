// Entry point for Cloudflare Worker
// This file wires the fetch handler to the GraphQL-lite implementation
import { handleRequest } from "./src/index";

addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request));
});
