# Agents

Agents are Claude Code personas with a defined role, model, and set of skills. Each agent has a system prompt (`.md` file) that is generated from its configuration.

---

## List agents

```bash
esk agent:list
```

**Example output:**
```
🤖  Agents (3)
────────────────────────────────────────────────

  NAME        ROLE                                  MODEL                 SKILLS
  ──────────────────────────────────────────────────────────────────────────────────
  Sofiane     Lead Dev Full-Stack & Orchestrator    claude-opus-4-6       12 skills
  Jerome      Backend Senior                        claude-opus-4-6       8 skills
  Bruno       Code Reviewer                         claude-sonnet-4-6     4 skills
```

### JSON mode

```bash
esk agent:list --json
```

---

## Show agent details

```bash
esk agent:show jerome
```

**Example output:**
```
  ● Jerome — Backend Senior
    Model: claude-opus-4-6

🛠️  Skills (8)
────────────────────────────────────────────────
  ✓ nestjs-best-practices              NestJS architecture, modules, DI...
  ✓ prisma-client-api                  Prisma Client API patterns
  ✓ graphql-api                        GraphQL schema & resolvers
  ...
```

### JSON mode

```bash
esk agent:show jerome --json
```

---

## Create an agent

### Interactive mode

```bash
esk agent:create
```

You'll be prompted for:
- Agent name (e.g. "Carlos")
- ID (auto-generated slug)
- Role (e.g. "GraphQL Expert")
- Claude model (Opus 4.6 / Sonnet 4.6 / Haiku 4.5)
- Description (optional)
- Skills to assign (from registry)

### Non-interactive mode

```bash
esk agent:create \
  --id carlos \
  --name "Carlos" \
  --role "GraphQL Expert" \
  --model claude-sonnet-4-6 \
  --skills "graphql-api,nestjs-best-practices" \
  --description "Specialist in GraphQL schema design and resolvers" \
  --yes
```

### Create and publish in one step

```bash
esk agent:create \
  --id carlos \
  --name "Carlos" \
  --role "GraphQL Expert" \
  --model claude-sonnet-4-6 \
  --skills "graphql-api" \
  --publish \
  --yes --json
```

This will:
1. Add the agent to `registry.json` on GitHub
2. Create `agents/carlos.md` with the generated system prompt

---

## Add a skill to an agent

```bash
esk agent:add-skill jerome graphql-api
```

This updates `registry.json` on GitHub, adding the skill to the agent's `defaultSkills` array.

**Example output:**
```
  ✓ graphql-api → jerome
```

---

## Remove a skill from an agent

```bash
esk agent:remove-skill jerome graphql-api
```

**Example output:**
```
  ✓ Skill graphql-api removed from jerome
```

---

## Publish an agent

Regenerate the agent's system prompt from the current registry state and push to GitHub:

```bash
esk agent:publish jerome
```

This will:
1. Read the agent's current skills from `registry.json`
2. Generate a new system prompt (`agents/jerome.md`)
3. Push to GitHub

**Example output:**
```
  ✓ Agent jerome published
```

---

## Agent models

| Model | ID | Best for |
|-------|-----|----------|
| Claude Opus 4.6 | `claude-opus-4-6` | Complex reasoning, orchestration |
| Claude Sonnet 4.6 | `claude-sonnet-4-6` | Balanced performance and speed |
| Claude Haiku 4.5 | `claude-haiku-4-5` | Fast tasks, lightweight operations |

---

## Agent system prompt format

Generated prompts follow this structure:

```markdown
# Carlos — GraphQL Expert

**Model:** claude-sonnet-4-6

Specialist in GraphQL schema design and resolvers

## Loaded skills

- **graphql-api** — GraphQL schema & resolvers
- **nestjs-best-practices** — NestJS architecture, modules, DI

> Refer to the corresponding SKILL.md files in `.claude/skills/`.
```
