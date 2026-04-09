# ESK — Agent Usage Guide

## Description
This skill gives the orchestrator full knowledge of the `esk` tool
to manage agents and skills during a work session.

## When to use this skill

- **At start-session**: audit the project state with `esk project:status --json`
- **When an agent is missing a skill**: search and install the right skill
- **When a skill doesn't exist**: create it directly from the session
- **When an agent's composition needs to change**: add/remove skills

## Important rules

- Always use `--yes` in agent mode (no interactive prompts)
- Always use `--json` to parse results programmatically
- Read the SKILL.md after installation before delegating the task
- Prefer `--install` to test a skill locally before `--publish`

## Available commands

### Audit & Status
```bash
# Full current project status
esk project:status --json

# Active skills for a specific agent
esk project:agent:status backend-dev --json

# List all skills in the registry
esk skill:list --json
esk skill:list --json --category backend
```

### Skill search
```bash
# Multi-source search (esk-registry + Anthropic official + community)
esk skill:search "graphql" --json

# Extended search (all sources)
esk skill:search "graphql" --all --json

# On a specific source
esk skill:search "graphql" --source anthropic-official --json
```

### Install a skill in the current project
```bash
# From the registry
esk project:skill:install graphql --yes --json

# From the registry + assign to an agent
esk project:skill:install graphql --agent backend-dev --yes --json
```

### Import a skill from a third-party registry
```bash
esk skill:import johndoe/esk-registry graphql --install --yes --json
```

### Create a new skill
```bash
# Local only (for testing)
esk project:skill:create \
  --id "graphql-resolvers" \
  --category backend \
  --description "GraphQL Apollo resolver management" \
  --agent backend-dev \
  --yes --json

# Local + published to the global registry
esk project:skill:create \
  --id "graphql-resolvers" \
  --category backend \
  --description "GraphQL Apollo resolver management" \
  --publish \
  --yes --json
```

### Agent management

```bash
# List agents in the registry
esk agent:list --json

# Agent details and skills
esk agent:show backend-dev --json

# Add an agent to the current project
esk project:agent:add backend-dev --install-skills --yes --json

# Assign a skill to an agent in this project
esk project:agent:add-skill backend-dev graphql --install --yes --json

# Remove a skill from an agent
esk agent:remove-skill backend-dev graphql --yes --json
```

### Create a new agent
```bash
esk agent:create \
  --id "carlos" \
  --name "Carlos" \
  --role "GraphQL Expert" \
  --model "claude-sonnet-4-6" \
  --skills "graphql-resolvers,nestjs-best-practices" \
  --publish \
  --yes --json
```

## Typical session workflow

```
1. At startup:
   esk project:status --json
   → Identify active agents and missing skills

2. If a skill is missing:
   esk skill:search "<query>" --json
   → Choose the best source
   esk project:skill:install <id> --agent <agent> --yes --json

3. If the skill doesn't exist anywhere:
   esk project:skill:create --id <id> --category <cat> --description "<desc>" --yes --json
   → Read .claude/skills/<id>/SKILL.md
   → Delegate the task to the relevant agent

4. When the skill is validated:
   esk skill:publish <id> --yes --json
   → Available for all future projects
```

## JSON response format

All commands with `--json` return:
```json
{
  "success": true,
  "action": "skill:install",
  "id": "graphql",
  "path": ".claude/skills/graphql/SKILL.md",
  "published": false
}
```

On error:
```json
{
  "success": false,
  "error": "SKILL.md not found in the registry"
}
```

---

## Reconciling an existing project

### When to use
When you arrive on a project that already has agents and skills in `.claude/`
but whose `esk.json` is missing or incomplete — associations are not
formalized. Reconciliation analyzes the gap and proposes a plan.

### Command

```bash
# View the plan without applying anything
esk project:reconcile --dry-run --json

# Apply automatically (agent mode)
esk project:reconcile --yes --json
```

### Recommended start-session workflow on an existing project

```bash
# 1. See the raw state
esk project:status --json

# 2. If esk.json is empty or missing → reconcile
esk project:reconcile --dry-run --json
# → Inspect the proposed plan

# 3. Apply if the plan is consistent
esk project:reconcile --yes --json

# 4. Verify the result
esk project:status --json
```

### JSON return format

```json
{
  "status": "applied",
  "applied": 8,
  "details": [
    { "agent": "orchestrator", "skills": ["start-session", "end-session", "writing-plans"] },
    { "agent": "backend-dev",  "skills": ["nestjs-best-practices", "prisma-cli"] }
  ]
}
```

### Trust logic

Reconcile distinguishes two types of suggestions:
- **✓ Registry** (pre-checked) — the GitHub registry officially associates this skill with this agent → high confidence
- **? Disk** (unchecked) — skill present on disk but not in the registry → requires manual validation

In `--yes` mode, only **registry** associations are applied automatically.
