# Preferences

esk stores user preferences in `~/.esk/config.json`. You can view and modify them with the `config` commands.

---

## View all preferences

```bash
esk config:get
```

**Example output:**
```
  esk Preferences

  markdownView         rendered

  Update: esk config:set markdownView [raw|rendered|both]
```

---

## View a specific preference

```bash
esk config:get markdownView
```

**Example output:**
```
markdownView = rendered
```

---

## Set a preference

```bash
esk config:set markdownView raw
```

**Example output:**
```
  ✓ markdownView = raw
```

---

## Available preferences

| Key | Values | Default | Description |
|-----|--------|---------|-------------|
| `markdownView` | `raw`, `rendered`, `both` | `rendered` | How SKILL.md and agent prompts are displayed in the terminal during `discover` |

### markdownView options

- **`rendered`** — Colored terminal rendering using `marked-terminal`. Best for reading.
  ```bash
  esk config:set markdownView rendered
  ```

- **`raw`** — Raw markdown source. Useful for copying or debugging.
  ```bash
  esk config:set markdownView raw
  ```

- **`both`** — Shows both raw and rendered versions. Useful for comparing.
  ```bash
  esk config:set markdownView both
  ```

---

## Configuration file

All preferences are stored under the `preferences` key in `~/.esk/config.json`:

```json
{
  "preferences": {
    "markdownView": "rendered"
  }
}
```

You can also edit this file directly, but using `esk config:set` ensures validation of keys and values.

---

## Global options

These options are available on all esk commands:

| Option | Description | Example |
|--------|-------------|---------|
| `--yes` | Skip interactive prompts (agent mode) | `esk init --yes` |
| `--json` | Parsable JSON output (agent mode) | `esk project:status --json` |

These are especially useful when esk is used by an orchestrator agent (like Sofiane) that needs non-interactive, machine-readable output.
