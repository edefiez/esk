import { input, confirm } from '@inquirer/prompts';
import ora from 'ora';
import { getConfig, updateConfig } from '../lib/config.js';
import { getAuthenticatedUser, createOrUpdateFile } from '../lib/github.js';
import { emptyRegistry } from '../lib/registry.js';
import {
  success, error, info, c,
  outputResult, setJsonMode
} from '../utils/display.js';

const GH_API = 'https://api.github.com';

export function registerRegistryInitCommand(program) {
  program
    .command('registry:init')
    .description('Create a new registry repo on GitHub with the base structure')
    .option('--name <name>', 'Repository name (default: esk-registry)')
    .option('--private', 'Create as private repo')
    .option('--yes', 'Skip confirmation')
    .option('--json', 'JSON output')
    .action(async (opts) => {
      if (opts.json) setJsonMode(true);

      const config = await getConfig();
      if (!config.github?.token) { error('Not connected to GitHub. Run: esk github:login'); return; }

      const user = await getAuthenticatedUser();
      let repoName = opts.name || 'esk-registry';

      if (!opts.yes) {
        repoName = await input({ message: 'Repository name:', default: repoName });
      }

      const fullName = `${user.login}/${repoName}`;
      const visibility = opts.private ? 'private' : 'public';

      if (!opts.yes) {
        console.log('');
        console.log(`  ${c.bold('New esk registry')}`);
        console.log(`  ${c.muted('Repo       :')} ${c.label(fullName)}`);
        console.log(`  ${c.muted('Visibility :')} ${visibility}`);
        console.log(`  ${c.muted('Structure  :')} registry.json + agents/ + skills/`);
        console.log('');
        const ok = await confirm({ message: 'Create this registry?' });
        if (!ok) return;
      }

      const spinner = ora('Creating repository...').start();

      try {
        // 1. Create the repo
        const token = config.github.token;
        const createRes = await fetch(`${GH_API}/user/repos`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: repoName,
            description: 'esk registry — agents & skills for Claude Code',
            private: !!opts.private,
            auto_init: true  // Creates with a README
          })
        });

        if (!createRes.ok) {
          const err = await createRes.json().catch(() => ({}));
          spinner.fail('Failed to create repository');
          error(err.message || `GitHub API ${createRes.status}`);
          return;
        }

        spinner.text = 'Setting up registry structure...';

        // 2. Create registry.json
        const registry = emptyRegistry();
        await createOrUpdateFile(
          fullName, 'registry.json',
          JSON.stringify(registry, null, 2),
          'feat: initialize esk registry [esk]'
        );

        // 3. Create agents/.gitkeep
        await createOrUpdateFile(
          fullName, 'agents/.gitkeep', '',
          'chore: create agents directory [esk]'
        );

        // 4. Create skills/.gitkeep
        await createOrUpdateFile(
          fullName, 'skills/.gitkeep', '',
          'chore: create skills directory [esk]'
        );

        // 5. Add esk-registry topic
        await fetch(`${GH_API}/repos/${fullName}/topics`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ names: ['esk-registry'] })
        }).catch(() => {});

        // 6. Configure as the active registry
        await updateConfig('github.registry', fullName);

        spinner.succeed('Registry created');

        outputResult(
          () => {
            console.log('');
            success(`Registry ${c.bold(fullName)} created on GitHub`);
            console.log('');
            console.log(`  ${c.success('✓')} registry.json initialized`);
            console.log(`  ${c.success('✓')} agents/ directory created`);
            console.log(`  ${c.success('✓')} skills/ directory created`);
            console.log(`  ${c.success('✓')} Topic ${c.label('esk-registry')} added`);
            console.log(`  ${c.success('✓')} Set as active registry in ~/.esk/config.json`);
            console.log('');
            console.log(`  ${c.muted('Next steps:')}`);
            console.log(`  ${c.muted('  esk agent:create --publish   → create your first agent')}`);
            console.log(`  ${c.muted('  esk skill:create --publish   → create your first skill')}`);
            console.log(`  ${c.muted('  esk discover ' + fullName + '  → verify')}`);
          },
          { success: true, repo: fullName, private: !!opts.private }
        );

      } catch (err_) {
        spinner.fail('Error');
        error(err_.message);
      }
    });
}
