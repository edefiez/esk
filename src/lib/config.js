import { homedir } from 'os';
import { join } from 'path';
import fs from 'fs-extra';

const CONFIG_DIR = join(homedir(), '.esk');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

const DEFAULT_CONFIG = {
  github: {
    token: null,
    username: null,
    registry: null   // e.g. "edefiez/esk-registry"
  },
  preferences: {
    // Markdown display format in discover
    // "raw" | "rendered" | "both"
    markdownView: 'rendered'
  },
  sources: [
    {
      id: 'private',
      type: 'github-repo',
      label: 'My private registry',
      repo: null,
      private: true,
      priority: 1,
      enabled: true
    },
    {
      id: 'esk-ecosystem',
      type: 'github-topic',
      label: 'esk Ecosystem',
      topic: 'esk-registry',
      priority: 2,
      enabled: true
    },
    {
      id: 'anthropic-official',
      type: 'github-repo',
      label: 'Anthropic Official Plugins',
      repo: 'anthropics/claude-plugins-official',
      trusted: true,
      priority: 3,
      enabled: true
    },
    {
      id: 'claude-community',
      type: 'github-topics',
      label: 'Claude Code Community',
      topics: ['claude-code', 'skills'],
      priority: 4,
      enabled: true
    },
    {
      id: 'broad',
      type: 'github-topics',
      label: 'Broad search (skills)',
      topics: ['skills'],
      priority: 5,
      enabled: false
    }
  ]
};

export async function getConfig() {
  await fs.ensureDir(CONFIG_DIR);
  if (!await fs.pathExists(CONFIG_FILE)) {
    await fs.writeJson(CONFIG_FILE, DEFAULT_CONFIG, { spaces: 2 });
  }
  return fs.readJson(CONFIG_FILE);
}

export async function saveConfig(config) {
  await fs.ensureDir(CONFIG_DIR);
  await fs.writeJson(CONFIG_FILE, config, { spaces: 2 });
}

export async function updateConfig(path, value) {
  const config = await getConfig();
  const parts = path.split('.');
  let obj = config;
  for (let i = 0; i < parts.length - 1; i++) {
    obj = obj[parts[i]];
  }
  obj[parts[parts.length - 1]] = value;
  await saveConfig(config);
  return config;
}

export async function isConfigured() {
  const config = await getConfig();
  return !!(config.github?.token);
}

export function getConfigDir() {
  return CONFIG_DIR;
}
