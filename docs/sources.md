# Sources

Sources define where esk searches for skills. By default, esk comes with 5 pre-configured sources that cover private registries, the esk ecosystem, Anthropic official plugins, and the wider Claude Code community.

---

## List configured sources

```bash
esk source:list
```

**Example output:**
```
🔗  Configured sources

  ✓ private                My private registry               [private]
      repo: edefiez/esk-registry
  ✓ esk-ecosystem          esk Ecosystem
      topic: esk-registry
  ✓ anthropic-official     Anthropic Official Plugins        [OFFICIAL]
      repo: anthropics/claude-plugins-official
  ✓ claude-community       Claude Code Community
      topics: claude-code, skills
  ○ broad                  Broad search (skills)
      topics: skills
```

### JSON mode

```bash
esk source:list --json
```

---

## Default sources

| ID | Type | Description | Enabled |
|----|------|-------------|---------|
| `private` | `github-repo` | Your private registry (set via `github:registry set`) | Yes |
| `esk-ecosystem` | `github-topic` | Public repos tagged `esk-registry` | Yes |
| `anthropic-official` | `github-repo` | `anthropics/claude-plugins-official` | Yes |
| `claude-community` | `github-topics` | Repos tagged `claude-code` + `skills` | Yes |
| `broad` | `github-topics` | Any repo tagged `skills` | No |

---

## Add a third-party registry

```bash
esk source:add johndoe/esk-registry
```

**Example output:**
```
  ✓ Source johndoe/esk-registry added
```

### With a custom label

```bash
esk source:add johndoe/esk-registry --label "John's Skills"
```

### Private registry

```bash
esk source:add myorg/private-skills --private
```

---

## Enable a source

```bash
esk source:enable broad
```

**Example output:**
```
  ✓ Source broad enabled
```

---

## Disable a source

```bash
esk source:disable claude-community
```

**Example output:**
```
  ✓ Source claude-community disabled
```

---

## Remove a source

```bash
esk source:remove johndoe-esk-registry
```

**Example output:**
```
  ✓ Source johndoe-esk-registry removed
```

---

## How search works

When you run `esk skill:search "graphql"`, esk queries all enabled sources in parallel:

1. **`github-repo`** sources — reads `registry.json` directly from the repo
2. **`github-topic`** sources — searches GitHub for repos matching the topic, then reads each repo's `registry.json`
3. **`github-topics`** sources — same as above but with multiple topics combined

Results are deduplicated by skill ID + repo and displayed grouped by source.

### Search with all sources (including broad)

```bash
esk skill:search "graphql" --all
```

### Search on a specific source

```bash
esk skill:search "graphql" --source anthropic-official
```

---

## Making your registry discoverable

To make your esk registry appear in ecosystem searches, add the `esk-registry` topic to your GitHub repo:

1. Go to your repo on GitHub
2. Click the gear icon next to "About"
3. Add `esk-registry` to the Topics field
4. Save

Your registry will now be discoverable via `esk discover --all` and `esk skill:search`.

---

## Source configuration in config.json

Sources are stored in `~/.esk/config.json`:

```json
{
  "sources": [
    {
      "id": "private",
      "type": "github-repo",
      "label": "My private registry",
      "repo": null,
      "private": true,
      "priority": 1,
      "enabled": true
    },
    {
      "id": "esk-ecosystem",
      "type": "github-topic",
      "label": "esk Ecosystem",
      "topic": "esk-registry",
      "priority": 2,
      "enabled": true
    }
  ]
}
```
