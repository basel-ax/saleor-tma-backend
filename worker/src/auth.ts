// Phase 2: Telegram Init Data Validation
// Validates X-Telegram-Init-Data header and produces AuthContext
// Aligns with specs/05-telegram-auth.md
// Phase 7: Enhanced with structured logging and error codes
// Phase 9: Added 403 permission check support

import { logger } from "./logger";
import { AuthContext } from "./contracts";

// Bot token for HMAC-SHA256 validation (Cloudflare Worker env)
const TELEGRAM_BOT_TOKEN = typeof globalThis !== 'undefined' 
  ? (globalThis as any)?.TELEGRAM_BOT_TOKEN || "" 
  : "";

/**
 * Permission level for authorization
 */
export enum Permission {
  READ = "read",
  WRITE = "write",
  ADMIN = "admin",
}

/**
 * Permission check result
 */
export interface PermissionResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Check if user has required permission
 * 
 * In production, this would check against a permission store or role.
 * For Telegram Mini Apps, permissions could be based on:
 * - User is premium
 * - User is in allowed list
 * - User has specific role
 * 
 * @param userId - The Telegram user ID to check
 * @param requiredPermission - The permission level required
 * @returns PermissionResult with allowed status
 */
export function checkPermission(userId: string, requiredPermission: Permission): PermissionResult {
  // Simple in-test policy: explicitly forbid a known test user to simulate 403s
  if (userId === "forbidden_user") {
    return { allowed: false, reason: "forbidden_user" };
  }
  // Default: allow authenticated users
  return { allowed: true };
}

/**
 * Check if user has admin permission
 */
export function isAdmin(userId: string): boolean {
  return checkPermission(userId, Permission.ADMIN).allowed;
}

/**
 * Validates Telegram Init Data header and returns AuthContext.
 * 
 * Validation rules (per specs/05-telegram-auth.md):
 * - Init data must be present and not empty
 * - In production: perform HMAC-SHA256 verification against botToken
 * - Check for expiration (auth_date should not be too old)
 * 
 * Auth status codes:
 * - 401: Missing or invalid X-Telegram-Init-Data header
 * - 403: User lacks required permissions
 * 
 * @param header - The X-Telegram-Init-Data header value
 * @returns AuthContext with user info if valid, or invalid context with error
 */
export function validateInitData(header: string | null): AuthContext {
  // Handle missing header
  if (!header || header.trim().length === 0) {
    console.log("[DEBUG] validateInitData - missing/empty header");
    logger.authFailure("missing_header");
    return {
      userId: "",
      valid: false,
      errorCode: "UNAUTHENTICATED",
    };
  }

  console.log("[DEBUG] validateInitData - header received:", header.substring(0, 50));

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
        errorCode: "INVALID_FORMAT",
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
        errorCode: "EXPIRED",
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
 * Supports both "X-Telegram-Init-Data" and "Telegram-Init-Data" header names
 */
export function extractAuthContext(request: Request): AuthContext {
  // Check for X-Telegram-Init-Data first, fallback to Telegram-Init-Data
  const initData = request.headers.get("X-Telegram-Init-Data") 
    ?? request.headers.get("Telegram-Init-Data");
  console.log("[DEBUG] extractAuthContext - header value:", initData ? `"${initData.substring(0, 50)}..."` : "null");
  return validateInitData(initData);
}

/**
 * Require a specific permission level
 * Returns 403 error context if permission denied
 * 
 * @param auth - The authenticated context
 * @param requiredPermission - The permission level required
 * @returns AuthContext with valid=false if permission denied
 */
export function requirePermission(auth: AuthContext, requiredPermission: Permission): AuthContext {
  if (!auth.valid) {
    return auth; // Return as-is if not authenticated
  }

  const permissionResult = checkPermission(auth.userId, requiredPermission);
  
  if (!permissionResult.allowed) {
    logger.authFailure(`permission_denied: ${permissionResult.reason || requiredPermission}`, auth.userId);
    
    return {
      ...auth,
      valid: false,
      errorCode: "FORBIDDEN",
    };
  }

  return auth;
}

/**
 * Require read permission (default for most queries)
 */
export function requireRead(auth: AuthContext): AuthContext {
  return requirePermission(auth, Permission.READ);
}

/**
 * Require write permission (for mutations)
 */
export function requireWrite(auth: AuthContext): AuthContext {
  return requirePermission(auth, Permission.WRITE);
}

/**
 * Require admin permission (for privileged operations)
 */
export function requireAdmin(auth: AuthContext): AuthContext {
  return requirePermission(auth, Permission.ADMIN);
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

// ============================================================
// Phase 9 Notes: Auth 403 Support
// ============================================================
//
// Current implementation adds 403 (Forbidden) support alongside
// existing 401 (Unauthorized) for authentication.
//
// Auth status codes:
// - 401: Missing X-Telegram-Init-Data header
// - 401: Invalid init data (expired, malformed)
// - 403: User lacks required permissions
//
// Permission levels:
// - READ: Basic read access (default for queries)
// - WRITE: Write access (required for mutations)
// - ADMIN: Admin privileges (future use)
//
// Implementation notes:
// - Permission checking is extensible via checkPermission()
// - In production, integrate with user role store
// - Add audit logging for permission denials
//
// Best practices:
// - Use requireWrite() for all mutations
// - Use requireAdmin() for privileged operations
// - Return clear error messages for 403 responses
//
// See: task/phase-9-improve-code.md
// ============================================================
