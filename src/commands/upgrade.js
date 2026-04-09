import { checkbox, confirm } from '@inquirer/prompts';
import ora from 'ora';
import fs from 'fs-extra';
import { join } from 'path';
import { getConfig } from '../lib/config.js';
import { getRegistryJson, getFileContent } from '../lib/github.js';
import { findClaudeDir, installSkillLocally } from '../lib/registry.js';
import {
  success, error, warn, info, c,
  sectionHeader, outputResult, setJsonMode
} from '../utils/display.js';

export function registerUpgradeCommand(program) {
  program
    .command('upgrade')
    .description('Update installed skills from the registry')
    .option('--dry-run', 'Show what would be updated without applying')
    .option('--yes', 'Apply all updates without confirmation')
    .option('--json', 'JSON output')
    .action(async (opts) => {
      if (opts.json) setJsonMode(true);

      const claudeDir = findClaudeDir();
      if (!claudeDir) { error('.claude/ not found in the current project'); return; }

      const config = await getConfig();
      if (!config.github?.registry) { error('Registry not configured'); return; }

      const spinner = ora('Comparing local skills with registry...').start();

      try {
        const { registry } = await getRegistryJson(config.github.registry);
        if (!registry) { spinner.fail('registry.json not found'); return; }

        const skillsDir = join(claudeDir, 'skills');
        if (!await fs.pathExists(skillsDir)) { spinner.fail('No skills/ directory'); return; }

        const localSkillDirs = (await fs.readdir(skillsDir, { withFileTypes: true }))
          .filter(d => d.isDirectory())
          .map(d => d.name);

        // Compare each local skill with registry version
        const updates = [];
        const upToDate = [];
        const localOnly = [];

        for (const skillId of localSkillDirs) {
          const localPath = join(skillsDir, skillId, 'SKILL.md');
          if (!await fs.pathExists(localPath)) continue;

          const localContent = await fs.readFile(localPath, 'utf8');
          const skill = registry.skills?.find(s => s.id === skillId);

          if (!skill) {
            localOnly.push(skillId);
            continue;
          }

          const category = skill.category || 'other';
          const { content: remoteContent } = await getFileContent(
            config.github.registry, `skills/${category}/${skillId}/SKILL.md`
          );

          if (!remoteContent) {
            localOnly.push(skillId);
            continue;
          }

          // Strip fork headers for comparison
          const cleanLocal = localContent.replace(/^<!-- Forked from .* -->\n/, '');
          const cleanRemote = remoteContent.replace(/^<!-- Forked from .* -->\n/, '');

          if (cleanLocal.trim() !== cleanRemote.trim()) {
            updates.push({
              id: skillId,
              category,
              localLength: localContent.length,
              remoteLength: remoteContent.length,
              remoteContent
            });
          } else {
            upToDate.push(skillId);
          }
        }

        spinner.stop();

        // Display report
        if (!opts.json) {
          sectionHeader('📦', 'Upgrade report');
          console.log('');
          console.log(`  ${c.muted('Up to date  :')} ${upToDate.length} skill(s)`);
          console.log(`  ${c.warn('Outdated    :')} ${updates.length} skill(s)`);
          console.log(`  ${c.muted('Local only  :')} ${localOnly.length} skill(s)`);

          if (updates.length > 0) {
            console.log('');
            for (const u of updates) {
              const diff = u.remoteLength - u.localLength;
              const diffLabel = diff > 0 ? c.success(`+${diff}`) : diff < 0 ? c.warn(`${diff}`) : c.muted('±0');
              console.log(`  ${c.warn('↑')} ${c.bold(u.id.padEnd(32))} ${diffLabel} chars`);
            }
          }

          if (localOnly.length > 0) {
            console.log('');
            for (const id of localOnly) {
              console.log(`  ${c.muted('·')} ${c.muted(id)} ${c.muted('(not in registry)')}`);
            }
          }
        }

        if (updates.length === 0) {
          outputResult(
            () => { console.log(''); success('All skills are up to date.'); },
            { status: 'up-to-date', upToDate: upToDate.length, updates: 0 }
          );
          return;
        }

        if (opts.dryRun) {
          outputResult(
            () => { console.log(''); info('Dry-run mode — no changes applied.'); },
            { status: 'dry-run', updates: updates.map(u => u.id) }
          );
          return;
        }

        // Select which to upgrade
        let toUpgrade = updates;
        if (!opts.yes) {
          console.log('');
          const selected = await checkbox({
            message: 'Skills to upgrade:',
            choices: updates.map(u => ({
              name: `${u.id.padEnd(32)} ${c.muted(u.category)}`,
              value: u,
              checked: true
            }))
          });
          toUpgrade = selected;
        }

        if (toUpgrade.length === 0) { info('No updates applied.'); return; }

        // Apply
        const applySpinner = ora('Upgrading...').start();
        const upgraded = [];
        for (const u of toUpgrade) {
          await installSkillLocally(claudeDir, u.id, u.remoteContent);
          upgraded.push(u.id);
        }
        applySpinner.succeed(`${upgraded.length} skill(s) upgraded`);

        outputResult(
          () => {
            for (const id of upgraded) {
              console.log(`  ${c.success('✓')} ${id}`);
            }
          },
          { status: 'upgraded', upgraded }
        );

      } catch (err_) {
        spinner.stop();
        error(err_.message);
      }
    });
}
