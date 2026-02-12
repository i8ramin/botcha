/**
 * BOTCHA Token Verification
 * 
 * Core verification logic for BOTCHA JWT tokens.
 * Validates signature, expiry, type, audience, and client IP claims.
 */

import { jwtVerify } from 'jose';
import type { BotchaTokenPayload, BotchaVerifyOptions, VerificationResult } from './types.js';

export type { BotchaTokenPayload, BotchaVerifyOptions, VerificationResult, VerificationContext } from './types.js';

/**
 * Verify a BOTCHA JWT token
 * 
 * Checks:
 * - Token signature (HS256)
 * - Token expiry
 * - Token type (must be 'botcha-verified')
 * - Audience claim (if options.audience provided)
 * - Client IP binding (if options.requireIp and options.clientIp provided)
 * - Revocation status (if options.checkRevocation provided)
 * 
 * @param token - JWT token to verify
 * @param options - Verification options including secret and optional checks
 * @param clientIp - Optional client IP for validation
 * @returns Verification result with valid flag, payload, and error message
 */
export async function verifyBotchaToken(
  token: string,
  options: BotchaVerifyOptions,
  clientIp_?: string
): Promise<VerificationResult> {
  try {
    // Encode secret for jose
    const encoder = new TextEncoder();
    const secretKey = encoder.encode(options.secret);

    // Verify JWT signature and expiry
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ['HS256'],
    });

    // Check token type (must be access token, not refresh token)
    if (payload.type !== 'botcha-verified') {
      return {
        valid: false,
        error: 'Invalid token type. Expected botcha-verified token.',
      };
    }

    const jti = payload.jti as string | undefined;

    // Check revocation status (if callback provided)
    if (jti && options.checkRevocation) {
      try {
        const isRevoked = await options.checkRevocation(jti);
        if (isRevoked) {
          return {
            valid: false,
            error: 'Token has been revoked',
          };
        }
      } catch (error) {
        // Fail-open: if revocation check fails, log and allow token to proceed
        console.error('Failed to check revocation status:', error);
      }
    }

    // Validate audience claim (if required)
    if (options.audience) {
      const tokenAud = payload.aud as string | undefined;
      if (!tokenAud || tokenAud !== options.audience) {
        return {
          valid: false,
          error: `Invalid audience claim. Expected "${options.audience}", got "${tokenAud || 'none'}"`,
        };
      }
    }

    // Validate client IP binding (if required or clientIp provided)
    const effectiveClientIp = options.clientIp || clientIp_;
    if (effectiveClientIp && (options.requireIp || options.clientIp)) {
      const tokenIp = payload.client_ip as string | undefined;
      if (!tokenIp || tokenIp !== effectiveClientIp) {
        return {
          valid: false,
          error: 'Client IP mismatch',
        };
      }
    }

    // Token is valid
    return {
      valid: true,
      payload: {
        sub: payload.sub || '',
        iat: payload.iat || 0,
        exp: payload.exp || 0,
        jti: jti || '',
        type: payload.type as 'botcha-verified',
        solveTime: payload.solveTime as number,
        aud: payload.aud as string | undefined,
        client_ip: payload.client_ip as string | undefined,
      },
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Invalid token',
    };
  }
}

/**
 * Extract Bearer token from Authorization header
 * 
 * @param authHeader - Authorization header value
 * @returns Extracted token or null if not found
 */
export function extractBearerToken(authHeader?: string): string | null {
  if (!authHeader) return null;
  
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}
