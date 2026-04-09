# Project Management

esk manages a `.claude/` directory in your project that contains agent prompts, installed skills, and an `esk.json` manifest.

---

## Initialize a project

```bash
cd my-project
esk init
```

Interactive mode will:
1. Ask for a project name
2. Let you select agents from the registry
3. For each agent, let you choose which skills to enable
4. Download all SKILL.md files from GitHub
5. Generate agent system prompts
6. Create the `esk.json` manifest

### Non-interactive mode

```bash
esk init --yes
```

Installs all agents with their default skills.

**Example output:**
```
  ✦ my-project — initialization complete

  ✓ 3 agent(s) configured
  ✓ 24 skill(s) installed
  ⚠ 2 skill(s) not found in the registry

  Next steps:
    esk project:status       → project audit
    esk skill:search <query> → find skills
```

---

## Project status

Get a full audit of the current project:

```bash
esk project:status
```

**Example output:**
```
  Directory: /Users/me/my-project/.claude

🤖  Agents
────────────────────────────────────────────────
  ✓ orchestrator        start-session, end-session, writing-plans, ...
  ✓ backend-dev         nestjs-best-practices, prisma-client-api, ...
  ✗ file missing   reviewer

🛠️  Installed skills
────────────────────────────────────────────────
  ✓ start-session
  ✓ end-session
  ✓ nestjs-best-practices
  ✓ prisma-client-api
  ...
```

### JSON mode

```bash
esk project:status --json
```

---

## Add an agent to the project

```bash
esk project:agent:add backend-dev
```

Downloads the agent's system prompt from the registry and adds it to `.claude/agents/`.

### Also install default skills

```bash
esk project:agent:add backend-dev --install-skills
```

---

## Remove an agent from the project

```bash
esk project:agent:remove backend-dev
```

Removes the `.md` file and updates `esk.json`.

---

## Assign a skill to an agent

```bash
esk project:agent:add-skill backend-dev graphql --install
```

The `--install` flag also downloads the SKILL.md if it's not already installed.

---

## View active skills for an agent

```bash
esk project:agent:status backend-dev
```

**Example output:**
```
🤖  backend-dev — Active skills
────────────────────────────────────────────────
  ✓ nestjs-best-practices
  ✓ prisma-client-api
  ✓ graphql
```

---

## Install a skill from the registry

```bash
esk project:skill:install graphql
```

Downloads the SKILL.md file from GitHub into `.claude/skills/graphql/SKILL.md`.

### Install and assign to an agent

```bash
esk project:skill:install graphql --agent backend-dev --yes
```

---

## Publish a local skill to the registry

Promote a skill you created locally to the GitHub registry:

```bash
esk project:skill:publish my-custom-skill
```

---

## Upgrade skills from the registry

**upgrade**: Update installed skills from the registry when newer versions exist.
```bash
esk upgrade              # interactive selection
esk upgrade --dry-run    # preview without applying
esk upgrade --yes        # apply all updates
```
Compares each local SKILL.md with the registry version, shows a report (up-to-date, outdated, local-only), and lets you selectively upgrade.

---

## Reconcile skills and agents

When a project has agents and skills on disk but the `esk.json` manifest is incomplete or missing:

### Preview the reconciliation plan

```bash
esk project:reconcile --dry-run
```

**Example output:**
```
  ◈ Project Reconciliation
  ──────────────────────────────────────────────────────────

  Agents on disk     : orchestrator, backend-dev, reviewer
  Skills on disk     : 24 skill(s)
  Agents in esk.json : 0

  ⚠ Unassigned skills: code-review, verification

🔗  Suggested associations (3 agent(s))
────────────────────────────────────────────────

  🤖 Orchestrator — Lead Developer & Task Coordinator
     ✓ Registry : start-session, end-session, writing-plans
     ? Disk     : custom-tool

  🤖 Backend Dev — Backend Senior Engineer
     ✓ Registry : nestjs-best-practices, prisma-client-api
```

### Apply automatically

```bash
esk project:reconcile --yes
```

In `--yes` mode, only **registry** associations (high confidence) are applied automatically. **Disk-only** suggestions are skipped.

### Interactive approval

```bash
esk project:reconcile
```

For each agent, you can select which skills to assign. Registry suggestions are pre-checked, disk-only suggestions are unchecked.

---

## Project structure

```
my-project/
├── .claude/
│   ├── esk.json              # Project manifest
│   ├── agents/
│   │   ├── orchestrator.md        # Agent system prompt
│   │   ├── backend-dev.md
│   │   └── reviewer.md
│   └── skills/
│       ├── graphql/
│       │   └── SKILL.md
│       ├── nestjs-best-practices/
│       │   └── SKILL.md
│       └── ...
└── ... other project files
```

### esk.json format

```json
{
  "project": "my-project",
  "agents": [
    { "id": "orchestrator", "name": "Orchestrator", "skills": ["start-session", "end-session"] },
    { "id": "backend-dev", "skills": ["nestjs-best-practices", "prisma-client-api"] }
  ],
  "skills": ["start-session", "end-session", "nestjs-best-practices", "prisma-client-api"]
}
```
