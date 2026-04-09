import ora from 'ora';
import open from 'open';
import chalk from 'chalk';
import { getConfig, updateConfig, saveConfig } from '../lib/config.js';
import { githubDeviceFlow, getAuthenticatedUser, checkRepoAccess } from '../lib/github.js';
import { success, error, info, c, outputResult, setJsonMode } from '../utils/display.js';

export function registerGithubCommands(program) {
  const gh = program.command('github').description('GitHub authentication management');

  // ── github:login ────────────────────────────────────────────────────────────
  gh.command('login')
    .description('Connect to GitHub via OAuth (Device Flow)')
    .option('--json', 'JSON output')
    .action(async (opts) => {
      if (opts.json) setJsonMode(true);
      const spinner = ora('Initializing GitHub authentication...').start();

      try {
        const flow = await githubDeviceFlow();
        spinner.stop();

        console.log('');
        console.log(c.bold('  GitHub Authentication'));
        console.log('');
        console.log(`  Open your browser at : ${chalk.underline(flow.verificationUri)}`);
        console.log(`  Enter the code       : ${c.brand(chalk.bold(flow.userCode))}`);
        console.log('');

        // Open browser automatically
        await open(flow.verificationUri).catch(() => {});

        const pollSpinner = ora('Waiting for GitHub authorization...').start();

        // Poll until token is obtained
        let token = null;
        const maxWait = flow.expiresIn * 1000;
        const started = Date.now();

        while (!token && Date.now() - started < maxWait) {
          await sleep(flow.interval * 1000);
          token = await flow.poll().catch(() => null);
        }

        if (!token) {
          pollSpinner.fail('Authorization timeout.');
          return;
        }

        pollSpinner.succeed('Authorized!');

        // Retrieve user profile
        const config = await getConfig();
        config.github.token = token;
        await saveConfig(config);

        const user = await getAuthenticatedUser();
        await updateConfig('github.username', user.login);

        outputResult(
          () => {
            success(`Connected as ${c.bold(user.login)}`);
            info('Token saved to ~/.esk/config.json');
            info('Now configure your registry: esk github:registry set <user/repo>');
          },
          { success: true, username: user.login }
        );
      } catch (err_) {
        spinner.fail('Authentication error');
        error(err_.message);
        process.exit(1);
      }
    });

  // ── github:logout ───────────────────────────────────────────────────────────
  gh.command('logout')
    .description('Disconnect from GitHub')
    .action(async () => {
      const config = await getConfig();
      config.github.token = null;
      config.github.username = null;
      await saveConfig(config);
      success('Disconnected from GitHub');
    });

  // ── github:status ───────────────────────────────────────────────────────────
  gh.command('status')
    .description('Check GitHub connection status')
    .option('--json', 'JSON output')
    .action(async (opts) => {
      if (opts.json) setJsonMode(true);
      const config = await getConfig();

      if (!config.github?.token) {
        outputResult(
          () => error('Not connected. Run: esk github:login'),
          { connected: false }
        );
        return;
      }

      const spinner = ora('Checking...').start();
      try {
        const user = await getAuthenticatedUser();
        const registryAccess = config.github.registry
          ? await checkRepoAccess(config.github.registry).then(() => true).catch(() => false)
          : null;

        spinner.stop();
        outputResult(
          () => {
            success(`Connected: ${c.bold(user.login)}`);
            if (config.github.registry) {
              const accessIcon = registryAccess ? c.success('✓') : c.error('✗');
              console.log(`  ${accessIcon} Registry: ${config.github.registry}`);
            } else {
              info('No registry configured — run: esk github:registry set <user/repo>');
            }
          },
          { connected: true, username: user.login, registry: config.github.registry, registryAccess }
        );
      } catch (err_) {
        spinner.fail('Invalid or expired token');
        error(err_.message);
      }
    });

  // ── github:registry ─────────────────────────────────────────────────────────
  const registry = gh.command('registry').description('Manage the GitHub registry');

  registry.command('set <repo>')
    .description('Set the registry repo (e.g. edefiez/esk-registry)')
    .option('--json', 'JSON output')
    .action(async (repo, opts) => {
      if (opts.json) setJsonMode(true);
      const spinner = ora(`Checking access to ${repo}...`).start();
      try {
        await checkRepoAccess(repo);
        await updateConfig('github.registry', repo);
        spinner.stop();
        outputResult(
          () => success(`Registry configured: ${c.bold(repo)}`),
          { success: true, registry: repo }
        );
      } catch (err_) {
        spinner.fail('Repository inaccessible');
        error(err_.message);
        process.exit(1);
      }
    });

  registry.command('get')
    .description('Show the configured registry')
    .action(async () => {
      const config = await getConfig();
      if (config.github?.registry) {
        console.log(config.github.registry);
      } else {
        error('No registry configured');
      }
    });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
