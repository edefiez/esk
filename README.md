# esk

> The package manager for your Claude Code agents

**esk** manages your Claude Code agents and skills: creation, installation, multi-source search, and GitHub synchronization.

```bash
npm install -g esk
esk github:login
esk github:registry set your-username/esk-registry
esk init
```

---

## Installation

```bash
npm install -g esk
```

**Requirements:** Node.js 18+

---

## Quick start

```bash
# 1. Connect to GitHub (OAuth Device Flow — opens browser)
esk github:login

# 2. Set your private registry
esk github:registry set your-username/esk-registry

# 3. Initialize a project
cd my-project
esk init
```

---

## Commands

### Authentication

| Command | Description | Example |
|---------|-------------|---------|
| `esk github:login` | OAuth Device Flow — opens browser | `esk github:login` |
| `esk github:logout` | Disconnect from GitHub | `esk github:logout` |
| `esk github:status` | Check connection status | `esk github:status --json` |
| `esk github:registry set <repo>` | Set the private GitHub registry | `esk github:registry set edefiez/esk-registry` |
| `esk github:registry get` | Show configured registry | `esk github:registry get` |
| `esk registry:init` | Create a new registry repo on GitHub with base structure | `esk registry:init --name my-registry` |

### Agents

| Command | Description | Example |
|---------|-------------|---------|
| `esk agent:list` | List all agents in the registry | `esk agent:list --json` |
| `esk agent:show <id>` | Show agent details + skills | `esk agent:show backend-dev` |
| `esk agent:create` | Create a new agent (interactive or `--yes`) | `esk agent:create --id carlos --name Carlos --role "GraphQL Expert" --model claude-sonnet-4-6 --yes` |
| `esk agent:add-skill <agent> <skill>` | Assign a skill to an agent | `esk agent:add-skill backend-dev graphql-api` |
| `esk agent:remove-skill <agent> <skill>` | Remove a skill from an agent | `esk agent:remove-skill backend-dev graphql-api` |
| `esk agent:fork <repo> <agentId>` | Fork an agent and its skills from another registry | `esk agent:fork johndoe/esk-registry backend-dev --skills` |
| `esk agent:compose <agentId>` | Interactively recompose an agent's skills with prompt preview | `esk agent:compose backend-dev --publish` |
| `esk agent:publish <id>` | Push to GitHub | `esk agent:publish backend-dev --json` |

### Skills

| Command | Description | Example |
|---------|-------------|---------|
| `esk skill:list` | List skills (`--category` to filter) | `esk skill:list --category backend` |
| `esk skill:search <query>` | Multi-source search (`--all`, `--source`) | `esk skill:search "graphql" --all` |
| `esk skill:create` | Create a new skill (interactive or `--yes`) | `esk skill:create --id stripe-webhooks --category backend --description "Stripe webhook handling" --yes` |
| `esk skill:import <repo> <id>` | Import from a third-party registry | `esk skill:import johndoe/esk-registry graphql --install` |
| `esk skill:publish <id>` | Publish to GitHub | `esk skill:publish stripe-webhooks` |
| `esk skill:fork <repo> <skillId>` | Fork a skill from a third-party registry into your own | `esk skill:fork johndoe/esk-registry graphql-api` |
| `esk skill:test <skillId>` | Test a skill by running Claude Code with only that skill loaded | `esk skill:test graphql-api --print` |
| `esk skill:add <agent> <skill>` | Assign skill to agent in the global registry | `esk skill:add backend-dev graphql-api` |

### Project management

| Command | Description | Example |
|---------|-------------|---------|
| `esk init` | Initialize `.claude/` (interactive) | `esk init --yes` |
| `esk project:status` | Full project audit | `esk project:status --json` |
| `esk project:reconcile` | Reconcile skills↔agents (`--dry-run`, `--yes`) | `esk project:reconcile --dry-run --json` |
| `esk project:agent:add <id>` | Add an agent to the project | `esk project:agent:add backend-dev --install-skills` |
| `esk project:agent:remove <id>` | Remove an agent from the project | `esk project:agent:remove backend-dev` |
| `esk project:agent:add-skill <a> <sk>` | Assign skill → agent (`--install`) | `esk project:agent:add-skill backend-dev graphql --install` |
| `esk project:agent:status <id>` | Show active skills for an agent | `esk project:agent:status backend-dev --json` |
| `esk project:skill:install <id>` | Install a skill from the registry | `esk project:skill:install graphql --agent backend-dev --yes` |
| `esk project:skill:create` | Create + install locally | `esk project:skill:create --id my-skill --category backend --yes` |
| `esk project:skill:publish <id>` | Promote to the registry | `esk project:skill:publish my-skill` |
| `esk upgrade` | Update installed skills in `.claude/` when registry has newer versions | `esk upgrade --dry-run` |
| `esk diff <skillId>` | Compare a local skill with the registry version | `esk diff graphql-api` |

