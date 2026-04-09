import { c } from '../utils/display.js';

export function registerHelpCommand(program) {
  // Override the global --help with an enriched version
  program.addHelpText('afterAll', buildFullHelp());

  // Detailed esk help command
  program
    .command('commands')
    .description('List all available commands')
    .action(() => {
      console.log(buildFullHelp());
    });
}

function buildFullHelp() {
  const lines = [];
  const s = (txt) => lines.push(txt);

  s('');
  s(`  ${c.bold('All esk commands')}`);
  s('');

  const sections = [
    {
      icon: '🔐', title: 'Authentication',
      commands: [
        ['esk github:login',              'OAuth Device Flow — opens your browser'],
        ['esk github:logout',             'Disconnect from GitHub'],
        ['esk github:status',             'Check connection status'],
        ['esk github:registry set <repo>','Set the private GitHub registry'],
      ]
    },
    {
      icon: '🤖', title: 'Agents',
      commands: [
        ['esk agent:list',                       'List all agents in the registry'],
        ['esk agent:show <id>',                  'Show agent details + skills'],
        ['esk agent:create',                     'Create a new agent (interactive or --yes)'],
        ['esk agent:add-skill <agent> <skill>',  'Assign a skill to an agent'],
        ['esk agent:remove-skill <agent> <sk>',  'Remove a skill from an agent'],
        ['esk agent:publish <id>',               'Push to GitHub'],
      ]
    },
    {
      icon: '🛠️', title: 'Skills',
      commands: [
        ['esk skill:list',               'List skills (--category to filter)'],
        ['esk skill:search <query>',     'Multi-source search (--all, --source)'],
        ['esk skill:create',             'Create a new skill (interactive or --yes)'],
        ['esk skill:import <repo> <id>','Import from a third-party registry'],
        ['esk skill:publish <id>',       'Publish to GitHub'],
        ['esk skill:add <agent> <sk>',   'Assign skill to agent in the global registry'],
      ]
    },
    {
      icon: '📁', title: 'Current project (.claude/)',
      commands: [
        ['esk init',                              'Initialize .claude/ (interactive)'],
        ['esk project:status',                    'Full project audit'],
        ['esk project:reconcile',                 'Reconcile skills↔agents (--dry-run, --yes)'],
        ['esk project:agent:add <id>',            'Add an agent to the project'],
        ['esk project:agent:remove <id>',         'Remove an agent from the project'],
        ['esk project:agent:add-skill <a> <sk>',  'Assign skill → agent (--install)'],
        ['esk project:agent:status <id>',         'Show active skills for an agent'],
        ['esk project:skill:install <id>',        'Install a skill from the registry'],
        ['esk project:skill:create',              'Create + install locally'],
        ['esk project:skill:publish <id>',        'Promote to the registry'],
      ]
    },
    {
      icon: '🔍', title: 'Discovery',
      commands: [
        ['esk discover',               'Explore the current project'],
        ['esk discover <./path>',      'Explore a local directory'],
        ['esk discover <user/repo>',   'Explore a GitHub registry'],
        ['esk discover --all',         'Browse all public esk registries'],
      ]
    },
    {
      icon: '🔗', title: 'Sources',
      commands: [
        ['esk source:list',           'List configured sources'],
        ['esk source:add <repo>',     'Add a third-party registry'],
        ['esk source:enable <id>',    'Enable a source'],
        ['esk source:disable <id>',   'Disable a source'],
        ['esk source:remove <id>',    'Remove a source'],
      ]
    },
    {
      icon: '⚙️', title: 'Preferences',
      commands: [
        ['esk config:get',                      'View preferences'],
        ['esk config:set markdownView rendered', 'Markdown format: raw | rendered | both'],
      ]
    },
  ];

  for (const section of sections) {
    s(`  ${section.icon}  ${c.bold(section.title)}`);
    s(c.muted('  ' + '─'.repeat(60)));
    for (const [cmd, desc] of section.commands) {
      s(`  ${c.label(cmd.padEnd(44))} ${c.muted(desc)}`);
    }
    s('');
  }

  s(c.muted('  Options available on all commands:'));
  s(c.muted('  --yes    Skip interactive prompts (agent mode)'));
  s(c.muted('  --json   Parsable JSON output (agent mode)'));
  s('');

  return lines.join('\n');
}
