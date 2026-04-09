import { select, checkbox, confirm } from '@inquirer/prompts';
import ora from 'ora';
import fs from 'fs-extra';
import { join } from 'path';
import { getConfig } from '../lib/config.js';
import { getRegistryJson } from '../lib/github.js';
import {
  findClaudeDir, readProjectManifest, saveProjectManifest, generateAgentPrompt
} from '../lib/registry.js';
import {
  sectionHeader, success, error, warn, info, c,
  outputResult, setJsonMode
} from '../utils/display.js';

export function registerReconcileCommand(program) {
  program
    .command('project:reconcile')
    .description('Analyze and reconcile skill↔agent associations in the current project')
    .option('--dry-run', 'Show the plan without applying it')
    .option('--yes', 'Apply without interactive confirmation')
    .option('--json', 'JSON output')
    .action(async (opts) => {
      if (opts.json) setJsonMode(true);

      const claudeDir = findClaudeDir();
      if (!claudeDir) {
        error('.claude/ not found in the current project');
        process.exit(1);
      }

      const spinner = ora('Analyzing project...').start();

      try {
        // ── 1. Scan what is on disk ──────────────────────────────────────────
        const agentsDir = join(claudeDir, 'agents');
        const skillsDir = join(claudeDir, 'skills');

        const agentFiles = await fs.pathExists(agentsDir)
          ? (await fs.readdir(agentsDir)).filter(f => f.endsWith('.md'))
          : [];

        const skillDirs = await fs.pathExists(skillsDir)
          ? (await fs.readdir(skillsDir, { withFileTypes: true }))
              .filter(d => d.isDirectory())
              .map(d => d.name)
          : [];

        // ── 2. Read current manifest ─────────────────────────────────────────
        const manifest = await readProjectManifest(claudeDir);

        // ── 3. Load the GitHub registry ──────────────────────────────────────
        const config = await getConfig();
        let registry = null;
        if (config.github?.registry) {
          const result = await getRegistryJson(config.github.registry);
          registry = result.registry;
        }

        spinner.stop();

        // ── 4. Build the gap analysis ────────────────────────────────────────
        const plan = buildReconciliationPlan(
          agentFiles, skillDirs, manifest, registry
        );

        // ── 5. Display the report ────────────────────────────────────────────
        if (!opts.json) {
          printReconciliationReport(plan, claudeDir);
        }

        if (plan.changes.length === 0) {
          outputResult(
            () => { console.log(''); success('Everything is already reconciled — no action needed.'); },
            { status: 'ok', changes: [] }
          );
          return;
        }

        // ── 6. Dry-run mode: stop here ───────────────────────────────────────
        if (opts.dryRun) {
          outputResult(
            () => { console.log(''); info('Dry-run mode — no changes applied.'); },
            { status: 'dry-run', plan }
          );
          return;
        }

        // ── 7. Confirmation or interactive mode ──────────────────────────────
        let approvedChanges = plan.changes;

        if (!opts.yes) {
          approvedChanges = await interactiveApproval(plan);
          if (approvedChanges.length === 0) {
            info('No changes applied.');
            return;
          }
        }

        // ── 8. Apply changes ─────────────────────────────────────────────────
        const applySpinner = ora('Applying changes...').start();
        const results = await applyReconciliation(
          claudeDir, manifest, approvedChanges, registry
        );
        applySpinner.stop();

        outputResult(
          () => {
            console.log('');
            success(`${results.applied} association(s) applied`);
            for (const r of results.details) {
              console.log(`  ${c.success('✓')} ${c.bold(r.agent).padEnd(16)} ← ${c.label(r.skills.join(', '))}`);
            }
            console.log('');
            info('Run `esk project:status` to check the full state.');
          },
          { status: 'applied', ...results }
        );

      } catch (err_) {
        spinner.stop();
        error(err_.message);
        process.exit(1);
      }
    });
}

// ─── Build the reconciliation plan ───────────────────────────────────────────

function buildReconciliationPlan(agentFiles, skillDirs, manifest, registry) {
  const plan = {
    agentsOnDisk: agentFiles.map(f => f.replace('.md', '')),
    skillsOnDisk: skillDirs,
    agentsInManifest: manifest.agents || [],
    skillsInManifest: manifest.skills || [],
    changes: [],
    warnings: []
  };

  for (const agentId of plan.agentsOnDisk) {
    const inManifest = manifest.agents?.find(a => a.id === agentId);
    const currentSkills = inManifest?.skills || [];

    // Skills already on disk but not assigned to this agent in the manifest
    const unassignedSkills = plan.skillsOnDisk.filter(
      skillId => !currentSkills.includes(skillId)
    );

    // Suggestion based on the registry (official associations)
    const registryAgent = registry?.agents?.find(a => a.id === agentId);
    const registrySkills = registryAgent?.defaultSkills || [];

    // Skills on disk that the registry associates with this agent
    const suggestedFromRegistry = unassignedSkills.filter(
      skillId => registrySkills.includes(skillId)
    );

    // Skills on disk not assigned and not in the registry
    const suggestedFromDisk = unassignedSkills.filter(
      skillId => !registrySkills.includes(skillId)
    );

    if (suggestedFromRegistry.length > 0 || suggestedFromDisk.length > 0) {
      plan.changes.push({
        agentId,
        agentName: registryAgent?.name || agentId,
        agentRole: registryAgent?.role || '',
        currentSkills,
        suggestedFromRegistry,  // high confidence — the registry says so
        suggestedFromDisk,      // needs validation — present on disk but not in registry
        allSuggested: [...suggestedFromRegistry, ...suggestedFromDisk]
      });
    }
  }

  // Skills on disk not assigned to any agent
  const allAssignedSkills = new Set(
    (manifest.agents || []).flatMap(a => a.skills || [])
  );
  const orphanSkills = plan.skillsOnDisk.filter(s => !allAssignedSkills.has(s));
  if (orphanSkills.length > 0) {
    plan.warnings.push({
      type: 'orphan-skills',
      message: 'Installed skills not assigned to any agent',
      skills: orphanSkills
    });
  }

  // Agents in the manifest but not on disk
  const orphanAgents = (manifest.agents || []).filter(
    a => !plan.agentsOnDisk.includes(a.id)
  );
  if (orphanAgents.length > 0) {
    plan.warnings.push({
      type: 'orphan-agents',
      message: 'Agents in esk.json but without a .md file',
      agents: orphanAgents.map(a => a.id)
    });
  }

  return plan;
}

