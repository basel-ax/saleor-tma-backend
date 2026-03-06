Phase 2 — Telegram Auth and Context

Goals
- Implement header validation for X-Telegram-Init-Data and define per-request auth context.
- Propagate authenticated user information into GraphQL resolvers via the execution context.

Deliverables
- AuthContext TypeScript interface (e.g., { userId, name, language, valid: boolean }).
- Function signature outline for validateInitData(header: string): AuthContext.
- GraphQL context type that includes auth: AuthContext.
- Error handling outline: 401 for missing/invalid header; 403 as needed.

Notes
- This phase aligns with spec/05-telegram-auth.md and ensures a consistent security boundary.

(End of Phase 2)
