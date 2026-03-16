# Coding Conventions

**Analysis Date:** 2026-03-16

## Naming Patterns

**Files:**
- Use camelCase for most files: `auth.ts`, `resolvers.ts`, `testHelpers.ts`
- Use lowercase with hyphens for configuration files when present

**Functions:**
- Use camelCase for function names: `validateInitData`, `extractAuthContext`, `buildPlaceOrderInput`
- Use descriptive names that clearly indicate the function's purpose
- Prefix helper functions with action verbs: `build*`, `isValid*`, `require*`

**Variables:**
- Use camelCase for variable names: `userId`, `restaurants`, `authContext`
- Use descriptive names: `VALID_INIT_DATA`, `TEST_RESTAURANTS`

**Types:**
- Use PascalCase for type definitions: `GraphQLContext`, `AuthContext`, `PlaceOrderInput`
- Use PascalCase for interfaces: `PermissionResult`, `TestConfig`

## Code Style

**Formatting:**
- Prettier is used for formatting (configuration not visible in this analysis)
- 2 space indentation
- Single quotes for strings (when possible)
- Trailing commas enabled

**Linting:**
- ESLint likely used (configuration not visible in this analysis)
- Strict typing with TypeScript
- Explicit return types encouraged

## Import Organization

**Order:**
1. External packages (`import { describe, it, expect, ... } from 'vitest';`)
2. Internal modules from `./` (`import { ... } from "./contracts";`)
3. Internal modules from `../`

**Path Aliases:**
- Not used in this codebase, all imports use relative paths

## Error Handling

**Patterns:**
- Custom error classes and functions defined in `errors.ts`
- Centralized error handling with structured error objects containing error codes
- Error codes like `ErrorCode.UNAUTHENTICATED`, `ErrorCode.FORBIDDEN`
- Detailed logging of error contexts via the logger module

## Logging

**Framework:** Custom logger implementation in `logger.ts`
**Patterns:**
- Structured logging for authentication events, errors, and general information
- Different log methods for different purposes: `logger.authSuccess`, `logger.authFailure`, `logger.error`
- Contextual information included in logs when appropriate

## Comments

**When to Comment:**
- File headers with phase information and alignment with specifications
- JSDoc-style comments for complex functions explaining parameters and behavior
- Inline comments for explaining business logic or important implementation details
- Section dividers using comment blocks with equals signs

**JSDoc/TSDoc:**
- Used consistently for public/exported functions with parameter and return type documentation

## Function Design

**Size:** Functions are kept reasonably small and focused on single responsibilities
**Parameters:** Functions use clear parameter names, with descriptive destructuring for complex objects
**Return Values:** Functions return well-defined types, often using TypeScript interfaces

## Module Design

**Exports:** Named exports are preferred over default exports, though some files use default exports
**Barrel Files:** Not implemented in this codebase

---

*Convention analysis: 2026-03-16*