// ─── Report display ──────────────────────────────────────────────────────────

function printReconciliationReport(plan, claudeDir) {
  console.log('');
  console.log(`  ${c.brand('◈')} ${c.bold('Project Reconciliation')}`);
  console.log(c.muted('  ' + '─'.repeat(58)));
  console.log('');
  console.log(`  ${c.muted('Agents on disk     :')} ${plan.agentsOnDisk.join(', ') || c.muted('none')}`);
  console.log(`  ${c.muted('Skills on disk     :')} ${plan.skillsOnDisk.length} skill(s)`);
  console.log(`  ${c.muted('Agents in esk.json :')} ${plan.agentsInManifest.length}`);

  if (plan.warnings.length > 0) {
    console.log('');
    for (const w of plan.warnings) {
      if (w.type === 'orphan-skills') {
        warn(`Unassigned skills: ${c.label(w.skills.join(', '))}`);
      }
      if (w.type === 'orphan-agents') {
        warn(`Agents without .md file: ${c.label(w.agents.join(', '))}`);
      }
    }
  }

  if (plan.changes.length === 0) return;

  sectionHeader('🔗', `Suggested associations (${plan.changes.length} agent(s))`);

  for (const change of plan.changes) {
    console.log('');
    console.log(`  ${c.bold('🤖 ' + (change.agentName || change.agentId))} ${c.muted(change.agentRole ? '— ' + change.agentRole : '')}`);

    if (change.currentSkills.length > 0) {
      console.log(`     ${c.muted('Currently  :')} ${change.currentSkills.join(', ')}`);
    }

    if (change.suggestedFromRegistry.length > 0) {
      console.log(`     ${c.success('✓ Registry :')} ${change.suggestedFromRegistry.map(s => c.label(s)).join(', ')}`);
    }
    if (change.suggestedFromDisk.length > 0) {
      console.log(`     ${c.warn('? Disk     :')} ${change.suggestedFromDisk.map(s => c.label(s)).join(', ')}`);
    }
  }

  console.log('');
  console.log(c.muted('  ✓ Registry = official association · ? Disk = needs validation'));
}

// ─── Interactive approval ────────────────────────────────────────────────────

async function interactiveApproval(plan) {
  const approved = [];

  for (const change of plan.changes) {
    console.log('');
    console.log(`  ${c.bold('🤖 ' + (change.agentName || change.agentId))} ${c.muted('— ' + change.agentRole)}`);

    const choices = [
      ...change.suggestedFromRegistry.map(s => ({
        name: `${c.success('✓')} ${s.padEnd(32)} ${c.muted('[registry]')}`,
        value: s,
        checked: true  // pre-checked — high confidence
      })),
      ...change.suggestedFromDisk.map(s => ({
        name: `${c.warn('?')} ${s.padEnd(32)} ${c.muted('[disk only]')}`,
        value: s,
        checked: false  // not pre-checked — needs validation
      }))
    ];

    const selected = await checkbox({
      message: `Skills to assign to ${change.agentName || change.agentId}:`,
      choices
    });

    if (selected.length > 0) {
      approved.push({ ...change, approvedSkills: selected });
    }
  }

  return approved;
}

// ─── Apply reconciliation ────────────────────────────────────────────────────

async function applyReconciliation(claudeDir, manifest, changes, registry) {
  const results = { applied: 0, details: [] };

  if (!manifest.agents) manifest.agents = [];

  for (const change of changes) {
    const skillsToAdd = change.approvedSkills || change.allSuggested;
    if (skillsToAdd.length === 0) continue;

    // Update or create the entry in the manifest
    let agentEntry = manifest.agents.find(a => a.id === change.agentId);
    if (!agentEntry) {
      agentEntry = { id: change.agentId, skills: [] };
      manifest.agents.push(agentEntry);
    }
    if (!agentEntry.skills) agentEntry.skills = [];

    const newSkills = skillsToAdd.filter(s => !agentEntry.skills.includes(s));
    agentEntry.skills.push(...newSkills);

    // Regenerate the agent .md file
    const registryAgent = registry?.agents?.find(a => a.id === change.agentId);
    if (registryAgent) {
      const agentSkillDefs = agentEntry.skills.map(sid =>
        registry?.skills?.find(s => s.id === sid) || { id: sid }
      );
      const prompt = generateAgentPrompt(
        { ...registryAgent, defaultSkills: agentEntry.skills },
        agentSkillDefs
      );
      await fs.writeFile(join(claudeDir, 'agents', `${change.agentId}.md`), prompt, 'utf8');
    }

    results.applied += newSkills.length;
    results.details.push({ agent: change.agentId, skills: newSkills });
  }

  // Update the global skills list in the manifest
  const allSkills = new Set(manifest.agents.flatMap(a => a.skills || []));
  manifest.skills = [...allSkills];

  await saveProjectManifest(claudeDir, manifest);
  return results;
}
