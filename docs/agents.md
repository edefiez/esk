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
  Orchestrator  Lead Developer & Task Coordinator   claude-opus-4-6       6 skills
  Backend Dev   Backend Senior Engineer              claude-opus-4-6       3 skills
  Reviewer      Code Reviewer                       claude-sonnet-4-6     4 skills
```

### JSON mode

```bash
esk agent:list --json
```

---

## Show agent details

```bash
esk agent:show backend-dev
```

**Example output:**
```
  ● Backend Dev — Backend Senior Engineer
    Model: claude-opus-4-6

🛠️  Skills (3)
────────────────────────────────────────────────
  ✓ nestjs-best-practices              NestJS architecture, modules, DI...
  ✓ prisma-client-api                  Prisma Client API patterns
  ✓ graphql-api                        GraphQL schema & resolvers
  ...
```

### JSON mode

```bash
esk agent:show backend-dev --json
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
esk agent:add-skill backend-dev graphql-api
```

This updates `registry.json` on GitHub, adding the skill to the agent's `defaultSkills` array.

**Example output:**
```
  ✓ graphql-api → backend-dev
```

---

## Remove a skill from an agent

```bash
esk agent:remove-skill backend-dev graphql-api
```

**Example output:**
```
  ✓ Skill graphql-api removed from backend-dev
```

---

## Publish an agent

Regenerate the agent's system prompt from the current registry state and push to GitHub:

```bash
esk agent:publish backend-dev
```

This will:
1. Read the agent's current skills from `registry.json`
2. Generate a new system prompt (`agents/backend-dev.md`)
3. Push to GitHub

**Example output:**
```
  ✓ Agent backend-dev published
```

---

## Agent models

| Model | ID | Best for |
|-------|-----|----------|
| Claude Opus 4.6 | `claude-opus-4-6` | Complex reasoning, orchestration |
| Claude Sonnet 4.6 | `claude-sonnet-4-6` | Balanced performance and speed |
| Claude Haiku 4.5 | `claude-haiku-4-5` | Fast tasks, lightweight operations |

---

## Fork an agent

**agent:fork**: Fork an agent and its skills from another registry into yours.
```bash
esk agent:fork johndoe/esk-registry backend-dev --skills
```
Copies the agent definition, system prompt, and optionally all associated skills. Adds `forkedFrom` metadata. You can then edit freely.

---

## Compose an agent

**agent:compose**: Interactively recompose an agent's skills with a live prompt preview.
```bash
esk agent:compose backend-dev
esk agent:compose backend-dev --publish
```
Shows current skills, lets you add/remove with checkboxes, previews the generated prompt, and applies changes to registry + local project.

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
