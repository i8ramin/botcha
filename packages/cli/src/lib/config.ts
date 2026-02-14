/**
 * Persistent config for BOTCHA CLI
 * Stores settings in ~/.botcha/config.json
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

export interface BotchaConfig {
  url: string;
  app_id?: string;
  app_secret?: string;
  agent_id?: string;
  email?: string;
}

const CONFIG_DIR = join(homedir(), '.botcha');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

const DEFAULT_CONFIG: BotchaConfig = {
  url: 'https://botcha.ai',
};

export function loadConfig(): BotchaConfig {
  try {
    if (!existsSync(CONFIG_FILE)) {
      return { ...DEFAULT_CONFIG };
    }
    const raw = readFileSync(CONFIG_FILE, 'utf-8');
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveConfig(config: BotchaConfig): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

export function configPath(): string {
  return CONFIG_FILE;
}

/**
 * Resolve a value from: explicit flag > config > undefined
 * Used to make --url and --app-id optional when config exists.
 */
export function resolve(explicit: string | undefined, configValue: string | undefined): string | undefined {
  return explicit || configValue;
}
