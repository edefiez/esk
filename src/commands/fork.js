import { confirm, checkbox } from '@inquirer/prompts';
import ora from 'ora';
import { getConfig } from '../lib/config.js';
import { getRegistryJson, updateRegistryJson, getFileContent, createOrUpdateFile } from '../lib/github.js';
import { generateAgentPrompt } from '../lib/registry.js';
import {
  success, error, warn, info, c,
  outputResult, setJsonMode
} from '../utils/display.js';

export function registerForkCommands(program) {

  // ── skill:fork ──────────────────────────────────────────────────────────────
  program.command('skill:fork <repo> <skillId>')
    .description('Fork a skill from a third-party registry into your own')
    .option('--yes', 'Skip confirmation')
    .option('--json', 'JSON output')
    .action(async (repo, skillId, opts) => {
      if (opts.json) setJsonMode(true);
      const config = await getConfig();
      if (!config.github?.registry) { error('Registry not configured. Run: esk github:registry set <repo>'); return; }
      if (config.github.registry === repo) { error('Cannot fork from your own registry'); return; }

      const spinner = ora(`Fetching "${skillId}" from ${repo}...`).start();
      try {
        // Read source registry
        const { registry: sourceReg } = await getRegistryJson(repo);
        const skill = sourceReg?.skills?.find(s => s.id === skillId);
        if (!skill) { spinner.fail(`Skill "${skillId}" not found in ${repo}`); return; }

        // Read SKILL.md content
        const skillPath = `skills/${skill.category || 'other'}/${skillId}/SKILL.md`;
        const { content } = await getFileContent(repo, skillPath);
        if (!content) { spinner.fail('SKILL.md not found in source repo'); return; }
        spinner.stop();

        if (!opts.yes) {
          console.log('');
          console.log(`  ${c.bold(skillId)} from ${c.label(repo)}`);
          console.log(`  ${c.muted('Category:')} ${skill.category || 'other'}`);
          console.log(`  ${c.muted('Description:')} ${skill.description || '—'}`);
          console.log(`  ${c.muted('Target:')} ${config.github.registry}`);
          console.log('');
          const ok = await confirm({ message: `Fork "${skillId}" into your registry?` });
          if (!ok) return;
        }

        // Add a fork header to the content
        const forkedContent = `<!-- Forked from ${repo} by esk -->\n${content}`;

        // Push SKILL.md to own registry
        const pushSpinner = ora('Forking to your registry...').start();
        const targetPath = `skills/${skill.category || 'other'}/${skillId}/SKILL.md`;
        const { sha: existingSha } = await getFileContent(config.github.registry, targetPath);
        await createOrUpdateFile(
          config.github.registry, targetPath, forkedContent,
          `feat: fork skill ${skillId} from ${repo} [esk]`, existingSha
        );

        // Update registry.json
        const { registry: myReg, sha: regSha } = await getRegistryJson(config.github.registry);
        if (myReg) {
          if (!myReg.skills) myReg.skills = [];
          const existing = myReg.skills.find(s => s.id === skillId);
          if (!existing) {
            myReg.skills.push({
              id: skill.id,
              label: skill.label || skill.id,
              category: skill.category || 'other',
              description: skill.description || '',
              forkedFrom: repo
            });
            await updateRegistryJson(config.github.registry, myReg, regSha);
          }
        }

        pushSpinner.succeed('Forked');
        outputResult(
          () => {
            success(`Skill ${c.bold(skillId)} forked from ${c.label(repo)}`);
            info(`Now in ${config.github.registry} — edit it freely.`);
          },
          { success: true, id: skillId, from: repo, to: config.github.registry }
        );
      } catch (err_) {
        error(err_.message);
      }
    });

  // ── agent:fork ──────────────────────────────────────────────────────────────
  program.command('agent:fork <repo> <agentId>')
    .description('Fork an agent and its skills from a third-party registry')
    .option('--skills', 'Also fork all associated skills')
    .option('--yes', 'Skip confirmation')
    .option('--json', 'JSON output')
    .action(async (repo, agentId, opts) => {
      if (opts.json) setJsonMode(true);
      const config = await getConfig();
      if (!config.github?.registry) { error('Registry not configured'); return; }
      if (config.github.registry === repo) { error('Cannot fork from your own registry'); return; }

      const spinner = ora(`Fetching agent "${agentId}" from ${repo}...`).start();
      try {
        const { registry: sourceReg } = await getRegistryJson(repo);
        const agent = sourceReg?.agents?.find(a => a.id === agentId);
        if (!agent) { spinner.fail(`Agent "${agentId}" not found in ${repo}`); return; }
        spinner.stop();

        // Select which skills to fork
        let skillsToFork = [];
        const agentSkillIds = agent.defaultSkills || [];

        if (opts.skills) {
          skillsToFork = agentSkillIds;
        } else if (!opts.yes && agentSkillIds.length > 0) {
          console.log('');
          console.log(`  ${c.bold(agent.name)} — ${agent.role}`);
          console.log(`  ${c.muted('Model:')} ${agent.model}`);
          console.log(`  ${c.muted('Skills:')} ${agentSkillIds.length}`);
          console.log('');

          const choices = agentSkillIds.map(sid => {
            const sk = sourceReg.skills?.find(s => s.id === sid);
            return {
              name: `${sid.padEnd(32)} ${c.muted(sk?.description || '')}`,
              value: sid,
              checked: true
            };
          });
          skillsToFork = await checkbox({ message: 'Skills to fork along with the agent:', choices });
        }

        if (!opts.yes) {
          const ok = await confirm({ message: `Fork agent "${agentId}" (+ ${skillsToFork.length} skills) into your registry?` });
          if (!ok) return;
        }

        const forkSpinner = ora('Forking agent...').start();

        // Fork the agent definition
        const { registry: myReg, sha: regSha } = await getRegistryJson(config.github.registry);
        if (!myReg) { forkSpinner.fail('Your registry.json not found'); return; }

        if (!myReg.agents) myReg.agents = [];
        const existingAgent = myReg.agents.find(a => a.id === agentId);
        const forkedAgent = {
          ...agent,
          defaultSkills: skillsToFork,
          forkedFrom: repo
        };

        if (existingAgent) {
          Object.assign(existingAgent, forkedAgent);
        } else {
          myReg.agents.push(forkedAgent);
        }

        // Fork the agent .md prompt
        const agentSkillDefs = skillsToFork.map(sid =>
          sourceReg.skills?.find(s => s.id === sid) || { id: sid }
        );
        const prompt = `<!-- Forked from ${repo} by esk -->\n` +
          generateAgentPrompt({ ...agent, defaultSkills: skillsToFork }, agentSkillDefs);

        const { sha: agentSha } = await getFileContent(config.github.registry, `agents/${agentId}.md`);
        await createOrUpdateFile(
          config.github.registry, `agents/${agentId}.md`,
          prompt, `feat: fork agent ${agentId} from ${repo} [esk]`, agentSha
        );

        // Fork associated skills
        const forkedSkills = [];
        for (const skillId of skillsToFork) {
          const skill = sourceReg.skills?.find(s => s.id === skillId);
          if (!skill) continue;

          const skillPath = `skills/${skill.category || 'other'}/${skillId}/SKILL.md`;
          const { content } = await getFileContent(repo, skillPath);
          if (!content) continue;

          const { sha: skSha } = await getFileContent(config.github.registry, skillPath);
          await createOrUpdateFile(
            config.github.registry, skillPath,
            `<!-- Forked from ${repo} by esk -->\n${content}`,
            `feat: fork skill ${skillId} from ${repo} [esk]`, skSha
          );

          if (!myReg.skills) myReg.skills = [];
          if (!myReg.skills.find(s => s.id === skillId)) {
            myReg.skills.push({ ...skill, forkedFrom: repo });
          }
          forkedSkills.push(skillId);
        }

        // Save registry.json
        await updateRegistryJson(config.github.registry, myReg, regSha);
        forkSpinner.succeed('Forked');

        outputResult(
          () => {
            success(`Agent ${c.bold(agent.name)} (${agentId}) forked from ${c.label(repo)}`);
            if (forkedSkills.length > 0) {
              info(`${forkedSkills.length} skill(s) forked: ${forkedSkills.join(', ')}`);
            }
          },
          { success: true, agent: agentId, from: repo, skills: forkedSkills }
        );
      } catch (err_) {
        error(err_.message);
      }
    });
}
