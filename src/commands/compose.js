import { checkbox, confirm } from '@inquirer/prompts';
import ora from 'ora';
import fs from 'fs-extra';
import { join } from 'path';
import { getConfig } from '../lib/config.js';
import { getRegistryJson, updateRegistryJson, createOrUpdateFile, getFileContent } from '../lib/github.js';
import { findClaudeDir, generateAgentPrompt, readProjectManifest, saveProjectManifest } from '../lib/registry.js';
import {
  success, error, warn, info, c,
  sectionHeader, outputResult, setJsonMode
} from '../utils/display.js';

export function registerComposeCommand(program) {
  program.command('agent:compose <agentId>')
    .description('Interactively recompose an agent\'s skills with prompt preview')
    .option('--publish', 'Also publish to GitHub after composing')
    .option('--json', 'JSON output')
    .action(async (agentId, opts) => {
      if (opts.json) setJsonMode(true);

      const config = await getConfig();
      if (!config.github?.registry) { error('Registry not configured'); return; }

      const spinner = ora('Loading registry...').start();
      const { registry, sha: regSha } = await getRegistryJson(config.github.registry);
      spinner.stop();

      if (!registry) { error('registry.json not found'); return; }

      const agent = registry.agents?.find(a => a.id === agentId);
      if (!agent) { error(`Agent "${agentId}" not found in the registry`); return; }

      const currentSkills = agent.defaultSkills || [];

      // Show current state
      console.log('');
      console.log(`  ${c.brand('●')} ${c.bold(agent.name)} — ${agent.role}`);
      console.log(`    ${c.muted('Model:')} ${c.label(agent.model)}`);
      console.log(`    ${c.muted('Current skills:')} ${currentSkills.length}`);

      if (currentSkills.length > 0) {
        for (const sid of currentSkills) {
          const sk = registry.skills?.find(s => s.id === sid);
          console.log(`    ${c.success('✓')} ${sid.padEnd(30)} ${c.muted(sk?.description || '')}`);
        }
      }
      console.log('');

      // Build choices from all available skills
      const allSkills = registry.skills || [];
      const currentSet = new Set(currentSkills);
      const choices = allSkills.map(s => ({
        name: `${s.id.padEnd(32)} ${c.muted(s.description || '')}`,
        value: s.id,
        checked: currentSet.has(s.id)
      }));

      const selected = await checkbox({
        message: `Compose skills for ${agent.name}:`,
        choices
      });

      // Show what changed
      const added = selected.filter(s => !currentSet.has(s));
      const removed = currentSkills.filter(s => !selected.includes(s));

      if (added.length === 0 && removed.length === 0) {
        info('No changes made.');
        return;
      }

      console.log('');
      if (added.length > 0) {
        console.log(`  ${c.success('+ Added:')}`);
        for (const s of added) console.log(`    ${c.success('+')} ${s}`);
      }
      if (removed.length > 0) {
        console.log(`  ${c.error('- Removed:')}`);
        for (const s of removed) console.log(`    ${c.error('-')} ${s}`);
      }

      // Preview the generated prompt
      const skillDefs = selected.map(sid =>
        registry.skills?.find(s => s.id === sid) || { id: sid }
      );
      const preview = generateAgentPrompt({ ...agent, defaultSkills: selected }, skillDefs);

      console.log('');
      sectionHeader('📄', 'Generated prompt preview');
      console.log(c.muted('─'.repeat(60)));
      console.log(preview);
      console.log(c.muted('─'.repeat(60)));

      const ok = await confirm({ message: 'Apply these changes?' });
      if (!ok) { info('Cancelled.'); return; }

      // Apply to registry
      agent.defaultSkills = selected;
      await updateRegistryJson(config.github.registry, registry, regSha);

      // Update local project if .claude/ exists
      const claudeDir = findClaudeDir();
      if (claudeDir) {
        const agentFile = join(claudeDir, 'agents', `${agentId}.md`);
        if (await fs.pathExists(agentFile)) {
          await fs.writeFile(agentFile, preview, 'utf8');
          info(`Local agent file updated: ${agentFile}`);
        }

        const manifest = await readProjectManifest(claudeDir);
        const manifestAgent = manifest.agents.find(a => a.id === agentId);
        if (manifestAgent) {
          manifestAgent.skills = selected;
          await saveProjectManifest(claudeDir, manifest);
        }
      }

      // Publish to GitHub if requested
      if (opts.publish) {
        const pubSpinner = ora('Publishing to GitHub...').start();
        try {
          const { sha } = await getFileContent(config.github.registry, `agents/${agentId}.md`);
          await createOrUpdateFile(
            config.github.registry, `agents/${agentId}.md`,
            preview, `chore: recompose agent ${agentId} [esk]`, sha
          );
          pubSpinner.succeed('Published');
        } catch (err_) {
          pubSpinner.fail('Error publishing');
          error(err_.message);
        }
      }

      outputResult(
        () => {
          success(`Agent ${c.bold(agent.name)} recomposed: ${selected.length} skills`);
        },
        { success: true, agent: agentId, skills: selected, added, removed }
      );
    });
}
