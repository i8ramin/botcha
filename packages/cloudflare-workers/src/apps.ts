/**
 * BOTCHA App Management & Multi-Tenant Infrastructure
 * 
 * Secure app creation with:
 * - Crypto-random app IDs and secrets
 * - SHA-256 secret hashing (never store plaintext)
 * - KV storage for app configs
 * - Rate limit tracking per app
 */

// KV binding type (matches Cloudflare Workers KV API)
export type KVNamespace = {
  get: (key: string, type?: 'text' | 'json' | 'arrayBuffer' | 'stream') => Promise<any>;
  put: (key: string, value: string, options?: { expirationTtl?: number }) => Promise<void>;
  delete: (key: string) => Promise<void>;
};

// ============ TYPES ============

/**
 * App configuration stored in KV
 */
export interface AppConfig {
  app_id: string;
  secret_hash: string; // SHA-256 hash of app_secret
  created_at: number; // Unix timestamp (ms)
  rate_limit: number; // requests per hour
}

/**
 * Result of app creation (includes plaintext secret - only shown once!)
 */
export interface CreateAppResult {
  app_id: string;
  app_secret: string; // Only returned at creation time
}

// ============ CRYPTO UTILITIES ============

/**
 * Generate a crypto-random app ID
 * Format: 'app_' + 16 hex chars
 * 
 * Example: app_a1b2c3d4e5f6a7b8
 */
export function generateAppId(): string {
  const bytes = new Uint8Array(8); // 8 bytes = 16 hex chars
  crypto.getRandomValues(bytes);
  const hexString = Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return `app_${hexString}`;
}

/**
 * Generate a crypto-random app secret
 * Format: 'sk_' + 32 hex chars
 * 
 * Example: sk_a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6
 */
export function generateAppSecret(): string {
  const bytes = new Uint8Array(16); // 16 bytes = 32 hex chars
  crypto.getRandomValues(bytes);
  const hexString = Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return `sk_${hexString}`;
}

/**
 * Hash a secret using SHA-256
 * Returns hex-encoded hash string
 * 
 * @param secret - The plaintext secret to hash
 * @returns SHA-256 hash as hex string
 */
export async function hashSecret(secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(secret);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

// ============ APP MANAGEMENT ============

/**
 * Create a new app with crypto-random credentials
 * 
 * Generates:
 * - app_id: 'app_' + 16 hex chars
 * - app_secret: 'sk_' + 32 hex chars
 * 
 * Stores in KV at key `app:{app_id}` with:
 * - app_id
 * - secret_hash (SHA-256, never plaintext)
 * - created_at (timestamp)
 * - rate_limit (default: 100 req/hour)
 * 
 * @param kv - KV namespace for storage
 * @returns {app_id, app_secret} - SECRET ONLY RETURNED ONCE!
 */
export async function createApp(kv: KVNamespace): Promise<CreateAppResult> {
  const app_id = generateAppId();
  const app_secret = generateAppSecret();
  const secret_hash = await hashSecret(app_secret);

  const config: AppConfig = {
    app_id,
    secret_hash,
    created_at: Date.now(),
    rate_limit: 100, // Default: 100 requests/hour
  };

  // Store in KV with key format: app:{app_id}
  // No TTL - apps persist indefinitely unless explicitly deleted
  await kv.put(`app:${app_id}`, JSON.stringify(config));

  return {
    app_id,
    app_secret, // ONLY returned at creation time!
  };
}

/**
 * Get app configuration by app_id
 * 
 * Returns app config WITHOUT secret_hash for security
 * 
 * @param kv - KV namespace
 * @param app_id - The app ID to retrieve
 * @returns App config (without secret_hash) or null if not found
 */
export async function getApp(
  kv: KVNamespace,
  app_id: string
): Promise<Omit<AppConfig, 'secret_hash'> | null> {
  try {
    const data = await kv.get(`app:${app_id}`, 'text');
    
    if (!data) {
      return null;
    }

    const config: AppConfig = JSON.parse(data);

    // Return config WITHOUT secret_hash (security)
    return {
      app_id: config.app_id,
      created_at: config.created_at,
      rate_limit: config.rate_limit,
    };
  } catch (error) {
    console.error(`Failed to get app ${app_id}:`, error);
    return null;
  }
}

/**
 * Validate an app secret against stored hash
 * 
 * Uses constant-time comparison to prevent timing attacks
 * 
 * @param kv - KV namespace
 * @param app_id - The app ID
 * @param app_secret - The plaintext secret to validate
 * @returns true if valid, false otherwise
 */
export async function validateAppSecret(
  kv: KVNamespace,
  app_id: string,
  app_secret: string
): Promise<boolean> {
  try {
    const data = await kv.get(`app:${app_id}`, 'text');
    
    if (!data) {
      return false;
    }

    const config: AppConfig = JSON.parse(data);
    const providedHash = await hashSecret(app_secret);

    // Constant-time comparison to prevent timing attacks
    // Compare each character to avoid early exit
    if (providedHash.length !== config.secret_hash.length) {
      return false;
    }

    let isValid = true;
    for (let i = 0; i < providedHash.length; i++) {
      if (providedHash[i] !== config.secret_hash[i]) {
        isValid = false;
      }
    }

    return isValid;
  } catch (error) {
    console.error(`Failed to validate app secret for ${app_id}:`, error);
    return false;
  }
}
