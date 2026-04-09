import { input, select, checkbox, confirm } from '@inquirer/prompts';
import ora from 'ora';
import fs from 'fs-extra';
import { join, resolve } from 'path';
import { getConfig } from '../lib/config.js';
import { getRegistryJson, getFileContent } from '../lib/github.js';
import { installSkillLocally, generateAgentPrompt, saveProjectManifest } from '../lib/registry.js';
import { banner, success, error, info, warn, c, sectionHeader, outputResult, setJsonMode } from '../utils/display.js';

export function registerInitCommand(program) {
  program
    .command('init')
    .description('Initialize a Claude Code project (.claude/)')
    .option('--yes', 'Use default agents and skills without prompts')
    .option('--json', 'JSON output')
    .action(async (opts) => {
      if (opts.json) setJsonMode(true);

      if (!opts.json) banner();

      const config = await getConfig();

      // Check GitHub connection
      if (!config.github?.token) {
        error('Not connected to GitHub. Run: esk github:login');
        process.exit(1);
      }
      if (!config.github?.registry) {
        error('Registry not configured. Run: esk github:registry set <user/repo>');
        process.exit(1);
      }

      // Load registry
      const spinner = ora('Loading registry...').start();
      const { registry } = await getRegistryJson(config.github.registry);
      spinner.stop();

      if (!registry) {
        error('registry.json not found in the GitHub registry');
        process.exit(1);
      }

      const projectDir = resolve(process.cwd());
      const claudeDir = join(projectDir, '.claude');

      // Project name
      let projectName = opts.yes
        ? projectDir.split('/').pop()
        : await input({ message: 'Project name:', default: projectDir.split('/').pop() });

      // Agent selection
      let selectedAgentIds;
      if (opts.yes) {
        selectedAgentIds = registry.agents.map(a => a.id);
      } else {
        sectionHeader('🤖', 'Agent selection');
        const agentChoices = registry.agents.map(a => ({
          name: `${a.name.padEnd(12)} ${c.muted(a.role.padEnd(38))} ${c.label(a.model)}`,
          value: a.id,
          checked: false
        }));
        selectedAgentIds = await checkbox({ message: 'Which agents to enable?', choices: agentChoices });
      }

      if (selectedAgentIds.length === 0) {
        warn('No agents selected. You can add them later with: esk project:agent:add <id>');
      }

      // For each agent, select skills
      const agentSkillsMap = {};
      for (const agentId of selectedAgentIds) {
        const agent = registry.agents.find(a => a.id === agentId);
        if (!agent) continue;

        if (opts.yes) {
          agentSkillsMap[agentId] = agent.defaultSkills || [];
        } else {
          sectionHeader('🛠️', `Skills for ${agent.name} (${agent.role})`);
          const defaultSet = new Set(agent.defaultSkills || []);
          const skillChoices = registry.skills.map(s => ({
            name: `${s.id.padEnd(32)} ${c.muted(s.description || '')}`,
            value: s.id,
            checked: defaultSet.has(s.id)
          }));
          agentSkillsMap[agentId] = await checkbox({
            message: `Skills for ${agent.name}:`,
            choices: skillChoices
          });
        }
      }

      // Create .claude/ structure
      const installSpinner = ora('Creating .claude/...').start();
      await fs.ensureDir(join(claudeDir, 'agents'));
      await fs.ensureDir(join(claudeDir, 'skills'));

      const manifest = { project: projectName, agents: [], skills: [] };
      const results = { project: projectName, agents: [], skills: [], errors: [] };

      // Install agents
      for (const agentId of selectedAgentIds) {
        const agent = registry.agents.find(a => a.id === agentId);
        if (!agent) continue;

        const agentSkillIds = agentSkillsMap[agentId] || [];
        const agentSkillDefs = agentSkillIds.map(sid =>
          registry.skills?.find(s => s.id === sid) || { id: sid }
        );

        const prompt = generateAgentPrompt({ ...agent, defaultSkills: agentSkillIds }, agentSkillDefs);
        const agentFile = join(claudeDir, 'agents', `${agentId}.md`);
        await fs.writeFile(agentFile, prompt, 'utf8');

        manifest.agents.push({ id: agentId, name: agent.name, skills: agentSkillIds });
        results.agents.push({ id: agentId, skills: agentSkillIds });
      }

      // Collect all unique skills to install
      const allSkillIds = [...new Set(Object.values(agentSkillsMap).flat())];
      manifest.skills = allSkillIds;

      // Install SKILL.md files from GitHub
      for (const skillId of allSkillIds) {
        try {
          const skill = registry.skills?.find(s => s.id === skillId);
          const category = skill?.category || 'other';
          const { content } = await getFileContent(config.github.registry, `skills/${category}/${skillId}/SKILL.md`);
          if (content) {
            await installSkillLocally(claudeDir, skillId, content);
            results.skills.push(skillId);
          } else {
            results.errors.push({ skill: skillId, error: 'SKILL.md not found' });
          }
        } catch (e) {
          results.errors.push({ skill: skillId, error: e.message });
        }
      }

      // Save manifest
      await saveProjectManifest(claudeDir, manifest);

      installSpinner.succeed('.claude/ initialized');

      outputResult(
        () => {
          console.log('');
          console.log(`  ${c.brand('✦')} ${c.bold(projectName)} — initialization complete`);
          console.log('');
          console.log(`  ${c.success('✓')} ${results.agents.length} agent(s) configured`);
          console.log(`  ${c.success('✓')} ${results.skills.length} skill(s) installed`);
          if (results.errors.length > 0) {
            console.log(`  ${c.warn('⚠')} ${results.errors.length} skill(s) not found in the registry`);
          }
          console.log('');
          console.log(`  ${c.muted('Next steps:')}`);
          console.log(`  ${c.muted('  esk project:status       → project audit')}`);
          console.log(`  ${c.muted('  esk skill:search <query> → find skills')}`);
          console.log('');
        },
        { success: true, ...results }
      );
    });
}
