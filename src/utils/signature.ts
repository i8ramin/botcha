import crypto from 'crypto';

interface AgentDirectory {
  keys: {
    id: string;
    publicKey: string;
    algorithm: string;
  }[];
  agent: string;
  provider: string;
}

// Cache for fetched public keys
const keyCache = new Map<string, { keys: AgentDirectory; fetchedAt: number }>();
const CACHE_TTL = 3600000; // 1 hour

/**
 * Verify a Web Bot Auth signature
 * 
 * Expected headers:
 * - Signature-Agent: https://provider.com/.well-known/http-message-signatures-directory
 * - Signature: <signature-params>
 * - Signature-Input: <signature-input>
 */
export async function verifyWebBotAuth(
  headers: Record<string, string | string[] | undefined>,
  method: string,
  path: string,
  body?: string
): Promise<{ valid: boolean; agent?: string; provider?: string; error?: string }> {
  
  const signatureAgent = headers['signature-agent'] as string;
  const signature = headers['signature'] as string;
  const signatureInput = headers['signature-input'] as string;
  
  if (!signatureAgent) {
    return { valid: false, error: 'Missing Signature-Agent header' };
  }
  
  if (!signature || !signatureInput) {
    return { valid: false, error: 'Missing Signature or Signature-Input header' };
  }
  
  try {
    // Fetch the agent's public key directory
    const directory = await fetchAgentDirectory(signatureAgent);
    if (!directory) {
      return { valid: false, error: 'Could not fetch agent directory' };
    }
    
    // Parse signature input to get key ID and covered components
    const parsed = parseSignatureInput(signatureInput);
    if (!parsed) {
      return { valid: false, error: 'Invalid Signature-Input format' };
    }
    
    // Find the matching key
    const key = directory.keys.find(k => k.id === parsed.keyId);
    if (!key) {
      return { valid: false, error: `Key ${parsed.keyId} not found in directory` };
    }
    
    // Reconstruct the signature base
    const signatureBase = buildSignatureBase(
      headers,
      method,
      path,
      parsed.coveredComponents,
      signatureInput
    );
    
    // Verify the signature
    const isValid = verifySignature(signatureBase, signature, key.publicKey, key.algorithm);
    
    if (isValid) {
      return { 
        valid: true, 
        agent: directory.agent,
        provider: directory.provider,
      };
    } else {
      return { valid: false, error: 'Signature verification failed' };
    }
    
  } catch (err) {
    return { valid: false, error: `Verification error: ${err}` };
  }
}

async function fetchAgentDirectory(url: string): Promise<AgentDirectory | null> {
  // Check cache first
  const cached = keyCache.get(url);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached.keys;
  }
  
  try {
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });
    
    if (!response.ok) {
      console.error(`Failed to fetch agent directory: ${response.status}`);
      return null;
    }
    
    const directory = await response.json() as AgentDirectory;
    keyCache.set(url, { keys: directory, fetchedAt: Date.now() });
    
    return directory;
  } catch (err) {
    console.error(`Error fetching agent directory:`, err);
    return null;
  }
}

function parseSignatureInput(input: string): { keyId: string; coveredComponents: string[] } | null {
  // Simplified parser for: sig1=("@method" "@path" "content-type");keyid="key-1";alg="ecdsa-p256-sha256"
  try {
    const match = input.match(/sig\d+=\(([^)]+)\).*keyid="([^"]+)"/);
    if (!match) return null;
    
    const components = match[1].split(' ').map(c => c.replace(/"/g, ''));
    const keyId = match[2];
    
    return { keyId, coveredComponents: components };
  } catch {
    return null;
  }
}

function buildSignatureBase(
  headers: Record<string, string | string[] | undefined>,
  method: string,
  path: string,
  components: string[],
  signatureInput: string
): string {
  const lines: string[] = [];
  
  for (const component of components) {
    if (component === '@method') {
      lines.push(`"@method": ${method.toUpperCase()}`);
    } else if (component === '@path') {
      lines.push(`"@path": ${path}`);
    } else if (component === '@authority') {
      lines.push(`"@authority": ${headers['host'] || ''}`);
    } else {
      // Regular header
      const value = headers[component.toLowerCase()];
      if (value) {
        lines.push(`"${component.toLowerCase()}": ${value}`);
      }
    }
  }
  
  lines.push(`"@signature-params": ${signatureInput}`);
  
  return lines.join('\n');
}

function verifySignature(
  signatureBase: string,
  signature: string,
  publicKey: string,
  algorithm: string
): boolean {
  try {
    // Decode base64 signature
    const sigBuffer = Buffer.from(signature.replace(/^sig\d+=:/, '').replace(/:$/, ''), 'base64');
    
    // Create verifier based on algorithm
    let verifyAlg: string;
    if (algorithm.includes('ecdsa')) {
      verifyAlg = 'sha256';
    } else if (algorithm.includes('rsa')) {
      verifyAlg = 'RSA-SHA256';
    } else {
      verifyAlg = 'sha256';
    }
    
    const verify = crypto.createVerify(verifyAlg);
    verify.update(signatureBase);
    
    return verify.verify(publicKey, sigBuffer);
  } catch (err) {
    console.error('Signature verification error:', err);
    return false;
  }
}

// Known trusted providers (allowlist)
export const TRUSTED_PROVIDERS = [
  'anthropic.com',
  'openai.com',
  'api.anthropic.com',
  'api.openai.com',
  'bedrock.amazonaws.com',
  'openclaw.ai',
];

export function isTrustedProvider(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return TRUSTED_PROVIDERS.some(p => hostname.endsWith(p));
  } catch {
    return false;
  }
}

export default { verifyWebBotAuth, isTrustedProvider, TRUSTED_PROVIDERS };
