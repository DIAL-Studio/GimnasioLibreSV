---
name: ahk-feature
description: Turn an idea or Jira request into a reviewable, evidence-backed feature specification.
---

## Provider Delegation Guidance

- Sequential: Use @<role-name> to delegate to a specific agent. Child sessions need a self-contained objective.
- Parallel: Launch multiple @mentions in a single message for parallel work.
- Context Transfer: Each child session needs: objective, scope, known context, restrictions, output contract.
- Wait For Completion: Wait for each @mention to complete before proceeding.


## Purpose

Read [the feature workflow](resources/feature-workflow.md) before discovery and [the feature template](resources/feature-template.md) before saving.

## Persistence and handoff

After the required questions and project evidence produce a complete first synthesis, create or update a `feature` draft with structured specification MCP tools. Use `specs.list` and `specs.search` to find related context, `specs.get` to read it, and `specs.validate` after every write. Keep drafts reviewable and editable through MCP; transition to `approved` only after explicit user confirmation.

Do not choose an implementation design. Offer `ahk-use-case-tech` only after this feature is approved and the user asks for technical design.
