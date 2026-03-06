// Phase 2: Telegram Init Data Validation
// Validates X-Telegram-Init-Data header and produces AuthContext
// Aligns with specs/05-telegram-auth.md
// Phase 7: Enhanced with structured logging and error codes

import { logger, SecurityEvents } from "./logger";

import { AuthContext } from "./contracts";

// Bot token for HMAC-SHA256 validation (Cloudflare Worker env)
const TELEGRAM_BOT_TOKEN = typeof globalThis !== 'undefined' 
  ? (globalThis as any)?.TELEGRAM_BOT_TOKEN || "" 
  : "";

/**
 * Validates Telegram Init Data header and returns AuthContext.
 * 
 * Validation rules (per specs/05-telegram-auth.md):
 * - Init data must be present and not empty
 * - In production: perform HMAC-SHA256 verification against botToken
 * - Check for expiration (auth_date should not be too old)
 * 
 * @param header - The X-Telegram-Init-Data header value
 * @returns AuthContext with user info if valid, or invalid context with error
 */
export function validateInitData(header: string | null): AuthContext {
  // Handle missing header
  if (!header || header.trim().length === 0) {
    logger.authFailure("missing_header");
    return {
      userId: "",
      valid: false,
      errorCode: "UNAUTHENTICATED",
    };
  }

  try {
    // Parse URL-encoded init data
    const params = new URLSearchParams(header);
    
    // Check for required fields
    const hash = params.get("hash");
    const authDate = params.get("auth_date");
    
    if (!hash || !authDate) {
      logger.authFailure("missing_required_fields");
      return {
        userId: "",
        valid: false,
        errorCode: "UNAUTHENTICATED",
      };
    }

    // Check expiration (init data valid for 24 hours)
    const authTimestamp = parseInt(authDate, 10);
    const now = Math.floor(Date.now() / 1000);
    const maxAge = 24 * 60 * 60; // 24 hours in seconds
    
    if (now - authTimestamp > maxAge) {
      logger.authExpired();
      return {
        userId: "",
        valid: false,
        errorCode: "UNAUTHENTICATED",
      };
    }

    // In production: verify HMAC-SHA256 hash here
    // For skeleton: accept any valid-looking init data
    if (TELEGRAM_BOT_TOKEN) {
      // TODO: Implement full HMAC-SHA256 verification
      // const dataCheckString = [...params.entries()]
      //   .filter(([key]) => key !== "hash")
      //   .sort(([a], [b]) => a.localeCompare(b))
      //   .map(([key, value]) => `${key}=${value}`)
      //   .join("\n");
      // const secret = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(TELEGRAM_BOT_TOKEN));
      // const hmac = await crypto.subtle.sign("HMAC", secret, new TextEncoder().encode(dataCheckString));
      // const computedHash = Array.from(new Uint8Array(hmac)).map(b => b.toString(16).padStart(2, "0")).join("");
      // if (computedHash !== hash) { ... }
    }

    // Extract user information from init data
    const userJson = params.get("user");
    let name: string | undefined;
    let language: string | undefined;
    
    if (userJson) {
      try {
        const user = JSON.parse(userJson);
        name = user.first_name ? (user.last_name ? `${user.first_name} ${user.last_name}` : user.first_name) : undefined;
        language = user.language_code;
      } catch {
        // User parsing failed, continue without name
      }
    }

    const userId = params.get("id") || params.get("user_id") || "";
    
    logger.authSuccess(userId);

    return {
      userId,
      name,
      language,
      valid: true,
    };
  } catch (error) {
    logger.authFailure("validation_error");
    return {
      userId: "",
      valid: false,
      errorCode: "UNAUTHENTICATED",
    };
  }
}

/**
 * Middleware-style function to validate request headers
 * Returns AuthContext for injection into GraphQL context
 */
export function extractAuthContext(request: Request): AuthContext {
  const initData = request.headers.get("X-Telegram-Init-Data");
  return validateInitData(initData);
}

// Placeholder for backward compatibility
export function verifyInitData(_initData: string): boolean {
  const result = validateInitData(_initData);
  return result.valid;
}

export function parseAuth(_initData: string): { userId: string; name?: string } {
  const result = validateInitData(_initData);
  return { userId: result.userId, name: result.name };
}
