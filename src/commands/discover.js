import { select, checkbox, confirm } from '@inquirer/prompts';
import ora from 'ora';
import fs from 'fs-extra';
import { join, resolve, isAbsolute } from 'path';
import { marked } from 'marked';
import { markedTerminal } from 'marked-terminal';
import { getConfig, saveConfig } from '../lib/config.js';
import { getRegistryJson, getFileContent } from '../lib/github.js';
import { findClaudeDir, installSkillLocally } from '../lib/registry.js';
import {
  sectionHeader, success, error, warn, info, c,
  outputResult, setJsonMode
} from '../utils/display.js';

const GH_API = 'https://api.github.com';

// ─── Markdown Rendering ──────────────────────────────────────────────────────

marked.use(markedTerminal());

async function getMarkdownView() {
  const config = await getConfig();
  return config.preferences?.markdownView || 'rendered';
}

function renderMarkdown(content, view) {
  const separator = c.muted('─'.repeat(60));

  if (view === 'raw') {
    console.log('');
    console.log(separator);
    console.log(content);
    console.log(separator);
    return;
  }

  if (view === 'rendered') {
    console.log('');
    console.log(separator);
    console.log(marked(content));
    console.log(separator);
    return;
  }

  if (view === 'both') {
    console.log('');
    console.log(`  ${c.label('── Raw Markdown ──')}`);
    console.log(separator);
    console.log(content);
    console.log(separator);
    console.log('');
    console.log(`  ${c.label('── Terminal Render ──')}`);
    console.log(separator);
    console.log(marked(content));
    console.log(separator);
  }
}

// ─── Main Entry ──────────────────────────────────────────────────────────────

export function registerDiscoverCommand(program) {
  program
    .command('discover [target]')
    .description('Explore a registry — GitHub (user/repo), local path or current project')
    .option('--all', 'Explore all public esk registries (topic: esk-registry)')
    .option('--format <format>', 'Display format: raw | rendered | both (overrides config)')
    .option('--json', 'JSON output')
    .action(async (target, opts) => {
      if (opts.json) setJsonMode(true);

      // Override format if passed as argument
      if (opts.format) {
        const config = await getConfig();
        if (!config.preferences) config.preferences = {};
        config.preferences._markdownViewOverride = opts.format;
        await saveConfig(config);
      }

      if (opts.all) { await discoverAll(opts); return; }
      if (!target || target === '.') { await discoverLocal(process.cwd(), opts); return; }
      if (isLocalPath(target)) {
        await discoverLocal(resolve(target.replace(/^~/, process.env.HOME || '')), opts);
        return;
      }
      await discoverRemote(target, opts);
    });
}

function isLocalPath(target) {
  return (
    target.startsWith('./') || target.startsWith('../') ||
    target.startsWith('/') || target.startsWith('~') ||
    isAbsolute(target)
  );
}

// ─── DISCOVER LOCAL ───────────────────────────────────────────────────────────

async function discoverLocal(dirPath, opts) {
  const spinner = ora(`Scanning ${c.label(dirPath)}...`).start();

  try {
    if (!await fs.pathExists(dirPath)) {
      spinner.fail(`Directory not found: ${dirPath}`); return;
    }

    const result = await scanLocalDir(dirPath);
    spinner.stop();

    if (!opts.json) {
      printLocalHeader(result, dirPath);

      // ── Navigation loop ──────────────────────────────────────────────────
      if (result.hasClaudeDir || result.hasRegistryJson) {
        await localNavigationLoop(result, dirPath);
      } else {
        console.log('');
        warn('No esk structure detected.');
        info('Run `esk init` to initialize .claude/ in this project.');
      }
    }

    outputResult(() => {}, result);

  } catch (err_) {
    spinner.fail('Error during scan');
    error(err_.message);
  }
}

