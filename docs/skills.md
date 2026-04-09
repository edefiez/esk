# Skills

Skills are reusable knowledge modules (SKILL.md files) that provide agents with domain-specific expertise. They are stored in the registry organized by category.

---

## List skills

```bash
esk skill:list
```

**Example output:**
```
🛠️  Skills (15)
────────────────────────────────────────────────

  BACKEND
    nestjs-best-practices              NestJS architecture, modules, DI
    prisma-client-api                  Prisma Client API patterns
    graphql-api                        GraphQL schema & resolvers

  FRONTEND
    vue                                Vue 3 Composition API patterns
    nuxt                               Nuxt 3 server routes, middleware
```

### Filter by category

```bash
esk skill:list --category backend
esk skill:list --category frontend
esk skill:list --category projects/dashkitchen
```

### JSON mode

```bash
esk skill:list --json
esk skill:list --json --category backend
```

---

## Search for skills

Multi-source search across all configured sources:

```bash
esk skill:search "graphql"
```

**Example output:**
```
🔍  Searching "graphql" across 4 sources...

🔍  3 result(s)
────────────────────────────────────────────────

  ▸ My private registry
      graphql-api                      GraphQL schema & resolvers
      repo: edefiez/esk-registry

  ▸ Claude Code Community
      graphql-tools                    GraphQL tooling & codegen
      repo: community/skills-pack
```

### Include all sources (including broad)

```bash
esk skill:search "graphql" --all
```

### Limit to a specific source

```bash
esk skill:search "graphql" --source anthropic-official
```

### JSON mode

```bash
esk skill:search "graphql" --json
```

---

## Create a skill

### Interactive mode

```bash
esk skill:create
```

You'll be prompted for:
- Skill ID (e.g. `graphql-resolvers`)
- Display label
- Category
- Short description

### Non-interactive mode

```bash
esk skill:create \
  --id "stripe-webhooks" \
  --label "Stripe Webhooks" \
  --category backend \
  --description "Stripe webhook handling and event processing" \
  --yes
```

### Create and install locally

```bash
esk skill:create \
  --id "stripe-webhooks" \
  --category backend \
  --description "Stripe webhook handling" \
  --install \
  --yes
```

Creates the SKILL.md file in `.claude/skills/stripe-webhooks/SKILL.md`.

### Create and publish to GitHub

```bash
esk skill:create \
  --id "stripe-webhooks" \
  --category backend \
  --description "Stripe webhook handling" \
  --publish \
  --yes --json
```

---

## Import a skill from a third-party registry

```bash
esk skill:import johndoe/esk-registry graphql-tools
```

### Import and install locally

```bash
esk skill:import johndoe/esk-registry graphql-tools --install
```

**Example output:**
```
  ✓ Imported and installed in .claude/skills/graphql-tools/
```

---

## Publish a local skill

Promote a skill from your local `.claude/skills/` to the GitHub registry:

```bash
esk skill:publish stripe-webhooks
```

You'll be asked to confirm. Use `--yes` to skip:

```bash
esk skill:publish stripe-webhooks --yes --json
```

---

## Assign a skill to an agent in the global registry

```bash
esk skill:add jerome graphql-api
```

**Example output:**
```
  ✓ Skill graphql-api → agent jerome
```

---

## SKILL.md template

When you create a skill, esk generates a template:

```markdown
# Stripe Webhooks

## Description
Stripe webhook handling and event processing

## When to use this skill
<!-- Describe in which contexts this skill should be activated -->

## Instructions
<!-- Detailed instructions for the agent -->

## Examples
<!-- Usage examples -->

## Notes
- Skill ID: `stripe-webhooks`
- Category: `backend`
- Created with [esk](https://esk.sh)
```

---

## Skill categories

Default categories available:
- `perso` — Personal/session management
- `meta` — Meta-skills (planning, dispatching)
- `quality` — Code review, debugging, verification
- `tooling` — Git, pnpm, turborepo, vite
- `backend` — NestJS, Prisma, GraphQL, etc.
- `frontend` — Vue, Nuxt, Pinia, etc.
- `flutter` — Flutter, Riverpod, animations
- `devops` — Infrastructure, deployment
- `projects/<name>` — Project-specific skills
- `other` — Uncategorized
