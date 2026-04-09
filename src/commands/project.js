import { input, select, checkbox, confirm } from '@inquirer/prompts';
import ora from 'ora';
import fs from 'fs-extra';
import { join } from 'path';
import { getConfig } from '../lib/config.js';
import { getRegistryJson, getFileContent, createOrUpdateFile } from '../lib/github.js';
import {
  findClaudeDir, getProjectStatus, readProjectManifest, saveProjectManifest,
  installSkillLocally, generateAgentPrompt, slugify
} from '../lib/registry.js';
import {
  success, error, warn, info, c,
  sectionHeader, printProjectStatus,
  outputResult, setJsonMode
} from '../utils/display.js';

export function registerProjectCommands(program) {

  // ── project:status ──────────────────────────────────────────────────────────
  program.command('project:status')
    .description('Full audit of the current project (.claude/)')
    .option('--json', 'JSON output')
    .action(async (opts) => {
      if (opts.json) setJsonMode(true);
      const claudeDir = findClaudeDir();
      if (!claudeDir) { error('.claude/ not found in the current project'); return; }

      const status = await getProjectStatus(claudeDir);

      const config = await getConfig();
      if (config.github?.registry) {
        const { registry } = await getRegistryJson(config.github.registry);
        if (registry) {
          for (const agent of status.agents) {
            const regAgent = registry.agents?.find(a => a.id === agent.id);
            if (regAgent) {
              agent.skillsMissing = (regAgent.defaultSkills || []).filter(
                s => !status.skillsInstalled.includes(s)
              );
            }
          }
        }
      }

      outputResult(() => printProjectStatus(status), status);
    });

  // ── project:agent:add ───────────────────────────────────────────────────────
  program.command('project:agent:add <agentId>')
    .description('Add an agent to the current project')
    .option('--install-skills', 'Also install default skills')
    .option('--yes', 'Skip prompts')
    .option('--json', 'JSON output')
    .action(async (agentId, opts) => {
      if (opts.json) setJsonMode(true);
      const claudeDir = findClaudeDir();
      if (!claudeDir) { error('.claude/ not found'); return; }

      const config = await getConfig();
      const { registry } = await getRegistryJson(config.github?.registry);
      const agent = registry?.agents?.find(a => a.id === agentId);
      if (!agent) { error(`Agent "${agentId}" not found in the registry`); return; }

      const agentSkills = (agent.defaultSkills || []).map(sid =>
        registry.skills?.find(s => s.id === sid) || { id: sid }
      );
      const prompt = generateAgentPrompt(agent, agentSkills);

      await fs.ensureDir(join(claudeDir, 'agents'));
      await fs.writeFile(join(claudeDir, 'agents', `${agentId}.md`), prompt, 'utf8');

      const manifest = await readProjectManifest(claudeDir);
      if (!manifest.agents.find(a => a.id === agentId)) {
        manifest.agents.push({ id: agentId, skills: agent.defaultSkills || [] });
        await saveProjectManifest(claudeDir, manifest);
      }

      success(`Agent ${c.bold(agent.name)} added`);

      if (opts.installSkills && agent.defaultSkills?.length > 0) {
        const spinner = ora('Installing skills...').start();
        for (const skillId of agent.defaultSkills) {
          try {
            const skill = registry.skills?.find(s => s.id === skillId);
            const { content } = await getFileContent(config.github.registry, `skills/${skill?.category || 'other'}/${skillId}/SKILL.md`);
            if (content) await installSkillLocally(claudeDir, skillId, content);
          } catch { /* skill unavailable */ }
        }
        spinner.succeed(`${agent.defaultSkills.length} skills installed`);
      }

      outputResult(() => {}, { success: true, agent: agentId, skills: agent.defaultSkills });
    });

  // ── project:agent:remove ────────────────────────────────────────────────────
  program.command('project:agent:remove <agentId>')
    .description('Remove an agent from the project')
    .option('--json', 'JSON output')
    .action(async (agentId, opts) => {
      if (opts.json) setJsonMode(true);
      const claudeDir = findClaudeDir();
      if (!claudeDir) { error('.claude/ not found'); return; }

      const agentFile = join(claudeDir, 'agents', `${agentId}.md`);
      if (await fs.pathExists(agentFile)) await fs.remove(agentFile);

      const manifest = await readProjectManifest(claudeDir);
      manifest.agents = manifest.agents.filter(a => a.id !== agentId);
      await saveProjectManifest(claudeDir, manifest);

      outputResult(() => success(`Agent ${c.bold(agentId)} removed`), { success: true, agent: agentId });
    });

  // ── project:agent:add-skill ─────────────────────────────────────────────────
  program.command('project:agent:add-skill <agentId> <skillId>')
    .description('Assign a skill to an agent in this project')
    .option('--install', 'Install SKILL.md if missing')
    .option('--yes', 'Skip prompts')
    .option('--json', 'JSON output')
    .action(async (agentId, skillId, opts) => {
      if (opts.json) setJsonMode(true);
      const claudeDir = findClaudeDir();
      if (!claudeDir) { error('.claude/ not found'); return; }

      const manifest = await readProjectManifest(claudeDir);
      let agent = manifest.agents.find(a => a.id === agentId);
      if (!agent) {
        agent = { id: agentId, skills: [] };
        manifest.agents.push(agent);
      }
      if (!agent.skills) agent.skills = [];
      if (!agent.skills.includes(skillId)) {
        agent.skills.push(skillId);
        await saveProjectManifest(claudeDir, manifest);
      }

      const config = await getConfig();
      if (config.github?.registry && opts.install) {
        const { registry } = await getRegistryJson(config.github.registry);
        const skill = registry?.skills?.find(s => s.id === skillId);
        const { content } = await getFileContent(config.github.registry, `skills/${skill?.category || 'other'}/${skillId}/SKILL.md`);
        if (content) {
          await installSkillLocally(claudeDir, skillId, content);
          success(`SKILL.md installed in .claude/skills/${skillId}/`);
        }
      }

      outputResult(
        () => success(`Skill ${c.bold(skillId)} → agent ${c.bold(agentId)}`),
        { success: true, agent: agentId, skill: skillId }
      );
    });

  // ── project:agent:status ────────────────────────────────────────────────────
  program.command('project:agent:status <agentId>')
    .description('Show active skills for an agent in this project')
    .option('--json', 'JSON output')
    .action(async (agentId, opts) => {
      if (opts.json) setJsonMode(true);
      const claudeDir = findClaudeDir();
      if (!claudeDir) { error('.claude/ not found'); return; }

      const manifest = await readProjectManifest(claudeDir);
      const agent = manifest.agents.find(a => a.id === agentId);
      if (!agent) { error(`Agent "${agentId}" not found in this project`); return; }

      outputResult(
        () => {
          sectionHeader('🤖', `${agentId} — Active skills`);
          for (const s of agent.skills || []) {
            console.log(`  ${c.success('✓')} ${s}`);
          }
        },
        { agent: agentId, skills: agent.skills || [] }
      );
    });

  // ── project:skill:install ───────────────────────────────────────────────────
  program.command('project:skill:install <skillId>')
    .description('Install a skill from the registry into .claude/')
    .option('--agent <agentId>', 'Also assign to an agent')
    .option('--yes', 'Skip prompts')
    .option('--json', 'JSON output')
    .action(async (skillId, opts) => {
      if (opts.json) setJsonMode(true);
      const claudeDir = findClaudeDir();
      if (!claudeDir) { error('.claude/ not found'); return; }

      const config = await getConfig();
      if (!config.github?.registry) { error('Registry not configured'); return; }

      const spinner = ora(`Installing "${skillId}"...`).start();
      try {
        const { registry } = await getRegistryJson(config.github.registry);
        const skill = registry?.skills?.find(s => s.id === skillId);
        const { content } = await getFileContent(config.github.registry, `skills/${skill?.category || 'other'}/${skillId}/SKILL.md`);
        if (!content) { spinner.fail('SKILL.md not found'); return; }

        const path = await installSkillLocally(claudeDir, skillId, content);
        spinner.succeed(`Installed: ${path}`);
        outputResult(() => success(`Skill ${c.bold(skillId)} installed`), { success: true, id: skillId, path });
      } catch (err_) {
        spinner.fail('Error'); error(err_.message);
      }
    });

  // ── project:skill:publish ───────────────────────────────────────────────────
  program.command('project:skill:publish <skillId>')
    .description('Promote a local skill to the GitHub registry')
    .option('--yes', 'Skip confirmation')
    .option('--json', 'JSON output')
    .action(async (skillId, opts) => {
      if (opts.json) setJsonMode(true);
      const claudeDir = findClaudeDir();
      if (!claudeDir) { error('.claude/ not found'); return; }

      const config = await getConfig();
      if (!config.github?.registry) { error('Registry not configured'); return; }

      const localPath = join(claudeDir, 'skills', skillId, 'SKILL.md');
      if (!await fs.pathExists(localPath)) { error(`Skill "${skillId}" not found in .claude/skills/`); return; }

      const content = await fs.readFile(localPath, 'utf8');
      const spinner = ora('Publishing...').start();
      try {
        const { registry, sha: regSha } = await getRegistryJson(config.github.registry);
        const existingSkill = registry?.skills?.find(s => s.id === skillId);
        const category = existingSkill?.category || 'other';
        const { sha } = await getFileContent(config.github.registry, `skills/${category}/${skillId}/SKILL.md`);
        await createOrUpdateFile(config.github.registry, `skills/${category}/${skillId}/SKILL.md`, content, `feat: publish skill ${skillId} [esk]`, sha);
        spinner.succeed(`Skill "${skillId}" published`);
        outputResult(() => success(`Published to ${config.github.registry}`), { success: true, id: skillId });
      } catch (err_) {
        spinner.fail('Error'); error(err_.message);
      }
    });
}
