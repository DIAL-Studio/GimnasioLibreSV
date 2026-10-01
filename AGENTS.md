## Available Research Tools

- Context7 MCP tools available: resolve library ID before querying docs
- Mintlify Index available for publisher-maintained technical documentation
- Web search available for current information outside documentation indexes

# AGENTS.md — GimnasioLibreSV

**Read this file first.** It is the navigation map for every AI agent working in this repository.

## Project

**GimnasioLibreSV** — White-label gym app para El Salvador (fork de openGym, AGPL-3.0). B2B white-label a gimnasios + cuña de consumidor.

## Health check (run before making codebase changes)

```bash
bash health.sh
```

If it exits non-zero, stop and report the issue. Do not proceed with codebase changes until health is green.

## Harness data (source of truth)

| File | Purpose |
|------|---------|
| `.harness/harness.db` | SQLite: tasks, actions, and action sections |

## MCP tools (preferred)

The harness exposes tools via MCP server on port 3742. Use these instead of reading files directly.

```
actions.start        taskId agent                           → start an action, returns a numeric actionId
actions.write        actionId section text                  → record a section (result, blockers, ...)
actions.complete     actionId summary                       → close the action
actions.list         taskId [agent] [status] [limit] [cursor] → compact newest-first action index with pagination
actions.get_by_id    actionId                               → single action with section index (no content)
actions.sections_list actionId [types] [limit] [cursor]      → compact section index with type filtering
actions.sections_get sectionId [length] [offset]             → ranged section content reader
actions.handoff.get    taskId [recipient]                     → newest completed canonical handoff
actions.handoff.write  actionId recipient ...                 → recipient-directed bounded handoff
tasks.add            title [slug] [description] [acceptance] → create a new task from natural language
tasks.get            [status]                               → list tasks (pending | in_progress | done | blocked)
tasks.claim          id                                     → atomically claim a pending task
tasks.update         id status                              → change task status
tasks.acceptance.update criterionId                        → mark an acceptance criterion as met
docs.search          query                                  → search ./docs for relevant content
```

## Workflow

```
1. INIT
   - Assess user intent: only run health.sh if changes are needed
   - tasks.get('in_progress') → resume if something is in progress
   - tasks.get('pending') → pick lowest id

2. WORK  (lead → explorer → consultant → builder → reviewer)
     - Each agent calls actions.start(taskId, agentName) → numeric actionId
     - Closes with actions.complete(actionId, summary)

3. CLOSE
     - tasks.update(taskId, 'done')
     - Run health.sh (if changes were made) → must be green before closing
```

## Agent roles

| Agent | Responsibility |
|-------|---------------|
| lead | Decomposes the task into a plan, assigns sub-agents |
| explorer | Reads and maps relevant code, never writes |
| consultant | Technical advisor, runs after explorer, before builder. Never writes code. |
| builder | Implements the plan, writes files |
| reviewer | Verifies acceptance criteria, approves or blocks |

## What to read

```
Always:         MCP tasks.get. If MCP is unavailable, stop and ask the user to restore the MCP connection.
If implementing: ./docs/
If orchestrating: Agent definition files in your provider's agents directory
```

<!-- ahk:generated b3d8a46a5766db95309f53442dcdaf6974045ef64b62aec0f3212bad65ce8ece -->
