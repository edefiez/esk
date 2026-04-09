import { input, select, checkbox, confirm } from '@inquirer/prompts';
import ora from 'ora';
import fs from 'fs-extra';
import { join } from 'path';
import { getConfig } from '../lib/config.js';
import { getRegistryJson, updateRegistryJson, createOrUpdateFile, getFileContent, searchSkillsMultiSource } from '../lib/github.js';
import { slugify, findClaudeDir, installSkillLocally } from '../lib/registry.js';
import {
  success, error, warn, info, c,
  sectionHeader, printSkillList, printSearchResults,
  outputResult, setJsonMode, isJsonMode
} from '../utils/display.js';

const DEFAULT_SKILL_CATEGORIES = [
  'meta', 'quality', 'tooling',
  'backend', 'frontend', 'mobile', 'devops', 'other'
];

export function registerSkillCommands(program) {
  const skill = program.command('skill').description('Manage skills');

  // ── skill:list ──────────────────────────────────────────────────────────────
  skill.command('list')
    .description('List skills in the registry')
    .option('--category <cat>', 'Filter by category')
    .option('--json', 'JSON output')
    .action(async (opts) => {
      if (opts.json) setJsonMode(true);
      const config = await getConfig();
      if (!config.github?.registry) { error('Registry not configured. Run: esk github:registry set <repo>'); return; }

      const spinner = ora('Loading registry...').start();
      const { registry } = await getRegistryJson(config.github.registry);
      spinner.stop();

      if (!registry) { error('registry.json not found in the repo'); return; }

      let skills = registry.skills || [];
      if (opts.category) skills = skills.filter(s => s.category?.startsWith(opts.category));

      outputResult(
        () => {
          sectionHeader('🛠️', `Skills (${skills.length})`);
          printSkillList(skills);
        },
        { skills }
      );
    });

  // ── skill:search ────────────────────────────────────────────────────────────
  skill.command('search <query>')
    .description('Search for skills across all sources')
    .option('--all', 'Include all sources (including broad)')
    .option('--source <id>', 'Limit to a specific source')
    .option('--json', 'JSON output')
    .action(async (query, opts) => {
      if (opts.json) setJsonMode(true);
      const config = await getConfig();

      let sources = config.sources || [];
      if (opts.source) sources = sources.filter(s => s.id === opts.source);
      if (!opts.all) sources = sources.filter(s => s.id !== 'broad');

      // Inject private repo from config
      sources = sources.map(s =>
        s.id === 'private' ? { ...s, repo: config.github?.registry || s.repo } : s
      );

      console.log('');
      console.log(`🔍  Searching ${c.bold(`"${query}"`)} across ${sources.filter(s => s.enabled).length} sources...`);

      const spinner = ora('').start();
      const results = await searchSkillsMultiSource(query, sources);
      spinner.stop();

      outputResult(
        () => {
          if (results.length === 0) {
            info(`No skills found for "${query}"`);
          } else {
            sectionHeader('🔍', `${results.length} result(s)`);
            printSearchResults(results);
          }
        },
        { query, results }
      );
    });

  // ── skill:create ────────────────────────────────────────────────────────────
  skill.command('create')
    .description('Create a new skill')
    .option('--id <id>', 'Skill ID')
    .option('--label <label>', 'Display label')
    .option('--category <cat>', 'Category')
    .option('--description <desc>', 'Short description')
    .option('--agent <agent>', 'Associated agent(s) — comma-separated')
    .option('--publish', 'Publish to GitHub')
    .option('--install', 'Install in the current project .claude/')
    .option('--yes', 'Skip interactive prompts')
    .option('--json', 'JSON output')
    .action(async (opts) => {
      if (opts.json) setJsonMode(true);

      let id = opts.id;
      let label = opts.label;
      let category = opts.category;
      let description = opts.description;
      let agents = opts.agent ? opts.agent.split(',').map(a => a.trim()) : [];

      // Interactive mode if --yes is absent
      if (!opts.yes) {
        if (!id) id = await input({ message: 'Skill ID (e.g. graphql-api):' });
        id = slugify(id);
        if (!label) label = await input({ message: 'Display label:', default: id });
        if (!category) category = await select({
          message: 'Category:',
          choices: DEFAULT_SKILL_CATEGORIES.map(c => ({ value: c, name: c }))
        });
        if (!description) description = await input({ message: 'Short description:' });
      }

      if (!id) { error('ID is required'); process.exit(1); }
      id = slugify(id);

      // Generate SKILL.md content
      const skillContent = generateSkillTemplate(id, label || id, description || '', category || 'other');

      const config = await getConfig();
      const results = { id, label: label || id, category, description, filesCreated: [] };

      // Install locally
      if (opts.install) {
        const claudeDir = findClaudeDir();
        if (!claudeDir) { warn('.claude/ not found — skill not installed locally'); }
        else {
          const path = await installSkillLocally(claudeDir, id, skillContent);
          results.filesCreated.push(path);
          success(`Installed at ${path}`);
        }
      }

      // Publish to GitHub
      if (opts.publish) {
        if (!config.github?.registry) { error('Registry not configured'); process.exit(1); }
        const spinner = ora('Publishing to GitHub...').start();
        try {
          const skillPath = `skills/${category || 'other'}/${id}/SKILL.md`;
          const { sha } = await getFileContent(config.github.registry, skillPath);
          await createOrUpdateFile(
            config.github.registry, skillPath, skillContent,
            `feat: add skill ${id} [esk]`, sha
          );

          // Update registry.json
          const { registry, sha: regSha } = await getRegistryJson(config.github.registry);
          if (registry) {
            const newSkill = { id, label: label || id, category: category || 'other', description: description || '' };
            if (!registry.skills.find(s => s.id === id)) {
              registry.skills.push(newSkill);
              await updateRegistryJson(config.github.registry, registry, regSha);
            }
          }

          spinner.succeed('Published to GitHub');
          results.filesCreated.push(`${config.github.registry}:skills/${category}/${id}/SKILL.md`);
        } catch (err_) {
          spinner.fail('Publishing error');
          error(err_.message);
        }
      }

      outputResult(
        () => success(`Skill ${c.bold(id)} created`),
        { success: true, ...results }
      );
    });

  // ── skill:publish ───────────────────────────────────────────────────────────
  skill.command('publish <id>')
    .description('Publish a local skill to the GitHub registry')
    .option('--yes', 'Skip confirmation')
    .option('--json', 'JSON output')
    .action(async (id, opts) => {
      if (opts.json) setJsonMode(true);
      const config = await getConfig();
      if (!config.github?.registry) { error('Registry not configured'); return; }

      const claudeDir = findClaudeDir();
      if (!claudeDir) { error('.claude/ not found'); return; }

      const localPath = join(claudeDir, 'skills', id, 'SKILL.md');
      if (!await fs.pathExists(localPath)) { error(`Skill "${id}" not found in .claude/skills/`); return; }

      if (!opts.yes) {
        const ok = await confirm({ message: `Publish "${id}" to ${config.github.registry}?` });
        if (!ok) return;
      }

      const content = await fs.readFile(localPath, 'utf8');
      const spinner = ora('Publishing...').start();
      try {
        const { registry, sha: regSha } = await getRegistryJson(config.github.registry);
        const existingSkill = registry?.skills?.find(s => s.id === id);
        const category = existingSkill?.category || 'other';

        const { sha } = await getFileContent(config.github.registry, `skills/${category}/${id}/SKILL.md`);
        await createOrUpdateFile(
          config.github.registry, `skills/${category}/${id}/SKILL.md`,
          content, `feat: publish skill ${id} [esk]`, sha
        );
        spinner.succeed(`Skill "${id}" published`);
        outputResult(() => success(`Published to ${config.github.registry}`), { success: true, id });
      } catch (err_) {
        spinner.fail('Error');
        error(err_.message);
      }
    });

  // ── skill:import ────────────────────────────────────────────────────────────
  skill.command('import <repo> <skillId>')
    .description('Import a skill from a third-party registry')
    .option('--install', 'Install in the current project .claude/')
    .option('--yes', 'Skip confirmation')
    .option('--json', 'JSON output')
    .action(async (repo, skillId, opts) => {
      if (opts.json) setJsonMode(true);
      const spinner = ora(`Importing "${skillId}" from ${repo}...`).start();
      try {
        const { registry } = await getRegistryJson(repo);
        const skill = registry?.skills?.find(s => s.id === skillId);
        if (!skill) { spinner.fail(`Skill "${skillId}" not found in ${repo}`); return; }

        const skillPath = `skills/${skill.category || 'other'}/${skillId}/SKILL.md`;
        const { content } = await getFileContent(repo, skillPath);
        if (!content) { spinner.fail('SKILL.md not found'); return; }
        spinner.stop();

        if (opts.install) {
          const claudeDir = findClaudeDir();
          if (claudeDir) {
            await installSkillLocally(claudeDir, skillId, content);
            success(`Imported and installed in .claude/skills/${skillId}/`);
          }
        }

        outputResult(
          () => success(`Skill "${skillId}" imported from ${repo}`),
          { success: true, id: skillId, repo, installed: !!opts.install }
        );
      } catch (err_) {
        spinner.fail('Import error');
        error(err_.message);
      }
    });

  // ── skill:add ───────────────────────────────────────────────────────────────
  skill.command('add <agentId> <skillId>')
    .description('Assign a skill to an agent in the registry')
    .option('--yes', 'Skip confirmation')
    .option('--json', 'JSON output')
    .action(async (agentId, skillId, opts) => {
      if (opts.json) setJsonMode(true);
      const config = await getConfig();
      if (!config.github?.registry) { error('Registry not configured'); return; }

      const spinner = ora('Updating registry...').start();
      try {
        const { registry, sha } = await getRegistryJson(config.github.registry);
        if (!registry) { spinner.fail('registry.json not found'); return; }

        const agent = registry.agents?.find(a => a.id === agentId);
        if (!agent) { spinner.fail(`Agent "${agentId}" not found`); return; }

        if (!agent.defaultSkills) agent.defaultSkills = [];
        if (agent.defaultSkills.includes(skillId)) {
          spinner.stop();
          warn(`Skill "${skillId}" is already assigned to ${agentId}`);
          return;
        }
        agent.defaultSkills.push(skillId);
        await updateRegistryJson(config.github.registry, registry, sha);
        spinner.succeed('Registry updated');

        outputResult(
          () => success(`Skill ${c.bold(skillId)} → agent ${c.bold(agentId)}`),
          { success: true, agent: agentId, skill: skillId, filesModified: ['registry.json'] }
        );
      } catch (err_) {
        spinner.fail('Error');
        error(err_.message);
      }
    });
}

// ─── SKILL.md Template ──────────────────────────────────────────────────────

function generateSkillTemplate(id, label, description, category) {
  return `# ${label}

## Description
${description}

## When to use this skill
<!-- Describe in which contexts this skill should be activated -->

## Instructions
<!-- Detailed instructions for the agent -->

## Examples
<!-- Usage examples -->

## Notes
- Skill ID: \`${id}\`
- Category: \`${category}\`
- Created with [esk](https://esk.sh)
`;
}
