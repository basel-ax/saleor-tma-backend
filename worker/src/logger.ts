// Phase 7: Structured logging with minimal PII
// Aligns with SEC_AGENT.md

export enum LogLevel {
  DEBUG = "debug",
  INFO = "info",
  WARN = "warn",
  ERROR = "error",
}

export const SecurityEvents = {
  AUTH_SUCCESS: "auth_success",
  AUTH_FAILURE: "auth_failure",
  AUTH_EXPIRED: "auth_expired",
  ORDER_CREATED: "order_created",
  ORDER_FAILED: "order_failed",
  RATE_LIMIT_EXCEEDED: "rate_limit_exceeded",
  INVALID_INPUT: "invalid_input",
} as const;

export interface LogEntry {
  level: LogLevel;
  event: string;
  timestamp: string;
  userId?: string;
  requestId?: string;
  message?: string;
  [key: string]: unknown;
}

function createLogEntry(
  level: LogLevel,
  event: string,
  extra?: Record<string, unknown>,
): LogEntry {
  return {
    level,
    event,
    timestamp: new Date().toISOString(),
    ...extra,
  };
}

// Debug mode flag - set via setDebugMode() from Cloudflare Workers env
let debugMode = false;

export function setDebugMode(enabled: boolean): void {
  debugMode = enabled;
}

const isDebugModeEnabled = () => {
  return debugMode;
};

export { isDebugModeEnabled };

export const logger = {
  debug(event: string, extra?: Record<string, unknown>): void {
    console.log(JSON.stringify(createLogEntry(LogLevel.DEBUG, event, extra)));
  },

  info(event: string, extra?: Record<string, unknown>): void {
    console.log(JSON.stringify(createLogEntry(LogLevel.INFO, event, extra)));
  },

  warn(event: string, extra?: Record<string, unknown>): void {
    console.warn(JSON.stringify(createLogEntry(LogLevel.WARN, event, extra)));
  },

  error(event: string, extra?: Record<string, unknown>): void {
    console.error(JSON.stringify(createLogEntry(LogLevel.ERROR, event, extra)));
  },

  // Security-specific logging
  authSuccess(userId: string, requestId?: string): void {
    this.info(SecurityEvents.AUTH_SUCCESS, { userId, requestId });
  },

  authFailure(reason: string, requestId?: string): void {
    this.warn(SecurityEvents.AUTH_FAILURE, { reason, requestId });
  },

  authExpired(requestId?: string): void {
    this.warn(SecurityEvents.AUTH_EXPIRED, { requestId });
  },

  orderCreated(orderId: string, userId: string): void {
    this.info(SecurityEvents.ORDER_CREATED, { orderId, userId });
  },

  orderFailed(userId: string, reason: string): void {
    this.warn(SecurityEvents.ORDER_FAILED, { userId, reason });
  },

  // Debug mode logging for Saleor requests/responses
  saleorDebugRequest(query: string, variables?: Record<string, unknown>): void {
    if (isDebugModeEnabled()) {
      this.debug("saleor_debug_request", { query, variables });
    }
  },

  saleorDebugResponse(data: unknown): void {
    if (isDebugModeEnabled()) {
      this.debug("saleor_debug_response", { data });
    }
  },
};
