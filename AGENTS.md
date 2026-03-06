# AI Agents Guidelines for the Telegram TMA GraphQL Backend

This document defines how AI agents (QA, security, and code) should collaborate to improve, test, secure, and extend this repository. It uses the base guidance from https://agents.md and the TypeScript-spec checks found in QA_AGENT.md, SEC_AGENT.md, and TS_CODE_AGENT.md. The project specs live under specs/ and describe a GraphQL backend (Go) for a Telegram Mini App that talks to Saleor.

Disclaimer
- Follow the guidance in this document to work with the codebase in a safe, iterative, and testable way.
- Changes should be vetted against specs/ and the llms.txt best-practices before being committed.

-Baselines
- Project specs: specs/* (GraphQL surface, flows, autotests)
- QA agent rules: QA_AGENT.md
- Security rules: SEC_AGENT.md
- TypeScript code rules: TS_CODE_AGENT.md
- LLMS best practices: https://raw.githubusercontent.com/ohld/tma-llms-txt/main/llms.txt
- GraphQL best practices for Telegram mini apps: best practice set in this repo's docs/graphql-api.md and IMPLEMENTATION.md

Agent Roles
- QA_AGENT: Defines, maintains, and updates test plans, ensures coverage of critical user journeys, and verifies test results against specs. Produces concrete test patches and testing scaffolding. See QA_AGENT.md at root.
- SEC_AGENT: Performs security review and remediation planning following the templates in SEC_AGENT.md and the LLMS guidelines. Documents findings and fixes. See SEC_AGENT.md at root.
- TS_CODE_AGENT: Implements TypeScript code scaffolding, enforces typing, creates interfaces, and produces code patches that align with specs and architecture. See TS_CODE_AGENT.md at root.

Workflow & Collaboration
- All work is driven by specs under specs/; the graphQL surface is driven by specs/01-api-contract.md and related flows in specs/02-interaction-flow.md and specs/03-autotests.md.
- Agents propose changes as patches in a patch-like format (diffs) using the repo’s tooling (see apply_patch usage). If you cannot patch directly, propose changes with a precise patch structure, as shown in this repo's examples.
- All patches must be reviewed against tests and will be validated by the QA_AGENT and TS_CODE_AGENT before merging.
- The following three agent types should be invoked in sequence for a major feature:
  1. TS_CODE_AGENT to scaffold the feature and types
  2. QA_AGENT to define tests and verify contracts
  3. SEC_AGENT to validate security and risk mitigation

Key best practices (TypeScript & GraphQL)
- Design GraphQL endpoints with a minimal, frontend-driven surface: queries that fetch lists and a small mutation to place orders.
- Strong typing: define TypeScript interfaces for Restaurant, Category, Dish, Cart, and PlaceOrderInput, and use them across resolvers and tests.
- Clear error handling: map domain errors to GraphQL errors with codes and human-friendly messages.
- Validation: use Zod/another schema validator for inputs where possible; add server-side guards for all mutation operations.
- Stateless surface with in-memory cart for tests: tests rely on per-session in-memory state; production should switch to a persistent store (KV) using Cloudflare KV or similar.
- Authentication: validate Telegram Init Data header on every GraphQL call; attach an auth result to the execution context for downstream logic.
- Observability: log critical events; use structured logs; avoid leaking sensitive data; expose basic metrics in future via a remote logger if needed.
- Security posture: follow the LLMS.txt best practices and the security audit template from SEC_AGENT.md to address critical risks, fix root causes, and verify remediation.

Developing GraphQL backend endpoints for the Telegram Mini App (guidelines)
- Start with a small GraphQL schema (spec-based surface) and implement resolvers that call Saleor client functions in a minimal form.
- Keep the surface stable: avoid frequent breaking changes; deprecate and migrate gradually.
- Implement per-request Telegram Init Data verification in a middleware-like layer; ensure all resolvers access a validated auth object from context.
- Implement input validation for all inputs (PlaceOrderInput, DeliveryLocation) and ensure 1:1 mapping to Saleor’s required fields.
- Ensure error handling is consistent: GraphQL errors should be descriptive and do not leak internal stack traces.
- Build test coverage around critical flows in specs/03-autotests.md and ensure tests are green before merging.
- Document decisions in IMPLEMENTATION.md and keep AGENTS.md updated with any policy changes.

How to use this file
- Use this as a living design for AI-assisted development sessions.
- When you create new commits or patches, reference the relevant specs and agent guidance in your commit messages.
- Always attach a short rationale for changes in the patch description so future agents understand why the change was made.

Patch conventions
- Patches should be in unified diff format and include only the necessary files changed.
- For added files, show complete file contents in the patch.
- For updates, include only updated sections with context.

- Appendix: Quick reference links
- Specs folder: specs/
- QA agent guide: QA_AGENT.md
- Security agent guide: SEC_AGENT.md
- TS code agent guide: TS_CODE_AGENT.md
- GraphQL API reference: docs/graphql-api.md
- LLMS best practices: https://raw.githubusercontent.com/ohld/tma-llms-txt/main/llms.txt
- Agents base doc: https://agents.md
