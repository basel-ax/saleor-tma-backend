Task Directory for Telegram TMA GraphQL Worker

Overview
- A collection of phase-task documents used to organize work for building the Telegram TMA GraphQL Worker.
- Each phase file describes goals, deliverables, and acceptance criteria to guide AI agents and human contributors.

How to start a task with an AI agent
- Choose a phase file (e.g., task/phase-1-contract-and-api-skeleton.md).
- Provide a prompt to an AI agent referencing the chosen task file path.
- The agent returns a plan and, if needed, a patch/diff-like change set to implement the phase.

Prompt Template (example)
- Implement Phase 1 as described in the task file at the given path. Provide a high-level plan followed by a concrete patch skeleton (unified diff) for the contract interfaces, GraphQL schema skeleton, and resolver stubs. Output should clearly separate plan and patch sections. Target task: Phase 1 — Contract and API Skeleton - @/task/phase-1-contract-and-api-skeleton.md

Notes
- The task files are guidance artifacts. You should produce concrete code patches only when requested by the user.
- Use the repo’s AGENTS.md and patch conventions for generated changes.

(End of README)
