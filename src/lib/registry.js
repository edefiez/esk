import { join, resolve } from 'path';
import fs from 'fs-extra';

// ─── Global registry (in the GitHub repo) ───────────────────────────────────

export function emptyRegistry() {
  return { version: '1.0.0', agents: [], skills: [] };
}

// ─── Current project (.claude/) ─────────────────────────────────────────────

export function findClaudeDir(startDir = process.cwd()) {
  let dir = resolve(startDir);
  while (true) {
    const candidate = join(dir, '.claude');
    if (fs.pathExistsSync(candidate)) return candidate;
    const parent = resolve(dir, '..');
    if (parent === dir) return null;
    dir = parent;
  }
}

export async function readProjectManifest(claudeDir) {
  const manifestPath = join(claudeDir, 'esk.json');
  if (!await fs.pathExists(manifestPath)) {
    return { agents: [], skills: [] };
  }
  return fs.readJson(manifestPath);
}

export async function saveProjectManifest(claudeDir, manifest) {
  const manifestPath = join(claudeDir, 'esk.json');
  await fs.writeJson(manifestPath, manifest, { spaces: 2 });
}

export async function getProjectStatus(claudeDir) {
  const agentsDir = join(claudeDir, 'agents');
  const skillsDir = join(claudeDir, 'skills');
  const manifest = await readProjectManifest(claudeDir);

  // Agents present on disk
  const agentFiles = await fs.pathExists(agentsDir)
    ? (await fs.readdir(agentsDir)).filter(f => f.endsWith('.md'))
    : [];

  // Skills present on disk
  const skillDirs = await fs.pathExists(skillsDir)
    ? (await fs.readdir(skillsDir, { withFileTypes: true }))
        .filter(d => d.isDirectory())
        .map(d => d.name)
    : [];

  return {
    claudeDir,
    agents: manifest.agents.map(a => ({
      ...a,
      fileExists: agentFiles.includes(`${a.id}.md`),
      skills: a.skills || []
    })),
    skillsInstalled: skillDirs,
    manifest
  };
}

// ─── Install a skill into .claude/ ──────────────────────────────────────────

export async function installSkillLocally(claudeDir, skillId, skillContent) {
  const skillDir = join(claudeDir, 'skills', skillId);
  await fs.ensureDir(skillDir);
  await fs.writeFile(join(skillDir, 'SKILL.md'), skillContent, 'utf8');
  return join(skillDir, 'SKILL.md');
}

// ─── Generate agent system prompt ───────────────────────────────────────────

export function generateAgentPrompt(agent, skills = []) {
  const lines = [
    `# ${agent.name} — ${agent.role}`,
    '',
    `**Model:** ${agent.model}`,
    ''
  ];

  if (agent.description) {
    lines.push(agent.description, '');
  }

  if (skills.length > 0) {
    lines.push('## Loaded skills', '');
    for (const skill of skills) {
      lines.push(`- **${skill.label || skill.id}** — ${skill.description || ''}`);
    }
    lines.push('');
    lines.push('> Refer to the corresponding SKILL.md files in `.claude/skills/`.');
  }

  return lines.join('\n');
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[àáâãäå]/g, 'a')
    .replace(/[éèêë]/g, 'e')
    .replace(/[ùúûü]/g, 'u')
    .replace(/[îï]/g, 'i')
    .replace(/[ôö]/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
