#!/usr/bin/env node
import { program } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8'));

import { registerGithubCommands } from '../src/commands/github.js';
import { registerSkillCommands } from '../src/commands/skill.js';
import { registerAgentCommands } from '../src/commands/agent.js';
import { registerProjectCommands } from '../src/commands/project.js';
import { registerSourceCommands, registerConfigCommands } from '../src/commands/source.js';
import { registerInitCommand } from '../src/commands/init.js';
import { registerDiscoverCommand } from '../src/commands/discover.js';
import { registerReconcileCommand } from '../src/commands/reconcile.js';
import { registerHelpCommand } from '../src/commands/help.js';

program
  .name('esk')
  .description('The package manager for your Claude Code agents')
  .version(pkg.version);

registerGithubCommands(program);
registerSkillCommands(program);
registerAgentCommands(program);
registerProjectCommands(program);
registerSourceCommands(program);
registerInitCommand(program);
registerDiscoverCommand(program);
registerConfigCommands(program);
registerReconcileCommand(program);
registerHelpCommand(program);

program.parse();
