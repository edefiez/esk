import ora from 'ora';
import fs from 'fs-extra';
import { join } from 'path';
import { execSync } from 'child_process';
import { findClaudeDir } from '../lib/registry.js';
import {
  success, error, warn, info, c,
  sectionHeader, outputResult, setJsonMode
} from '../utils/display.js';

export function registerTestCommand(program) {
  program
    .command('skill:test <skillId>')
    .description('Test a skill by running Claude Code with only that skill loaded')
    .option('--prompt <prompt>', 'Custom test prompt')
    .option('--agent <agent>', 'Agent .md to use as base (default: minimal test agent)')
    .option('--print', 'Only print the test prompt without running')
    .option('--json', 'JSON output')
    .action(async (skillId, opts) => {
      if (opts.json) setJsonMode(true);

      const claudeDir = findClaudeDir();
      if (!claudeDir) { error('.claude/ not found'); return; }

      const skillPath = join(claudeDir, 'skills', skillId, 'SKILL.md');
      if (!await fs.pathExists(skillPath)) {
        error(`Skill "${skillId}" not found in .claude/skills/`);
        return;
      }

      const skillContent = await fs.readFile(skillPath, 'utf8');

      // Extract the skill title
      const titleMatch = skillContent.match(/^# (.+)/m);
      const skillTitle = titleMatch ? titleMatch[1] : skillId;

      // Build a test system prompt
      let basePrompt = '';
      if (opts.agent) {
        const agentPath = join(claudeDir, 'agents', `${opts.agent}.md`);
        if (await fs.pathExists(agentPath)) {
          basePrompt = await fs.readFile(agentPath, 'utf8');
        } else {
          warn(`Agent "${opts.agent}" not found, using minimal test agent`);
        }
      }

      if (!basePrompt) {
        basePrompt = `# Test Agent — Skill Tester\n\n**Model:** claude-sonnet-4-6\n\nYou are a test agent. Your only purpose is to demonstrate the skill loaded below.`;
      }

      const fullPrompt = `${basePrompt}\n\n---\n\n## Loaded skill: ${skillTitle}\n\n${skillContent}`;

      const testPrompt = opts.prompt ||
        `You have the skill "${skillTitle}" loaded. Demonstrate how you would use it by explaining your approach to a relevant task. Be specific and practical.`;

      if (opts.print) {
        outputResult(
          () => {
            sectionHeader('🧪', `Test: ${skillId}`);
            console.log('');
            console.log(c.muted('─── System Prompt ───'));
            console.log(fullPrompt);
            console.log(c.muted('─── User Prompt ───'));
            console.log(testPrompt);
            console.log(c.muted('─'.repeat(40)));
          },
          { systemPrompt: fullPrompt, userPrompt: testPrompt, skillId }
        );
        return;
      }

      // Check if claude is available
      try {
        execSync('which claude', { stdio: 'ignore' });
      } catch {
        error('Claude Code CLI not found in PATH.');
        info('Install it from: https://claude.ai/code');
        info('Or use --print to just see the test prompt.');
        return;
      }

      // Create a temporary agent file for the test
      const testDir = join(claudeDir, '.esk-test');
      await fs.ensureDir(testDir);
      const testAgentPath = join(testDir, `test-${skillId}.md`);
      await fs.writeFile(testAgentPath, fullPrompt, 'utf8');

      console.log('');
      sectionHeader('🧪', `Testing skill: ${skillId}`);
      console.log(`  ${c.muted('Skill  :')} ${skillTitle}`);
      console.log(`  ${c.muted('Prompt :')} ${testPrompt.substring(0, 60)}...`);
      console.log('');

      try {
        // Run claude with the test prompt, piping through
        const cmd = `claude --system-prompt "${testAgentPath.replace(/"/g, '\\"')}" -p "${testPrompt.replace(/"/g, '\\"')}"`;
        info(`Running: claude with skill "${skillId}" loaded`);
        console.log(c.muted('─'.repeat(60)));

        execSync(cmd, { stdio: 'inherit', cwd: process.cwd() });

        console.log(c.muted('─'.repeat(60)));
        success(`Test complete for "${skillId}"`);
      } catch (err_) {
        warn('Claude exited with an error (this may be normal for some test prompts)');
      } finally {
        // Cleanup
        await fs.remove(testDir).catch(() => {});
      }

      outputResult(() => {}, { success: true, skillId, tested: true });
    });
}
