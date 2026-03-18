# AI Agents Guidelines for the Telegram TMA GraphQL Backend

This document defines how AI agents (QA, security, and code) should collaborate to improve, test, secure, and extend this repository. It uses the base guidance from https://agents.md and the TypeScript-spec checks found in QA_AGENT.md, SEC_AGENT.md, and TS_CODE_AGENT.md. The project specs live under specs/ and describe a GraphQL backend (Node.js/TypeScript) for a Telegram Mini App that talks to Saleor.

## Essential Commands

### Build Commands
- **Full build**: `cd worker && npm run build` (compiles TypeScript to JavaScript)
- **Development mode**: `wrangler dev` (starts local Cloudflare Workers server)
- **Production build**: `wrangler deploy --env production`
- **Quick build check**: `cd worker && npx tsc --noEmit` (type checking only)

### Test Commands
- **Run all contract tests**: `cd worker && npm test` (uses spec-kit)
- **Run tests in watch mode**: `cd worker && npm run test:watch`
- **Run specific test file**: `cd worker && npx vitest run src/graphql.test.ts`
- **Run tests with custom URL**: `cd worker && SPEC_KIT_BASE_URL=http://localhost:8787 npm test`
- **Type checking only**: `cd worker && npx tsc --noEmit`

### Lint Commands
- **Check linting**: `cd worker && npm run lint`
- **Fix linting**: `cd worker && npm run lint:fix`
- **Format code**: `cd worker && npx prettier --write "src/**/*.ts"`

### Development Workflow
1. Make changes in `worker/src/` directory
2. Run `cd worker && npm run lint:fix` to fix formatting
3. Run `cd worker && npm run build` to compile
4. Run `cd worker && npm test` to verify changes
5. Test locally with `wrangler dev` and manual curl requests
6. Deploy with `wrangler deploy` when ready

## Code Style Guidelines

### TypeScript Conventions
- **Strict typing**: Enable all strict TypeScript options in tsconfig.json
- **Module system**: Use ES modules (`import`/`export`) with `"type": "module"` in package.json
- **Interfaces**: Define interfaces for all public objects and API contracts
- **Types**: Use `type` for complex types, `interface` for object shapes that may be extended
- **Naming**: Use PascalCase for types/interfaces, camelCase for variables/functions
- **Constants**: Use `const` for values that won't change, `let` for reassignment
- **Functions**: Prefer arrow functions for callbacks, regular functions for exports

### Import Organization
1. **Built-in modules**: `import { crypto } from "crypto"`
2. **External dependencies**: `import { AppError } from "./errors"`
3. **Internal modules**: `import { logger } from "./logger"`
4. **Relative paths**: Use `./` for same directory, `../` for parent
5. **Alphabetical order**: Sort imports alphabetically within each group
6. **No unused imports**: Remove unused imports with editor auto-fix

### Formatting Rules
- **Indentation**: 2 spaces (not tabs)
- **Line length**: Maximum 100 characters (prettier default)
- **Semicolons**: Always use semicolons (prettier default)
- **Quotes**: Use single quotes for strings (prettier default)
- **Trailing commas**: Use trailing commas in multi-line objects/arrays
- **Braces**: Opening brace on same line, closing brace on new line
- **Control flow**: Space after keywords (`if (condition) {`)
- **Function calls**: No space between function name and parentheses

