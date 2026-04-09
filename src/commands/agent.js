import { input, select, checkbox, confirm } from '@inquirer/prompts';
import ora from 'ora';
import { getConfig } from '../lib/config.js';
import { getRegistryJson, updateRegistryJson, createOrUpdateFile, getFileContent } from '../lib/github.js';
import { generateAgentPrompt, slugify } from '../lib/registry.js';
import {
  success, error, warn, info, c,
  sectionHeader, printAgentList,
  outputResult, setJsonMode
} from '../utils/display.js';

const MODELS = [
  { value: 'claude-opus-4-6',   name: 'Claude Opus 4.6   (most powerful)' },
  { value: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6 (balanced)' },
  { value: 'claude-haiku-4-5',  name: 'Claude Haiku 4.5  (fast)' }
];

export function registerAgentCommands(program) {
  const agent = program.command('agent').description('Manage agents');

  // ── agent:list ──────────────────────────────────────────────────────────────
  agent.command('list')
    .description('List all agents in the registry')
    .option('--json', 'JSON output')
    .action(async (opts) => {
      if (opts.json) setJsonMode(true);
      const config = await getConfig();
      if (!config.github?.registry) { error('Registry not configured'); return; }

      const spinner = ora('Loading...').start();
      const { registry } = await getRegistryJson(config.github.registry);
      spinner.stop();

      if (!registry) { error('registry.json not found'); return; }
      const agents = registry.agents || [];

      outputResult(
        () => {
          sectionHeader('🤖', `Agents (${agents.length})`);
          console.log('');
          console.log(
            `  ${'NAME'.padEnd(12)}${'ROLE'.padEnd(38)}${'MODEL'.padEnd(22)}SKILLS`
          );
          console.log(c.muted('  ' + '─'.repeat(80)));
          printAgentList(agents);
        },
        { agents }
      );
    });

  // ── agent:show ──────────────────────────────────────────────────────────────
  agent.command('show <id>')
    .description('Show agent details and skills')
    .option('--json', 'JSON output')
    .action(async (id, opts) => {
      if (opts.json) setJsonMode(true);
      const config = await getConfig();
      if (!config.github?.registry) { error('Registry not configured'); return; }

      const { registry } = await getRegistryJson(config.github.registry);
      const agent = registry?.agents?.find(a => a.id === id);
      if (!agent) { error(`Agent "${id}" not found`); return; }

      const skills = (agent.defaultSkills || []).map(sid =>
        registry.skills?.find(s => s.id === sid) || { id: sid }
      );

      outputResult(
        () => {
          console.log('');
          console.log(`  ${c.brand('●')} ${c.bold(agent.name)} — ${agent.role}`);
          console.log(`    Model: ${c.label(agent.model)}`);
          console.log('');
          sectionHeader('🛠️', `Skills (${skills.length})`);
          for (const s of skills) {
            console.log(`  ${c.success('✓')} ${c.bold(s.id.padEnd(32))} ${c.muted(s.description || '')}`);
          }
        },
        { agent, skills }
      );
    });

  // ── agent:create ────────────────────────────────────────────────────────────
  agent.command('create')
    .description('Create a new agent')
    .option('--id <id>', 'Agent ID')
    .option('--name <name>', 'Display name')
    .option('--role <role>', 'Role')
    .option('--model <model>', 'Claude model')
    .option('--skills <skills>', 'Default skills (comma-separated)')
    .option('--description <desc>', 'Description')
    .option('--publish', 'Publish to GitHub')
    .option('--yes', 'Skip interactive prompts')
    .option('--json', 'JSON output')
    .action(async (opts) => {
      if (opts.json) setJsonMode(true);

      let id = opts.id;
      let name = opts.name;
      let role = opts.role;
      let model = opts.model || 'claude-sonnet-4-6';
      let description = opts.description || '';
      let defaultSkills = opts.skills ? opts.skills.split(',').map(s => s.trim()) : [];

      if (!opts.yes) {
        if (!name) name = await input({ message: 'Agent name (e.g. Alex):' });
        if (!id) id = await input({ message: 'ID (slug):', default: slugify(name) });
        if (!role) role = await input({ message: 'Role:' });
        if (!opts.model) {
          model = await select({ message: 'Claude model:', choices: MODELS });
        }
        if (!description) description = await input({ message: 'Description (optional):' });

        // Suggest skills from the registry
        const config_ = await getConfig();
        if (config_.github?.registry) {
          const { registry } = await getRegistryJson(config_.github.registry);
          if (registry?.skills?.length > 0) {
            const choices = registry.skills.map(s => ({
              name: `${s.id.padEnd(30)} ${s.description || ''}`,
              value: s.id,
              checked: false
            }));
            defaultSkills = await checkbox({ message: 'Skills to assign:', choices });
          }
        }
      }

      if (!id || !name || !role) { error('id, name and role are required'); process.exit(1); }
      id = slugify(id);

      const newAgent = { id, name, role, model, description, defaultSkills };
      const agentPrompt = generateAgentPrompt(newAgent);

      const config = await getConfig();
      const results = { id, name, role, model, published: false };

      if (opts.publish) {
        if (!config.github?.registry) { error('Registry not configured'); process.exit(1); }
        const spinner = ora('Publishing to GitHub...').start();
        try {
          // Add agent to registry.json
          const { registry, sha } = await getRegistryJson(config.github.registry);
          if (registry) {
            if (!registry.agents) registry.agents = [];
            if (!registry.agents.find(a => a.id === id)) {
              registry.agents.push(newAgent);
              await updateRegistryJson(config.github.registry, registry, sha);
            }
          }

          // Create the agents/<id>.md file
          const { sha: agentSha } = await getFileContent(config.github.registry, `agents/${id}.md`);
          await createOrUpdateFile(
            config.github.registry, `agents/${id}.md`,
            agentPrompt, `feat: add agent ${id} [esk]`, agentSha
          );

          spinner.succeed('Published to GitHub');
          results.published = true;
        } catch (err_) {
          spinner.fail('Publishing error');
          error(err_.message);
        }
      }

      outputResult(
        () => {
          success(`Agent ${c.bold(name)} (${id}) created`);
          if (defaultSkills.length > 0) {
            info(`Skills: ${defaultSkills.join(', ')}`);
          }
        },
        { success: true, ...results }
      );
    });

  // ── agent:add-skill ─────────────────────────────────────────────────────────
  agent.command('add-skill <agentId> <skillId>')
    .description('Assign a skill to an agent in the global registry')
    .option('--json', 'JSON output')
    .action(async (agentId, skillId, opts) => {
      if (opts.json) setJsonMode(true);
      const config = await getConfig();
      if (!config.github?.registry) { error('Registry not configured'); return; }

      const spinner = ora('Updating...').start();
      try {
        const { registry, sha } = await getRegistryJson(config.github.registry);
        const agent = registry?.agents?.find(a => a.id === agentId);
        if (!agent) { spinner.fail(`Agent "${agentId}" not found`); return; }

        if (!agent.defaultSkills) agent.defaultSkills = [];
        if (agent.defaultSkills.includes(skillId)) {
          spinner.stop();
          warn(`Skill "${skillId}" already assigned to ${agentId}`);
          return;
        }
        agent.defaultSkills.push(skillId);
        await updateRegistryJson(config.github.registry, registry, sha);
        spinner.succeed('Registry updated');

        outputResult(
          () => success(`${c.bold(skillId)} → ${c.bold(agentId)}`),
          { success: true, agent: agentId, skill: skillId, filesModified: ['registry.json'] }
        );
      } catch (err_) {
        spinner.fail('Error');
        error(err_.message);
      }
    });

  // ── agent:remove-skill ──────────────────────────────────────────────────────
  agent.command('remove-skill <agentId> <skillId>')
    .description('Remove a skill from an agent in the registry')
    .option('--json', 'JSON output')
    .action(async (agentId, skillId, opts) => {
      if (opts.json) setJsonMode(true);
      const config = await getConfig();
      if (!config.github?.registry) { error('Registry not configured'); return; }

      const { registry, sha } = await getRegistryJson(config.github.registry);
      const agent = registry?.agents?.find(a => a.id === agentId);
      if (!agent) { error(`Agent "${agentId}" not found`); return; }

      agent.defaultSkills = (agent.defaultSkills || []).filter(s => s !== skillId);
      await updateRegistryJson(config.github.registry, registry, sha);

      outputResult(
        () => success(`Skill ${c.bold(skillId)} removed from ${c.bold(agentId)}`),
        { success: true, agent: agentId, skill: skillId }
      );
    });

  // ── agent:publish ───────────────────────────────────────────────────────────
  agent.command('publish <id>')
    .description('Publish/update an agent to GitHub')
    .option('--yes', 'Skip confirmation')
    .option('--json', 'JSON output')
    .action(async (id, opts) => {
      if (opts.json) setJsonMode(true);
      const config = await getConfig();
      if (!config.github?.registry) { error('Registry not configured'); return; }

      const { registry } = await getRegistryJson(config.github.registry);
      const agent = registry?.agents?.find(a => a.id === id);
      if (!agent) { error(`Agent "${id}" not found in the registry`); return; }

      const skills = (agent.defaultSkills || []).map(sid =>
        registry.skills?.find(s => s.id === sid) || { id: sid }
      );
      const prompt = generateAgentPrompt(agent, skills);

      const spinner = ora(`Publishing agent ${id}...`).start();
      try {
        const { sha } = await getFileContent(config.github.registry, `agents/${id}.md`);
        await createOrUpdateFile(
          config.github.registry, `agents/${id}.md`,
          prompt, `chore: update agent ${id} [esk]`, sha
        );
        spinner.succeed('Published');

        outputResult(
          () => success(`Agent ${c.bold(id)} published`),
          { success: true, id }
        );
      } catch (err_) {
        spinner.fail('Error');
        error(err_.message);
      }
    });
}