async function scanLocalDir(dirPath) {
  const result = {
    type: 'local', path: dirPath,
    hasClaudeDir: false, hasEskJson: false, hasRegistryJson: false,
    agents: [], skills: [], eskManifest: null, registry: null, packageInfo: null
  };

  const claudeDir = join(dirPath, '.claude');
  result.hasClaudeDir = await fs.pathExists(claudeDir);

  if (result.hasClaudeDir) {
    const eskJsonPath = join(claudeDir, 'esk.json');
    result.hasEskJson = await fs.pathExists(eskJsonPath);
    if (result.hasEskJson) result.eskManifest = await fs.readJson(eskJsonPath).catch(() => null);

    const agentsDir = join(claudeDir, 'agents');
    if (await fs.pathExists(agentsDir)) {
      const files = (await fs.readdir(agentsDir)).filter(f => f.endsWith('.md'));
      for (const file of files) {
        const id = file.replace('.md', '');
        const content = await fs.readFile(join(agentsDir, file), 'utf8');
        const headline = content.split('\n')[0].replace(/^# /, '');
        const inManifest = result.eskManifest?.agents?.find(a => a.id === id);
        result.agents.push({ id, headline, file, skills: inManifest?.skills || [], content });
      }
    }

    const skillsDir = join(claudeDir, 'skills');
    if (await fs.pathExists(skillsDir)) {
      const entries = await fs.readdir(skillsDir, { withFileTypes: true });
      for (const entry of entries.filter(e => e.isDirectory())) {
        const skillMdPath = join(skillsDir, entry.name, 'SKILL.md');
        const hasSkillMd = await fs.pathExists(skillMdPath);
        let description = '';
        let content = '';
        if (hasSkillMd) {
          content = await fs.readFile(skillMdPath, 'utf8');
          const lines = content.split('\n');
          const idx = lines.findIndex(l => l.startsWith('## Description'));
          if (idx >= 0) description = lines[idx + 1]?.trim() || '';
        }
        result.skills.push({ id: entry.name, hasSkillMd, description, content });
      }
    }
  }

  const registryPath = join(dirPath, 'registry.json');
  result.hasRegistryJson = await fs.pathExists(registryPath);
  if (result.hasRegistryJson) result.registry = await fs.readJson(registryPath).catch(() => null);

  const pkgPath = join(dirPath, 'package.json');
  if (await fs.pathExists(pkgPath)) {
    const pkg = await fs.readJson(pkgPath).catch(() => null);
    if (pkg) result.packageInfo = { name: pkg.name, version: pkg.version, description: pkg.description };
  }

  return result;
}

function printLocalHeader(result, dirPath) {
  console.log('');
  console.log(`  ${c.brand('◈')} ${c.bold('Discovery')} — ${c.label('local')}  ${c.muted(dirPath)}`);
  console.log(c.muted('  ' + '─'.repeat(58)));
  console.log('');

  if (result.packageInfo) {
    console.log(`  ${c.muted('Project   :')} ${c.bold(result.packageInfo.name || '—')} ${result.packageInfo.version ? c.muted('v' + result.packageInfo.version) : ''}`);
  }

  console.log(`  ${c.muted('.claude/  :')} ${result.hasClaudeDir ? c.success('✓ present') : c.warn('✗ missing')}`);
  if (result.hasClaudeDir) {
    console.log(`  ${c.muted('esk.json  :')} ${result.hasEskJson ? c.success('✓ ' + (result.eskManifest?.project || 'present')) : c.muted('— missing')}`);
  }
  console.log(`  ${c.muted('registry  :')} ${result.hasRegistryJson ? c.success('✓ registry.json' + (result.registry?.version ? ' v' + result.registry.version : '')) : c.muted('— missing')}`);

  if (result.agents.length > 0) {
    sectionHeader('🤖', `Installed agents (${result.agents.length})`);
    for (const agent of result.agents) {
      console.log(
        `  ${c.success('✓')} ${c.bold(agent.id.padEnd(16))}` +
        `${c.muted(agent.headline.substring(0, 42).padEnd(44))}` +
        `${c.label(agent.skills.length + ' skills')}`
      );
    }
  }

  if (result.skills.length > 0) {
    sectionHeader('🛠️', `Installed skills (${result.skills.length})`);
    for (const skill of result.skills) {
      const icon = skill.hasSkillMd ? c.success('✓') : c.warn('⚠');
      console.log(`  ${icon} ${c.bold(skill.id.padEnd(32))} ${c.muted(skill.description || '')}`);
    }
  }

  if (result.hasRegistryJson && result.registry) {
    sectionHeader('📦', 'Root esk registry');
    console.log(`  ${c.muted('Agents:')} ${result.registry.agents?.length || 0}   ${c.muted('Skills:')} ${result.registry.skills?.length || 0}`);
  }
}

async function localNavigationLoop(result, dirPath) {
  const claudeDir = join(dirPath, '.claude');
  const view = await getMarkdownView();

  while (true) {
    console.log('');
    const choices = [];
    if (result.agents.length > 0) choices.push({ value: 'agent', name: '🤖  View an agent' });
    if (result.skills.length > 0) choices.push({ value: 'skill', name: '🛠️  Read a SKILL.md' });
    choices.push({ value: 'format', name: `🎨  Change display format (current: ${c.label(view)})` });
    choices.push({ value: 'quit', name: '✕  Quit' });

    const action = await select({ message: 'What would you like to do?', choices });
    if (action === 'quit') break;

    if (action === 'format') {
      await changeFormatPreference();
      continue;
    }

    if (action === 'agent') {
      await agentLoop(result.agents, view);
    }

    if (action === 'skill') {
      await skillLoop(result.skills, view);
    }
  }
}

async function agentLoop(agents, view) {
  while (true) {
    console.log('');
    const choices = [
      ...agents.map(a => ({ value: a, name: `${c.bold(a.id.padEnd(16))} ${c.muted(a.headline.substring(0, 42))}` })),
      { value: null, name: '← Back' }
    ];
    const selected = await select({ message: 'Which agent?', choices });
    if (!selected) break;

    renderMarkdown(selected.content, view);

    const next = await select({
      message: 'Next?',
      choices: [
        { value: 'another', name: '🔄  View another agent' },
        { value: 'format',  name: `🎨  Change format (current: ${c.label(view)})` },
        { value: 'back',    name: '← Back to menu' }
      ]
    });

    if (next === 'another') continue;
    if (next === 'format') { await changeFormatPreference(); view = await getMarkdownView(); continue; }
    if (next === 'back') break;
  }
}

async function skillLoop(skills, view) {
  while (true) {
    console.log('');
    const choices = [
      ...skills.map(s => ({
        value: s,
        name: `${s.hasSkillMd ? c.success('✓') : c.warn('⚠')} ${c.bold(s.id.padEnd(32))} ${c.muted(s.description || '')}`
      })),
      { value: null, name: '← Back' }
    ];
    const selected = await select({ message: 'Which skill?', choices });
    if (!selected) break;

    if (!selected.hasSkillMd) { warn('SKILL.md missing for this skill'); continue; }

    renderMarkdown(selected.content, view);

    const next = await select({
      message: 'Next?',
      choices: [
        { value: 'another', name: '🔄  View another skill' },
        { value: 'format',  name: `🎨  Change format (current: ${c.label(view)})` },
        { value: 'back',    name: '← Back to menu' }
      ]
    });

    if (next === 'another') continue;
    if (next === 'format') { await changeFormatPreference(); view = await getMarkdownView(); continue; }
    if (next === 'back') break;
  }
}

// ─── DISCOVER REMOTE ─────────────────────────────────────────────────────────

async function discoverRemote(repo, opts) {
  const spinner = ora(`Exploring ${c.bold(repo)}...`).start();

  try {
    const config = await getConfig();
    const token = config.github?.token;

    const repoInfo = await ghFetch(`/repos/${repo}`, token);
    const topics = repoInfo.topics || [];
    const { registry } = await getRegistryJson(repo);
    const hasAgentsDir = await checkPathExists(repo, 'agents', token);
    const hasSkillsDir = await checkPathExists(repo, 'skills', token);
    const { content: pluginJson } = await getFileContent(repo, '.claude-plugin/plugin.json').catch(() => ({ content: null }));

    spinner.stop();

    if (!opts.json) {
      printRemoteHeader(repo, repoInfo, topics, registry, hasAgentsDir, hasSkillsDir, pluginJson);

      if (registry) {
        await remoteNavigationLoop(repo, registry, token);
      } else {
        warn('No esk structure detected in this repo.');
      }
    }

    outputResult(() => {}, {
      type: 'remote', repo, topics,
      description: repoInfo.description,
      stars: repoInfo.stargazers_count,
      private: repoInfo.private,
      compatible: !!registry,
      agents: registry?.agents || [],
      skills: registry?.skills || []
    });

  } catch (err_) {
    spinner.fail('Error');
    error(err_.message);
  }
}

function printRemoteHeader(repo, repoInfo, topics, registry, hasAgentsDir, hasSkillsDir, pluginJson) {
  console.log('');
  console.log(`  ${c.brand('◈')} ${c.bold('Discovery')} — ${c.label('github')}  ${c.bold(repo)}`);
  console.log(c.muted('  ' + '─'.repeat(58)));
  console.log('');

  console.log(`  ${c.muted('Repo      :')} github.com/${repo}`);
  console.log(`  ${c.muted('Visibility:')} ${repoInfo.private ? '🔒 private' : '🌐 public'}${repoInfo.stargazers_count ? '  ' + c.muted('★ ' + repoInfo.stargazers_count) : ''}`);
  if (repoInfo.description) console.log(`  ${c.muted('Info      :')} ${repoInfo.description}`);
  if (topics.length > 0) console.log(`  ${c.muted('Topics    :')} ${topics.map(t => c.label(t)).join(', ')}`);

  console.log('');
  console.log(`  ${c.muted('registry  :')} ${registry ? c.success('✓ registry.json' + (registry.version ? ' v' + registry.version : '')) : c.warn('— no registry.json')}`);
  if (pluginJson) console.log(`  ${c.muted('plugin    :')} ${c.success('✓ .claude-plugin/plugin.json')} ${c.muted('(official Anthropic format)')}`);
  if (topics.includes('esk-registry')) console.log(`  ${c.muted('esk tag   :')} ${c.success('✓ esk-registry')}`);

  if (registry?.agents?.length > 0) {
    sectionHeader('🤖', `Agents (${registry.agents.length})`);
    for (const agent of registry.agents) {
      const sc = (agent.defaultSkills || []).length;
      console.log(
        `  ${c.bold((agent.name || agent.id).padEnd(14))}` +
        `${c.muted((agent.role || '').padEnd(40))}` +
        `${c.label(agent.model || '')}  ${c.muted(sc + ' skills')}`
      );
    }
  } else if (hasAgentsDir) {
    sectionHeader('🤖', 'Agents'); console.log(c.muted('  agents/ directory present'));
  }

  if (registry?.skills?.length > 0) {
    sectionHeader('🛠️', `Skills (${registry.skills.length})`);
    const byCategory = {};
    for (const s of registry.skills) {
      const cat = s.category || 'other';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(s.id);
    }
    for (const [cat, ids] of Object.entries(byCategory)) {
      console.log(`  ${c.label(cat.padEnd(22))} ${c.muted(ids.join(', '))}`);
    }
  } else if (hasSkillsDir) {
    sectionHeader('🛠️', 'Skills'); console.log(c.muted('  skills/ directory present'));
  }
}

async function remoteNavigationLoop(repo, registry, token) {
  let view = await getMarkdownView();

  while (true) {
    console.log('');
    const choices = [];
    if (registry.skills?.length > 0) {
      choices.push({ value: 'skill',   name: '🔍  Read a skill' });
      choices.push({ value: 'import',  name: '⬇️  Import skills' });
    }
    choices.push({ value: 'source',  name: '🔗  Add as trusted source' });
    choices.push({ value: 'format',  name: `🎨  Display format (current: ${c.label(view)})` });
    choices.push({ value: 'quit',    name: '✕  Quit' });

    const action = await select({ message: 'What would you like to do?', choices });
    if (action === 'quit') break;

    if (action === 'format') {
      await changeFormatPreference();
      view = await getMarkdownView();
      continue;
    }
    if (action === 'source') { await addAsSource(repo); continue; }
    if (action === 'import') { await interactiveImportSkills(repo, registry, token); continue; }

    if (action === 'skill') {
      await remoteSkillLoop(repo, registry, token, view);
      view = await getMarkdownView(); // may have changed in the loop
    }
  }
}

async function remoteSkillLoop(repo, registry, token, view) {
  while (true) {
    console.log('');
    const choices = [
      ...registry.skills.map(s => ({
        value: s,
        name: `${c.bold(s.id.padEnd(32))} ${c.muted(s.description || '')}`
      })),
      { value: null, name: '← Back' }
    ];
    const selected = await select({ message: 'Which skill?', choices });
    if (!selected) break;

    const spinner = ora('Loading SKILL.md...').start();
    const { content } = await getFileContent(repo, `skills/${selected.category || 'other'}/${selected.id}/SKILL.md`);
    spinner.stop();

    if (!content) { warn('SKILL.md not found in the repo'); continue; }

    renderMarkdown(content, view);

    const next = await select({
      message: 'Next?',
      choices: [
        { value: 'another', name: '🔄  View another skill' },
        { value: 'import',  name: '⬇️  Import this skill' },
        { value: 'format',  name: `🎨  Change format (current: ${c.label(view)})` },
        { value: 'back',    name: '← Back' }
      ]
    });

    if (next === 'another') continue;
    if (next === 'import') {
      await interactiveImportSkills(repo, { skills: [selected] }, token);
      continue;
    }
    if (next === 'format') {
      await changeFormatPreference();
      view = await getMarkdownView();
      continue;
    }
    if (next === 'back') break;
  }
}

// ─── DISCOVER ALL ─────────────────────────────────────────────────────────────

async function discoverAll(opts) {
  const spinner = ora('Searching for public esk registries...').start();
  const config = await getConfig();
  const token = config.github?.token;

  try {
    const data = await ghFetch('/search/repositories?q=topic:esk-registry&sort=stars&per_page=20', token);
    spinner.stop();
    const repos = data.items || [];

    if (!opts.json) {
      console.log('');
      console.log(`  ${c.brand('◈')} ${c.bold('Discovery')} — ${c.label('Public esk registries')}`);
      console.log(c.muted('  ' + '─'.repeat(58)));
      console.log(`  ${c.muted(repos.length + ' registries found')}`);
      console.log('');
      for (const r of repos) {
        console.log(`  ${c.bold(r.full_name.padEnd(44))} ${r.stargazers_count ? c.muted('★ ' + r.stargazers_count) : ''}`);
        if (r.description) console.log(`    ${c.muted(r.description)}`);
      }

      while (true) {
        console.log('');
        const selected = await select({
          message: 'Explore which one in detail?',
          choices: [
            ...repos.map(r => ({ value: r.full_name, name: `${r.full_name}  ★ ${r.stargazers_count || 0}` })),
            { value: null, name: '✕  Quit' }
          ]
        });
        if (!selected) break;
        await discoverRemote(selected, opts);
      }
    }

    outputResult(() => {}, {
      registries: repos.map(r => ({ repo: r.full_name, stars: r.stargazers_count, description: r.description }))
    });

  } catch (err_) {
    spinner.fail('Error'); error(err_.message);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function changeFormatPreference() {
  const current = await getMarkdownView();
  const newFormat = await select({
    message: 'Markdown display format:',
    choices: [
      { value: 'rendered', name: `🎨  Colored terminal render${current === 'rendered' ? c.label(' (current)') : ''}` },
      { value: 'raw',      name: `📄  Raw Markdown${current === 'raw' ? c.label(' (current)') : ''}` },
      { value: 'both',     name: `📄🎨  Both${current === 'both' ? c.label(' (current)') : ''}` }
    ]
  });
  const config = await getConfig();
  if (!config.preferences) config.preferences = {};
  config.preferences.markdownView = newFormat;
  await saveConfig(config);
  success(`Format → ${c.label(newFormat)} (saved to ~/.esk/config.json)`);
}

async function interactiveImportSkills(repo, registry, token) {
  const claudeDir = findClaudeDir();
  const selected = await checkbox({
    message: 'Skills to import:',
    choices: (registry.skills || []).map(s => ({
      name: `${s.id.padEnd(32)} ${c.muted(s.description || '')}`,
      value: s, checked: false
    }))
  });
  if (selected.length === 0) { info('No skills selected'); return; }

  const installLocal = claudeDir
    ? await confirm({ message: 'Install in the current project .claude/?' })
    : false;

  const spinner = ora('Importing...').start();
  const done = [], failed = [];
  for (const skill of selected) {
    try {
      const { content } = await getFileContent(repo, `skills/${skill.category || 'other'}/${skill.id}/SKILL.md`);
      if (content && installLocal) { await installSkillLocally(claudeDir, skill.id, content); done.push(skill.id); }
      else if (content) { done.push(skill.id); }
      else { failed.push(skill.id); }
    } catch { failed.push(skill.id); }
  }
  spinner.stop();
  if (done.length) success(`${done.length} skill(s) imported: ${done.join(', ')}`);
  if (failed.length) warn(`${failed.length} not found: ${failed.join(', ')}`);
}

async function addAsSource(repo) {
  const config = await getConfig();
  if (!config.sources) config.sources = [];
  const id = repo.replace('/', '-').toLowerCase();
  if (config.sources.find(s => s.repo === repo)) { warn(`Source "${repo}" already configured`); return; }
  config.sources.push({
    id, type: 'github-repo', label: repo, repo,
    private: false, priority: config.sources.length + 1, enabled: true
  });
  await saveConfig(config);
  success(`Source ${c.bold(repo)} added`);
}

async function ghFetch(path, token) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
  const res = await fetch(`${GH_API}${path}`, { headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`GitHub ${res.status}: ${err.message || path}`);
  }
  return res.json();
}

async function checkPathExists(repo, path, token) {
  try { await ghFetch(`/repos/${repo}/contents/${path}`, token); return true; }
  catch { return false; }
}