### Discovery

| Command | Description | Example |
|---------|-------------|---------|
| `esk discover` | Explore the current project | `esk discover` |
| `esk discover <./path>` | Explore a local directory | `esk discover ./my-registry` |
| `esk discover <user/repo>` | Explore a GitHub registry | `esk discover edefiez/esk-registry` |
| `esk discover --all` | Browse all public esk registries | `esk discover --all` |

### Sources

| Command | Description | Example |
|---------|-------------|---------|
| `esk source:list` | List configured sources | `esk source:list --json` |
| `esk source:add <repo>` | Add a third-party registry | `esk source:add johndoe/esk-registry --label "John's skills"` |
| `esk source:enable <id>` | Enable a source | `esk source:enable claude-community` |
| `esk source:disable <id>` | Disable a source | `esk source:disable broad` |
| `esk source:remove <id>` | Remove a source | `esk source:remove johndoe-esk-registry` |

### Preferences

| Command | Description | Example |
|---------|-------------|---------|
| `esk config:get` | View preferences | `esk config:get markdownView` |
| `esk config:set <key> <value>` | Set a preference | `esk config:set markdownView raw` |

---

## Agent mode (non-interactive)

All commands support `--yes` and `--json` for use by a Claude Code agent:

```bash
# Usable directly by an orchestrator agent
esk project:status --json
esk skill:search "graphql" --json
esk project:skill:install graphql --agent backend-dev --yes --json
esk project:skill:create --id "stripe-webhooks" --category backend \
  --description "Stripe webhook handling" --agent backend-dev --yes --json
```

---

## Forking

Fork skills and agents from any third-party registry into your own. This lets you use someone else's work as a starting point, customize it, and publish your version.

**Fork a skill:**

```bash
# Copy a skill from another registry into yours
esk skill:fork johndoe/esk-registry graphql-api

# Edit the forked skill locally, then publish your version
esk skill:publish graphql-api
```

**Fork an agent (with its skills):**

```bash
# Fork an agent and all its associated skills
esk agent:fork johndoe/esk-registry backend-dev --skills

# Recompose the agent's skills to fit your needs
esk agent:compose backend-dev --publish
```

Forked items are fully owned by you once they land in your registry -- you can modify, rename, or extend them freely.

---

## Search sources

`esk skill:search` searches across multiple sources in parallel:

| Source | Type | Description |
|--------|------|-------------|
| Your private registry | `github-repo` | Your private repo |
| esk Ecosystem | `topic: esk-registry` | Public repos tagged `esk-registry` |
| Anthropic Official Plugins | `anthropics/claude-plugins-official` | Official plugins |
| Claude Code Community | `topic: claude-code + skills` | All public community repos |
| Broad search | `topic: skills` | Wide search (disabled by default) |

To make your registry discoverable: add the `esk-registry` topic to your GitHub repo.

---

## Registry structure

```
your-registry/
├── registry.json          # Agent + skill catalog
├── agents/
│   ├── orchestrator.md    # Full system prompt
│   └── backend-dev.md
└── skills/
    ├── perso/
    │   └── start-session/SKILL.md
    ├── backend/
    │   └── nestjs-best-practices/SKILL.md
    └── projects/
        └── my-project/SKILL.md
```

---

## Project structure

```
my-project/
├── .claude/
│   ├── esk.json           # Project manifest
│   ├── agents/
│   │   ├── orchestrator.md     # Agent system prompt
│   │   └── backend-dev.md
│   └── skills/
│       ├── graphql/SKILL.md
│       └── nestjs-patterns/SKILL.md
└── ... other project files
```

---

## The `esk-usage` skill

Load `skills/esk-usage/SKILL.md` into your orchestrator so it can autonomously manage agents and skills during a session.

---

## Documentation

Detailed documentation is available in the [`docs/`](./docs/) folder:

- [Authentication & GitHub](./docs/authentication.md) — GitHub OAuth, registry setup
- [Agents](./docs/agents.md) — Creating, managing, and publishing agents
- [Skills](./docs/skills.md) — Creating, searching, importing, and publishing skills
- [Project Management](./docs/project.md) — Initializing projects, reconciliation
- [Sources](./docs/sources.md) — Managing skill search sources
- [Discovery](./docs/discovery.md) — Exploring registries and projects
- [Forking](./docs/forking.md) — Forking skills and agents from other registries
- [Preferences](./docs/preferences.md) — User configuration


---

## License

MIT — [Eric Defiez](https://github.com/edefiez)

---

*Built with [Claude Code](https://claude.ai/code) · [esk.sh](https://esk.sh)*
