# Forking

Forking lets you copy skills and agents from third-party registries into your own, so you can customize them freely.

---

## Fork a skill

```bash
esk skill:fork johndoe/esk-registry graphql-api
```

This will:
1. Download the SKILL.md from the source registry
2. Push it to your own registry under the same category
3. Add the skill to your registry.json with `forkedFrom` metadata
4. You can now edit it freely — it's yours

**Example output:**
```
  ✓ Skill graphql-api forked from johndoe/esk-registry
  ℹ Now in your-user/esk-registry — edit it freely.
```

---

## Fork an agent

```bash
esk agent:fork johndoe/esk-registry backend-dev --skills
```

This will:
1. Copy the agent definition to your registry.json
2. Generate and push the agent system prompt
3. With `--skills`: also fork all associated skills

Without `--skills`, you get an interactive checkbox to pick which skills to include.

**Example output:**
```
  ✓ Agent Backend Dev (backend-dev) forked from johndoe/esk-registry
  ℹ 3 skill(s) forked: graphql-api, nestjs-best-practices, prisma-client-api
```

---

## Fork vs Import

| Feature | `skill:import` | `skill:fork` |
|---------|---------------|--------------|
| Downloads SKILL.md | ✓ | ✓ |
| Installs locally (.claude/) | ✓ (with --install) | ✗ |
| Pushes to your GitHub registry | ✗ | ✓ |
| Updates your registry.json | ✗ | ✓ |
| Tracks origin (`forkedFrom`) | ✗ | ✓ |

Use **import** when you just need a skill in a project. Use **fork** when you want to own and customize it across all projects.
