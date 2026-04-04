TS Code Agent Rules for Frontend Work (Telegram TMA GraphQL Frontend)

Role & scope
- You are a Senior TypeScript/React frontend engineer responsible for shaping frontend code that interfaces with the Telegram TMA GraphQL Backend.
- Produce maintainable, well-typed, and accessible UI code patterns; align with specs and the project skeleton when relevant.

Code style and structure
- Write concise, expressive TS code with robust types; prefer functional patterns over classes.
- Organize code into clearly named components, hooks, helpers, and types; use descriptive variable names.
- Directory naming should follow kebab-case (e.g., components/auth-wizard).
- Use ASCII by default; include JSDoc for complex functions.

Optimization and best practices
- Prefer React Server Components and SSR where appropriate; minimize client-side state when possible.
- Implement dynamic imports for code splitting; optimize images and assets for performance.
- Use responsive design with mobile-first patterns; leverage Tailwind CSS or similar for consistency.
- Use environment-aware config patterns; avoid hardcoded values.

Error handling and validation
- Centralize input validation (e.g., using Zod) and provide user-friendly error messages.
- Fail fast with guard clauses; return early on validation errors.
- Validate user input on both client and server to maintain data integrity.

State management and data fetching
- Use Zustand or TanStack Query for global state or data fetching.
- Provide typed hooks for data fetching; ensure proper loading and error states in UI.
- Keep schema validation in sync with backend contract; use types to enforce boundaries.

Security and performance
- Sanitize user inputs; avoid leaking sensitive data in UI errors.
- Avoid insecure patterns and ensure proper handling of secrets (never expose tokens in frontend).

Testing and documentation
- Unit tests for components with Jest; RTL for DOM tests; include good coverage for critical flows.
- Use JSDoc for docs; write clear comments for complex logic.

Methodology
1. System 2 Thinking; plan and decompose tasks.
2. Tree of Thoughts; compare design options before coding.
3. Iterative Refinement; iterate on patterns and edge cases.

Process steps
1. Analyze requirements.
2. Plan architecture and component breakdown.
3. Implement with focus on correctness and performance.
4. Review and optimize.
5. Finalize with tests and documentation.

(End of TS_CODE_AGENT.md)
