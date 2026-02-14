/**
 * Init command — one-time setup for BOTCHA CLI
 * Creates an app, saves config to ~/.botcha/config.json
 */
import { Output } from '../lib/output.js';
import { loadConfig, saveConfig, configPath } from '../lib/config.js';

export interface InitOptions {
  email: string;
  url?: string;
  json?: boolean;
  verbose?: boolean;
  quiet?: boolean;
}

export async function initCommand(options: InitOptions): Promise<void> {
  const output = new Output(options);

  if (!options.email) {
    output.error('--email is required');
    process.exit(1);
  }

  const config = loadConfig();
  const url = options.url || config.url;

  output.header('\nBOTCHA Setup\n');

  // Check if already initialized
  if (config.app_id) {
    output.warn(`Already initialized (app_id: ${config.app_id})`);
    output.info('Run with --email to create a new app, or edit ~/.botcha/config.json');
  }

  // Step 1: Create app
  const spinner = output.spinner('Creating app...');

  try {
    const response = await fetch(`${url}/v1/apps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: options.email }),
    });

    const data: any = await response.json();

    if (!response.ok) {
      spinner.stop();
      output.error(`App creation failed: ${data.message || response.statusText}`);
      process.exit(1);
    }

    // Save config
    config.url = url;
    config.app_id = data.app_id;
    config.app_secret = data.app_secret;
    config.email = options.email;
    saveConfig(config);

    spinner.stop();

    if (options.json) {
      output.json({
        success: true,
        app_id: data.app_id,
        config_path: configPath(),
      });
      return;
    }

    output.success('App created!');
    output.section('App ID', data.app_id);
    output.section('Config saved to', configPath());
    console.log();
    output.warn('Save your app_secret — it cannot be retrieved again:');
    console.log(`  ${data.app_secret}`);
    console.log();
    output.info('Next steps:');
    console.log('  botcha tap register --name "my-agent" --capabilities browse,search');
    console.log('  botcha tap list');
    console.log('  botcha tap session --action browse --resource products');
    console.log();

  } catch (error) {
    spinner.stop();
    output.error(`Setup failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
