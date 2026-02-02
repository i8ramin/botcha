import crypto from 'crypto';

export interface BotchaClientOptions {
  /** Base URL of BOTCHA service (default: https://botcha.ai) */
  baseUrl?: string;
  /** Custom identity header value */
  agentIdentity?: string;
  /** Max retries for challenge solving */
  maxRetries?: number;
  /** Request timeout in ms */
  timeout?: number;
}

export interface ChallengeResponse {
  success: boolean;
  challenge?: {
    id: string;
    problems: { num: number; operation: string }[];
    timeLimit: string;
    instructions: string;
  };
}

export interface VerifyResponse {
  success: boolean;
  message: string;
  solveTimeMs?: number;
  verdict?: string;
}

/**
 * BOTCHA Client SDK for AI Agents
 * 
 * Automatically handles BOTCHA challenges when accessing protected endpoints.
 * 
 * @example
 * ```typescript
 * import { BotchaClient } from '@dupecom/botcha/client';
 * 
 * const client = new BotchaClient();
 * 
 * // Automatically solves challenges and retries
 * const response = await client.fetch('https://api.example.com/agent-only');
 * ```
 */
export class BotchaClient {
  private baseUrl: string;
  private agentIdentity: string;
  private maxRetries: number;
  private timeout: number;

  constructor(options: BotchaClientOptions = {}) {
    this.baseUrl = options.baseUrl || 'https://botcha.ai';
    this.agentIdentity = options.agentIdentity || `BotchaClient/${process.env.npm_package_version || '1.0.0'}`;
    this.maxRetries = options.maxRetries || 3;
    this.timeout = options.timeout || 10000;
  }

  /**
   * Solve a BOTCHA speed challenge
   */
  solve(problems: { num: number; operation: string }[]): string[] {
    return problems.map(p => {
      if (p.operation === 'sha256_first8') {
        return crypto.createHash('sha256').update(p.num.toString()).digest('hex').substring(0, 8);
      }
      throw new Error(`Unknown operation: ${p.operation}`);
    });
  }

  /**
   * Get and solve a challenge from BOTCHA service
   */
  async solveChallenge(): Promise<{ id: string; answers: string[] }> {
    const res = await fetch(`${this.baseUrl}/api/speed-challenge`, {
      headers: { 'User-Agent': this.agentIdentity },
    });
    
    const data = await res.json() as ChallengeResponse;
    
    if (!data.success || !data.challenge) {
      throw new Error('Failed to get challenge');
    }

    const answers = this.solve(data.challenge.problems);
    return { id: data.challenge.id, answers };
  }

  /**
   * Verify a solved challenge
   */
  async verify(id: string, answers: string[]): Promise<VerifyResponse> {
    const res = await fetch(`${this.baseUrl}/api/speed-challenge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': this.agentIdentity,
      },
      body: JSON.stringify({ id, answers }),
    });

    return await res.json() as VerifyResponse;
  }

  /**
   * Fetch a URL, automatically solving BOTCHA challenges if encountered
   * 
   * @example
   * ```typescript
   * const response = await client.fetch('https://api.example.com/agent-only');
   * const data = await response.json();
   * ```
   */
  async fetch(url: string, init?: RequestInit): Promise<Response> {
    const headers = new Headers(init?.headers);
    headers.set('User-Agent', this.agentIdentity);

    let response = await fetch(url, { ...init, headers });
    let retries = 0;

    while (response.status === 403 && retries < this.maxRetries) {
      const body = await response.json().catch(() => null);
      
      // Check if this is a BOTCHA challenge
      if (body?.error === 'BOTCHA_CHALLENGE' || body?.challenge?.problems) {
        const challenge = body.challenge;
        
        if (challenge?.problems) {
          // Solve the challenge
          const answers = this.solve(challenge.problems);
          
          // Retry with solution headers
          headers.set('X-Botcha-Id', challenge.id);
          headers.set('X-Botcha-Answers', JSON.stringify(answers));
          
          response = await fetch(url, { ...init, headers });
          retries++;
        } else {
          break;
        }
      } else {
        break;
      }
    }

    return response;
  }

  /**
   * Create headers with pre-solved challenge for manual use
   * 
   * @example
   * ```typescript
   * const headers = await client.createHeaders();
   * const response = await fetch('https://api.example.com/agent-only', { headers });
   * ```
   */
  async createHeaders(): Promise<Record<string, string>> {
    const { id, answers } = await this.solveChallenge();
    
    return {
      'X-Botcha-Id': id,
      'X-Botcha-Answers': JSON.stringify(answers),
      'User-Agent': this.agentIdentity,
    };
  }
}

// Convenience function for one-off solves
export function solveBotcha(problems: { num: number }[]): string[] {
  return problems.map(p => 
    crypto.createHash('sha256').update(p.num.toString()).digest('hex').substring(0, 8)
  );
}

export default BotchaClient;
