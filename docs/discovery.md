# Discovery

The `discover` command lets you explore registries and projects interactively — browse agents, read skill files, import skills, and add sources.

---

## Explore the current project

```bash
esk discover
```

Scans the current directory for `.claude/` and `registry.json`, then shows:
- Project info (from `package.json`)
- `.claude/` status
- Installed agents and skills
- An interactive navigation menu

**Example output:**
```
  ◈ Discovery — local  /Users/me/my-project
  ──────────────────────────────────────────────────────────

  Project   : my-project v1.0.0
  .claude/  : ✓ present
  esk.json  : ✓ my-project
  registry  : — missing

🤖  Installed agents (2)
────────────────────────────────────────────────
  ✓ sofiane          Sofiane — Lead Dev Full-Stack            12 skills
  ✓ jerome           Jerome — Backend Senior                  8 skills

🛠️  Installed skills (24)
────────────────────────────────────────────────
  ✓ start-session
  ✓ nestjs-best-practices
  ...
```

### Interactive navigation

After the scan, you can:
- View an agent's system prompt (rendered in terminal)
- Read a SKILL.md file
- Change the markdown display format (raw / rendered / both)

---

## Explore a local directory

```bash
esk discover ./my-registry
esk discover ~/Projects/other-project
```

---

## Explore a GitHub registry

```bash
esk discover edefiez/esk-registry
```

**Example output:**
```
  ◈ Discovery — github  edefiez/esk-registry
  ──────────────────────────────────────────────────────────

  Repo      : github.com/edefiez/esk-registry
  Visibility: 🔒 private
  Topics    : esk-registry
  registry  : ✓ registry.json v1.0.0

🤖  Agents (12)
────────────────────────────────────────────────
  Sofiane       Lead Dev Full-Stack & Orchestrator    claude-opus-4-6    12 skills
  Jerome        Backend Senior                        claude-opus-4-6    8 skills
  ...

🛠️  Skills (59)
────────────────────────────────────────────────
  perso                  esk-usage, start-session, end-session
  backend                nestjs-best-practices, prisma-client-api, ...
  frontend               vue, nuxt, pinia
  ...
```

### Interactive actions

When exploring a remote registry, you can:
- **Read a skill** — downloads and renders the SKILL.md in terminal
- **Import skills** — select skills to download and install locally
- **Add as trusted source** — adds the repo to your source list
- **Change display format** — switch between raw/rendered/both

---

## Browse all public esk registries

```bash
esk discover --all
```

Searches GitHub for all repositories tagged with `esk-registry` and lists them:

**Example output:**
```
  ◈ Discovery — Public esk registries
  ──────────────────────────────────────────────────────────
  5 registries found

  edefiez/esk-registry                         ★ 12
    Full-stack agent registry with NestJS, Vue, Flutter skills
  johndoe/esk-skills                           ★ 8
    Community skill pack for Claude Code
  ...
```

You can then select one to explore in detail.

---

## Markdown display format

esk renders SKILL.md and agent prompts in the terminal. You can choose the format:

| Format | Description |
|--------|-------------|
| `rendered` | Colored terminal rendering (default) |
| `raw` | Raw markdown source |
| `both` | Show both raw and rendered side by side |

### Change format during discovery

Select "Change display format" from the interactive menu.

### Change format globally

```bash
esk config:set markdownView raw
```

### Override for a single session

```bash
esk discover edefiez/esk-registry --format raw
```

---

## Import skills during discovery

When browsing a remote registry, select "Import skills" to:

1. Choose which skills to import (checkbox selection)
2. Optionally install them in the current project's `.claude/`
3. Get confirmation of what was imported

**Example:**
```
? Skills to import:
  ✓ graphql-api                      GraphQL schema & resolvers
  ✓ nestjs-best-practices            NestJS architecture, modules, DI
    prisma-client-api                Prisma Client API patterns

? Install in the current project .claude/? Yes

  ✓ 2 skill(s) imported: graphql-api, nestjs-best-practices
```

---

## JSON mode

```bash
esk discover edefiez/esk-registry --json
```

Returns the full scan result as JSON for programmatic use.
