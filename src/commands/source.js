import ora from 'ora';
import chalk from 'chalk';
import { getConfig, saveConfig } from '../lib/config.js';
import { checkRepoAccess } from '../lib/github.js';
import { success, error, warn, c, sectionHeader, outputResult, setJsonMode } from '../utils/display.js';

// ─── Sources ─────────────────────────────────────────────────────────────────

export function registerSourceCommands(program) {
  const source = program.command('source').description('Manage skill sources');

  source.command('list')
    .description('List configured sources')
    .option('--json', 'JSON output')
    .action(async (opts) => {
      if (opts.json) setJsonMode(true);
      const config = await getConfig();
      const sources = config.sources || [];

      outputResult(
        () => {
          sectionHeader('🔗', 'Configured sources');
          console.log('');
          for (const s of sources) {
            const status = s.enabled ? c.success('✓') : c.muted('○');
            const trusted = s.trusted ? chalk.green(' [OFFICIAL]') : '';
            const priv = s.private ? c.muted(' [private]') : '';
            console.log(`  ${status} ${c.bold(s.id.padEnd(22))} ${(s.label || '').padEnd(32)}${trusted}${priv}`);
            if (s.repo) console.log(`      ${c.muted('repo: ' + s.repo)}`);
            if (s.topic) console.log(`      ${c.muted('topic: ' + s.topic)}`);
            if (s.topics) console.log(`      ${c.muted('topics: ' + s.topics.join(', '))}`);
          }
        },
        { sources }
      );
    });

  source.command('add <repo>')
    .description('Add a third-party registry (e.g. johndoe/esk-registry)')
    .option('--private', 'Private registry (requires token with access)')
    .option('--label <label>', 'Display name')
    .option('--json', 'JSON output')
    .action(async (repo, opts) => {
      if (opts.json) setJsonMode(true);
      const spinner = ora(`Checking ${repo}...`).start();

      try {
        await checkRepoAccess(repo);
        spinner.stop();

        const config = await getConfig();
        const id = repo.replace('/', '-').toLowerCase();
        const exists = config.sources?.find(s => s.repo === repo);

        if (exists) {
          warn(`Source "${repo}" already configured`);
          return;
        }

        if (!config.sources) config.sources = [];
        config.sources.push({
          id,
          type: 'github-repo',
          label: opts.label || repo,
          repo,
          private: !!opts.private,
          priority: config.sources.length + 1,
          enabled: true
        });
        await saveConfig(config);

        outputResult(
          () => success(`Source ${c.bold(repo)} added`),
          { success: true, id, repo }
        );
      } catch (err_) {
        spinner.fail('Repository inaccessible');
        error(err_.message);
      }
    });

  source.command('disable <id>')
    .description('Disable a source')
    .action(async (id) => {
      const config = await getConfig();
      const source = config.sources?.find(s => s.id === id);
      if (!source) { error(`Source "${id}" not found`); return; }
      source.enabled = false;
      await saveConfig(config);
      success(`Source ${c.bold(id)} disabled`);
    });

  source.command('enable <id>')
    .description('Enable a source')
    .action(async (id) => {
      const config = await getConfig();
      const source = config.sources?.find(s => s.id === id);
      if (!source) { error(`Source "${id}" not found`); return; }
      source.enabled = true;
      await saveConfig(config);
      success(`Source ${c.bold(id)} enabled`);
    });

  source.command('remove <id>')
    .description('Remove a source')
    .action(async (id) => {
      const config = await getConfig();
      config.sources = (config.sources || []).filter(s => s.id !== id);
      await saveConfig(config);
      success(`Source ${c.bold(id)} removed`);
    });
}

// ─── User Config ─────────────────────────────────────────────────────────────

export function registerConfigCommands(program) {
  const cfg = program.command('config').description('esk user preferences');

  cfg.command('set <key> <value>')
    .description('Set a preference (e.g. esk config:set markdownView rendered)')
    .action(async (key, value) => {
      const { getConfig, saveConfig } = await import('../lib/config.js');
      const { success, error, c } = await import('../utils/display.js');
      const config = await getConfig();

      const allowed = {
        markdownView: ['raw', 'rendered', 'both']
      };

      if (!allowed[key]) {
        error(`Unknown key "${key}". Available keys: ${Object.keys(allowed).join(', ')}`);
        return;
      }
      if (!allowed[key].includes(value)) {
        error(`Invalid value "${value}". Allowed values: ${allowed[key].join(', ')}`);
        return;
      }

      if (!config.preferences) config.preferences = {};
      config.preferences[key] = value;
      await saveConfig(config);
      success(`${c.bold(key)} = ${c.label(value)}`);
    });

  cfg.command('get [key]')
    .description('Show preferences')
    .action(async (key) => {
      const { getConfig } = await import('../lib/config.js');
      const { c } = await import('../utils/display.js');
      const config = await getConfig();
      const prefs = config.preferences || {};
      if (key) {
        console.log(`${key} = ${prefs[key] ?? '(not set)'}`);
      } else {
        console.log('');
        console.log(`  ${c.bold('esk Preferences')}`);
        console.log('');
        for (const [k, v] of Object.entries(prefs)) {
          console.log(`  ${c.muted(k.padEnd(20))} ${c.label(v)}`);
        }
        console.log('');
        console.log(`  ${c.muted('Update:')} esk config:set markdownView [raw|rendered|both]`);
      }
    });
}
