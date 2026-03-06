// Phase 7: Error handling with standardized codes
// Aligns with SEC_AGENT.md and specs/05-telegram-auth.md

export enum ErrorCode {
  UNAUTHENTICATED = "UNAUTHENTICATED",
  FORBIDDEN = "FORBIDDEN",
  BAD_USER_INPUT = "BAD_USER_INPUT",
  NOT_FOUND = "NOT_FOUND",
  RATE_LIMITED = "RATE_LIMITED",
  INTERNAL_ERROR = "INTERNAL_ERROR",
}

export interface GraphQLErrorInput {
  message: string;
  code: ErrorCode;
  field?: string;
  internalId?: string;
}

export class AppError extends Error {
  constructor(
    public readonly message: string,
    public readonly code: ErrorCode,
    public readonly statusCode: number,
    public readonly field?: string,
    public readonly internalId?: string
  ) {
    super(message);
    this.name = "AppError";
  }

  toGraphQL(): GraphQLErrorInput {
    return {
      message: this.message,
      code: this.code,
      field: this.field,
      internalId: this.internalId,
    };
  }
}

// Factory functions for common errors
export function unauthorizedError(message: string = "Authentication required. Please refresh the page."): AppError {
  return new AppError(message, ErrorCode.UNAUTHENTICATED, 401);
}

export function forbiddenError(message: string = "You don't have permission to perform this action."): AppError {
  return new AppError(message, ErrorCode.FORBIDDEN, 403);
}

export function badUserInputError(message: string, field?: string): AppError {
  return new AppError(message, ErrorCode.BAD_USER_INPUT, 400, field);
}

export function notFoundError(message: string = "The requested item was not found."): AppError {
  return new AppError(message, ErrorCode.NOT_FOUND, 404);
}

export function internalError(internalId: string, publicMessage: string = "Something went wrong. Please try again."): AppError {
  return new AppError(publicMessage, ErrorCode.INTERNAL_ERROR, 500, undefined, internalId);
}
