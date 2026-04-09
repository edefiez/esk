import ora from 'ora';
import fs from 'fs-extra';
import { join } from 'path';
import { getConfig } from '../lib/config.js';
import { getRegistryJson, getFileContent } from '../lib/github.js';
import { findClaudeDir } from '../lib/registry.js';
import {
  success, error, info, c,
  sectionHeader, outputResult, setJsonMode
} from '../utils/display.js';

export function registerDiffCommand(program) {
  program
    .command('diff <skillId>')
    .description('Compare a local skill with the registry version')
    .option('--json', 'JSON output')
    .action(async (skillId, opts) => {
      if (opts.json) setJsonMode(true);

      const claudeDir = findClaudeDir();
      if (!claudeDir) { error('.claude/ not found'); return; }

      const config = await getConfig();
      if (!config.github?.registry) { error('Registry not configured'); return; }

      const localPath = join(claudeDir, 'skills', skillId, 'SKILL.md');
      if (!await fs.pathExists(localPath)) {
        error(`Skill "${skillId}" not found in .claude/skills/`);
        return;
      }

      const spinner = ora('Fetching registry version...').start();
      try {
        const localContent = await fs.readFile(localPath, 'utf8');

        const { registry } = await getRegistryJson(config.github.registry);
        const skill = registry?.skills?.find(s => s.id === skillId);
        const category = skill?.category || 'other';

        const { content: remoteContent } = await getFileContent(
          config.github.registry, `skills/${category}/${skillId}/SKILL.md`
        );
        spinner.stop();

        if (!remoteContent) {
          outputResult(
            () => {
              info(`Skill "${skillId}" exists locally but not in the registry.`);
              info('Use `esk skill:publish` to publish it.');
            },
            { status: 'local-only', id: skillId }
          );
          return;
        }

        // Compare
        const localLines = localContent.split('\n');
        const remoteLines = remoteContent.split('\n');
        const cleanLocal = localContent.replace(/^<!-- Forked from .* -->\n/, '').trim();
        const cleanRemote = remoteContent.replace(/^<!-- Forked from .* -->\n/, '').trim();

        if (cleanLocal === cleanRemote) {
          outputResult(
            () => success(`Skill "${skillId}" is identical to the registry version.`),
            { status: 'identical', id: skillId }
          );
          return;
        }

        // Build simple line-by-line diff
        const diff = buildDiff(localLines, remoteLines);

        outputResult(
          () => {
            sectionHeader('📝', `Diff: ${skillId}`);
            console.log(`  ${c.muted('local')}  .claude/skills/${skillId}/SKILL.md`);
            console.log(`  ${c.muted('remote')} ${config.github.registry}:skills/${category}/${skillId}/SKILL.md`);
            console.log('');
            console.log(c.muted('─'.repeat(60)));

            for (const line of diff) {
              if (line.type === 'added') {
                console.log(c.success(`+ ${line.text}`));
              } else if (line.type === 'removed') {
                console.log(c.error(`- ${line.text}`));
              } else {
                console.log(c.muted(`  ${line.text}`));
              }
            }
            console.log(c.muted('─'.repeat(60)));
            console.log('');

            const added = diff.filter(l => l.type === 'added').length;
            const removed = diff.filter(l => l.type === 'removed').length;
            console.log(`  ${c.success(`+${added}`)} ${c.error(`-${removed}`)} lines changed`);
          },
          {
            status: 'different',
            id: skillId,
            localLines: localLines.length,
            remoteLines: remoteLines.length,
            added: diff.filter(l => l.type === 'added').length,
            removed: diff.filter(l => l.type === 'removed').length
          }
        );

      } catch (err_) {
        spinner.stop();
        error(err_.message);
      }
    });
}

// Simple line diff (no external dependency)
function buildDiff(localLines, remoteLines) {
  const result = [];
  const maxLen = Math.max(localLines.length, remoteLines.length);
  const localSet = new Set(localLines);
  const remoteSet = new Set(remoteLines);

  // Show lines unique to local (removed from remote perspective) and shared
  const allLines = [];
  for (const line of localLines) {
    if (!remoteSet.has(line)) {
      allLines.push({ type: 'removed', text: line });
    } else {
      allLines.push({ type: 'same', text: line });
    }
  }
  for (const line of remoteLines) {
    if (!localSet.has(line)) {
      allLines.push({ type: 'added', text: line });
    }
  }

  // Compact: show context around changes
  const changes = allLines.filter(l => l.type !== 'same');
  if (changes.length === 0) return [{ type: 'same', text: '(no visible differences)' }];

  // Just return all lines for simplicity — keeps it readable
  return allLines;
}
