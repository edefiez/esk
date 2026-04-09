import chalk from 'chalk';

// ─── Output mode ─────────────────────────────────────────────────────────────

let jsonMode = false;
export function setJsonMode(val) { jsonMode = val; }
export function isJsonMode() { return jsonMode; }

export function outputJson(data) {
  console.log(JSON.stringify(data, null, 2));
}

export function outputResult(humanFn, jsonData) {
  if (jsonMode) {
    outputJson(jsonData);
  } else {
    humanFn();
  }
}

// ─── Styles ──────────────────────────────────────────────────────────────────

export const c = {
  brand:   (s) => chalk.hex('#6B48FF')(s),
  success: (s) => chalk.green(s),
  error:   (s) => chalk.red(s),
  warn:    (s) => chalk.yellow(s),
  muted:   (s) => chalk.gray(s),
  bold:    (s) => chalk.bold(s),
  label:   (s) => chalk.cyan(s),
  tag:     (s) => chalk.bgHex('#6B48FF').white(` ${s} `)
};

// ─── Banners ─────────────────────────────────────────────────────────────────

export function banner() {
  console.log('');
  console.log(c.brand('  ███████╗███████╗██╗  ██╗'));
  console.log(c.brand('  ██╔════╝██╔════╝██║ ██╔╝'));
  console.log(c.brand('  █████╗  ███████╗█████╔╝ '));
  console.log(c.brand('  ██╔══╝  ╚════██║██╔═██╗ '));
  console.log(c.brand('  ███████╗███████║██║  ██╗'));
  console.log(c.brand('  ╚══════╝╚══════╝╚═╝  ╚═╝'));
  console.log('');
  console.log(c.muted('  The package manager for your Claude Code agents'));
  console.log('');
}

export function sectionHeader(icon, title) {
  console.log('');
  console.log(`${icon}  ${c.bold(title)}`);
  console.log(c.muted('─'.repeat(48)));
}

// ─── Lists ───────────────────────────────────────────────────────────────────

export function printSkillList(skills, grouped = true) {
  if (!grouped) {
    for (const s of skills) printSkillLine(s);
    return;
  }
  const byCategory = {};
  for (const s of skills) {
    const cat = s.category || 'other';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(s);
  }
  for (const [cat, items] of Object.entries(byCategory)) {
    console.log('');
    console.log(`  ${c.label(cat.toUpperCase())}`);
    for (const s of items) printSkillLine(s, '    ');
  }
}

function printSkillLine(skill, indent = '  ') {
  const stars = skill.stars ? c.muted(` ★ ${skill.stars}`) : '';
  const trusted = skill.trusted ? chalk.green(' [OFFICIAL]') : '';
  console.log(`${indent}${c.bold(skill.id.padEnd(35))} ${c.muted(skill.description || '')}${stars}${trusted}`);
}

export function printAgentList(agents) {
  for (const a of agents) {
    const skillCount = (a.defaultSkills || a.skills || []).length;
    console.log(
      `  ${c.bold(a.name.padEnd(12))}` +
      `${c.muted(a.role.padEnd(38))}` +
      `${c.label(a.model.padEnd(22))}` +
      `${c.muted(skillCount + ' skills')}`
    );
  }
}

export function printSearchResults(results) {
  if (results.length === 0) {
    console.log(c.muted('  No results found.'));
    return;
  }

  const bySource = {};
  for (const r of results) {
    const key = r.sourceLabel || r.sourceId;
    if (!bySource[key]) bySource[key] = [];
    bySource[key].push(r);
  }

  for (const [source, items] of Object.entries(bySource)) {
    console.log('');
    console.log(`  ${c.label('▸')} ${c.bold(source)}`);
    for (const item of items) {
      const stars = item.stars ? c.muted(` ★ ${item.stars}`) : '';
      const trusted = item.trusted ? chalk.green(' [OFFICIAL]') : '';
      console.log(`      ${c.bold(item.id.padEnd(32))} ${c.muted(item.description || '')}${stars}${trusted}`);
      console.log(`      ${c.muted('repo: ' + item.repo)}`);
    }
  }
}

// ─── Project status ──────────────────────────────────────────────────────────

export function printProjectStatus(status) {
  console.log('');
  console.log(`  ${c.bold('Directory')}: ${c.muted(status.claudeDir)}`);

  sectionHeader('🤖', 'Agents');
  if (status.agents.length === 0) {
    console.log(c.muted('  No agents configured'));
  }
  for (const agent of status.agents) {
    const fileStatus = agent.fileExists ? c.success('✓') : c.error('✗ file missing');
    console.log(`  ${fileStatus} ${c.bold(agent.id.padEnd(14))} ${c.muted(agent.skills?.join(', ') || 'no skills')}`);
  }

  sectionHeader('🛠️', 'Installed skills');
  if (status.skillsInstalled.length === 0) {
    console.log(c.muted('  No skills installed'));
  } else {
    for (const s of status.skillsInstalled) {
      console.log(`  ${c.success('✓')} ${s}`);
    }
  }
}

// ─── Messages ────────────────────────────────────────────────────────────────

export function success(msg) { console.log(`\n  ${c.success('✓')} ${msg}`); }
export function error(msg)   { console.error(`\n  ${c.error('✗')} ${msg}`); }
export function warn(msg)    { console.log(`\n  ${c.warn('⚠')} ${msg}`); }
export function info(msg)    { console.log(`\n  ${c.muted('ℹ')} ${msg}`); }
