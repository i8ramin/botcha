import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

interface BotchaOptions {
  // Require cryptographic signature (Web Bot Auth)
  requireSignature?: boolean;
  // Allow challenge-response as fallback
  allowChallenge?: boolean;
  // Known agent providers to trust
  trustedProviders?: string[];
  // Custom verification function
  customVerify?: (req: Request) => Promise<boolean>;
}

const defaultOptions: BotchaOptions = {
  requireSignature: false, // Start permissive for POC
  allowChallenge: true,
  trustedProviders: [
    'anthropic.com',
    'openai.com',
    'openclaw.ai',
    'bedrock.aws.amazon.com',
  ],
};

export function botchaVerify(options: BotchaOptions = {}) {
  const opts = { ...defaultOptions, ...options };

  return async (req: Request, res: Response, next: NextFunction) => {
    const result = await verifyAgent(req, opts);

    if (result.verified) {
      (req as any).agent = result.agent;
      (req as any).verificationMethod = result.method;
      return next();
    }

    // Not verified - return appropriate response
    res.status(403).json({
      success: false,
      error: 'BOTCHA_VERIFICATION_FAILED',
      message: '🚫 Access denied. This endpoint is for AI agents only.',
      hint: result.hint,
      challenge: opts.allowChallenge ? generateQuickChallenge() : undefined,
    });
  };
}

interface VerificationResult {
  verified: boolean;
  method?: 'signature' | 'challenge' | 'header' | 'custom';
  agent?: string;
  hint?: string;
}

async function verifyAgent(req: Request, opts: BotchaOptions): Promise<VerificationResult> {
  // Method 1: Check for Web Bot Auth signature
  const signatureAgent = req.headers['signature-agent'] as string;
  if (signatureAgent) {
    const sigVerified = await verifySignature(req, signatureAgent);
    if (sigVerified) {
      return { verified: true, method: 'signature', agent: signatureAgent };
    }
  }

  // Method 2: Check for known agent User-Agent patterns
  const userAgent = req.headers['user-agent'] || '';
  const agentPatterns = [
    /OpenClaw/i,
    /Claude/i,
    /GPT/i,
    /Anthropic/i,
    /LangChain/i,
    /AutoGPT/i,
    /AgentCore/i,
  ];
  
  for (const pattern of agentPatterns) {
    if (pattern.test(userAgent)) {
      // User-Agent alone isn't proof, but we'll accept for POC
      return { 
        verified: true, 
        method: 'header', 
        agent: userAgent.match(pattern)?.[0] || 'unknown'
      };
    }
  }

  // Method 3: Check for X-Agent-Identity header (custom)
  const agentIdentity = req.headers['x-agent-identity'] as string;
  if (agentIdentity) {
    return { verified: true, method: 'header', agent: agentIdentity };
  }

  // Method 4: Check for challenge solution in header
  const challengeSolution = req.headers['x-botcha-solution'] as string;
  if (challengeSolution && opts.allowChallenge) {
    const valid = verifyChallengeQuick(challengeSolution);
    if (valid) {
      return { verified: true, method: 'challenge', agent: 'challenge-verified' };
    }
  }

  // No verification succeeded
  return {
    verified: false,
    hint: 'Include a Signature-Agent header, X-Agent-Identity header, or solve a challenge',
  };
}

async function verifySignature(req: Request, signatureAgent: string): Promise<boolean> {
  // TODO: Implement full Web Bot Auth signature verification
  // For POC, we just check if the header exists and looks valid
  try {
    const url = new URL(signatureAgent);
    // In production: fetch the .well-known/http-message-signatures-directory
    // and verify the signature against the public key
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

function generateQuickChallenge(): object {
  // Quick computational challenge
  const a = Math.floor(Math.random() * 10000);
  const b = Math.floor(Math.random() * 10000);
  const operation = 'multiply';
  
  return {
    type: 'compute',
    puzzle: { a, b, operation },
    instruction: `Compute ${a} × ${b}, then SHA256 hash the result, return first 8 chars`,
    submitHeader: 'X-Botcha-Solution',
    example: 'X-Botcha-Solution: a1b2c3d4',
  };
}

function verifyChallengeQuick(solution: string): boolean {
  // Simplified: just check format for POC
  // In production: verify against issued challenge
  return /^[a-f0-9]{8}$/i.test(solution);
}

export default botchaVerify;