### Naming Conventions
- **Files**: Use kebab-case (`auth.ts`, `cart-utils.ts`)
- **Variables/functions**: camelCase (`extractAuthContext`, `getCartSync`)
- **Types/Interfaces**: PascalCase (`GraphQLContext`, `PlaceOrderInput`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_CART_ITEMS`, `DEFAULT_CURRENCY`)
- **Private members**: Prefix with underscore (`_internalId`) only for truly private
- **Booleans**: Use `is`, `has`, `should` prefixes (`isValid`, `hasItems`)

### Error Handling
- **Custom errors**: Use `AppError` class with `ErrorCode` enum
- **Guard clauses**: Validate inputs early and return errors immediately
- **Context**: Include request IDs in error logs for tracing
- **User messages**: Provide descriptive, user-friendly error messages
- **Internal errors**: Log full details but return generic messages to clients
- **Async errors**: Always wrap async operations in try/catch or use `.then().catch()`

### Validation Patterns
- **Input validation**: Use Zod schemas for complex validation
- **Schema validation**: Validate all inputs against API contracts
- **Type guards**: Use custom type guards for runtime type checking
- **Default values**: Provide sensible defaults for optional parameters
- **Sanitization**: Sanitize user inputs before processing or storing

### Comments & Documentation
- **JSDoc**: Use JSDoc for all exported functions and complex logic
- **TODO comments**: Use `// TODO:` for future work, `// FIXME:` for known issues
- **Phase references**: Include phase numbers in comments for historical context
- **Complex logic**: Add explanatory comments for non-obvious algorithms
- **Public APIs**: Document all exported functions with parameters and return values
- **Avoid obvious comments**: Don't comment what the code clearly shows

### Testing Practices
- **Test files**: Name as `[feature].test.ts` alongside implementation
- **Test structure**: Use `describe()` blocks for features, `it()` for test cases
- **Arrange-Act-Assert**: Follow AAA pattern in all tests
- **Mocking**: Mock external dependencies (Saleor client, KV storage)
- **Edge cases**: Test boundary conditions, invalid inputs, error states
- **Isolation**: Each test should be independent and not rely on test order
- **Cleanup**: Reset global state (like in-memory carts) between tests

### Security Guidelines
- **Input validation**: Validate and sanitize all user inputs
- **Auth context**: Always verify Telegram Init Data before processing requests
- **Secrets**: Never log or expose secrets (tokens, API keys)
- **Error messages**: Don't leak internal details in error responses
- **CORS**: Configure appropriately for frontend origins
- **Rate limiting**: Consider implementing for public endpoints
- **Data minimization**: Only collect and store necessary data

### Performance Considerations
- **Database/KV**: Batch operations where possible
- **Caching**: Cache frequently accessed static data (restaurants, categories)
- **Memory**: Avoid memory leaks in long-running processes
- **Async**: Use Promise.all() for parallel independent operations
- **Bundle size**: Monitor worker size (Cloudflare Workers limit applies)
- **Logging**: Balance debug info with performance in production

## Agent-Specific Guidelines

### For Code Agents (TS_CODE_AGENT)
1. Start with specs/ directory to understand requirements
2. Follow existing code patterns in worker/src/
3. Create interfaces before implementation when adding new types
4. Add JSDoc comments for all public functions
5. Handle errors consistently with existing patterns
6. Write corresponding tests for new functionality
7. Ensure TypeScript compiles without errors
8. Run linter before considering work complete

### For QA Agents (QA_AGENT)
1. Review specs/ directory for test requirements
2. Focus on contract testing with spec-kit
3. Verify error handling matches API contract specifications
4. Test edge cases and error conditions thoroughly
5. Ensure tests are deterministic and don't rely on timing
6. Validate both positive and negative test cases
7. Check that tests clean up state appropriately
8. Verify test coverage for critical paths

### For Security Agents (SEC_AGENT)
1. Validate authentication flow per specs/05-telegram-auth.md
2. Check for injection vulnerabilities in GraphQL resolvers
3. Verify input validation prevents malicious payloads
4. Ensure secrets are never logged or exposed
5. Review error handling for information leakage
6. Validate authorization checks where applicable
7. Check for proper CORS configuration
8. Review dependency vulnerabilities with npm audit

## Project Structure
```
worker/
├── src/
│   ├── index.ts          # Main entry point
│   ├── auth.ts           # Telegram Init Data validation
│   ├── cart.ts           # In-memory cart storage
│   ├── contracts.ts      # TypeScript interfaces
│   ├── errors.ts         # Custom error classes
│   ├── logger.ts         # Logging utility
│   ├── resolvers.ts      # GraphQL resolvers
│   ├── saleorClient.ts   # Saleor API wrapper
│   ├── saleorOrder.ts    # Order processing logic
│   ├── testHelpers.ts    # Test utilities
│   ├── utils.ts          # Helper functions
│   └── graphql.test.ts   # Unit tests
├── schema.graphql        # GraphQL schema definition
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
├── wrangler.toml         # Cloudflare Workers configuration
└── TESTING.md            # Testing guide
```

## Specifications Reference
- **API Contract**: `specs/01-api-contract.md` - Defines GraphQL schema and endpoints
- **Interaction Flow**: `specs/02-interaction-flow.md` - User journey specifications
- **Telegram Auth**: `specs/05-telegram-auth.md` - Init Data validation details
- **Deployment**: `specs/04-deployment.md` - Deployment procedures
- **Contract Helpers**: `specs/06-contract-helpers.md` - Testing utilities
- **Autotests**: `specs/03-autotests.md` - Detailed test cases
- **Speckit Setup**: `specs/00-speckit-setup.md` - Test framework configuration

## Best Practices from Implementation
1. **Stateless Design**: Use in-memory state for testing, KV for production persistence
2. **Error Standardization**: Consistent error codes and messages across all endpoints
3. **Auth Middleware**: Extract auth validation to reusable function
4. **Resolver Pattern**: Separate routing logic from business logic
5. **Context Propagation**: Pass authenticated user info through GraphQLContext
6. **Logging Structure**: Structured logging with consistent fields
7. **Type Safety**: Strong typing throughout with minimal any usage
8. **Testability**: Design functions to be easily unit testable
9. **Documentation**: Keep IMPLEMENTATION.md updated with architectural decisions
10. **Incremental Delivery**: Implement features in phases with working intermediates

## Troubleshooting Common Issues
- **Build failures**: Check tsconfig.json and run `npx tsc --noEmit` for type errors
- **Test failures**: Verify SPEC_KIT_BASE_URL is set correctly for contract tests
- **Wrangler errors**: Ensure wrangler.toml is valid and worker builds successfully
- **Type errors**: Enable strict mode in tsconfig.json and fix all reported issues
- **Lint errors**: Run `npm run lint:fix` to automatically fix formatting issues
- **Memory leaks**: Check for unclosed resources or growing global collections
- **Performance issues**: Profile with clinic.js or similar tools if needed
- **Deployment failures**: Verify all secrets are set and KV namespace exists

## Commit Message Convention
- **Format**: `type(scope): description`
- **Types**: feat, fix, docs, style, refactor, perf, test, chore
- **Scope**: worker, auth, cart, orders, etc. (optional)
- **Description**: Imperative mood, max 50 characters
- **Body**: Optional detailed explanation
- **Footer**: Optional breaking changes or issue references

Example: `feat(auth): add Telegram Init Data validation middleware`