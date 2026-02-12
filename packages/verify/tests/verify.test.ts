/**
 * Tests for core BOTCHA token verification
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { SignJWT } from 'jose';
import { verifyBotchaToken, extractBearerToken } from '../src/index.js';
import type { BotchaVerifyOptions } from '../src/types.js';

const TEST_SECRET = 'test-secret-key-min-32-chars-long-for-hs256';
const TEST_AUDIENCE = 'https://api.example.com';
const TEST_CLIENT_IP = '192.168.1.1';

/**
 * Helper to create test tokens using jose
 */
async function createTestToken(
  payload: Record<string, any>,
  secret: string = TEST_SECRET,
  expiresIn: string = '5m'
): Promise<string> {
  const encoder = new TextEncoder();
  const secretKey = encoder.encode(secret);

  const jwt = new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn);

  if (payload.sub) {
    jwt.setSubject(payload.sub);
  }

  return await jwt.sign(secretKey);
}

describe('verifyBotchaToken', () => {
  describe('Valid tokens', () => {
    it('should verify a valid token with all required claims', async () => {
      const token = await createTestToken({
        sub: 'challenge-123',
        type: 'botcha-verified',
        jti: 'token-id-123',
        solveTime: 1500,
      });

      const result = await verifyBotchaToken(token, {
        secret: TEST_SECRET,
      });

      expect(result.valid).toBe(true);
      expect(result.payload).toBeDefined();
      expect(result.payload?.sub).toBe('challenge-123');
      expect(result.payload?.type).toBe('botcha-verified');
      expect(result.payload?.jti).toBe('token-id-123');
      expect(result.payload?.solveTime).toBe(1500);
      expect(result.error).toBeUndefined();
    });

    it('should verify token with audience claim', async () => {
      const token = await createTestToken({
        sub: 'challenge-123',
        type: 'botcha-verified',
        jti: 'token-id-123',
        solveTime: 1500,
        aud: TEST_AUDIENCE,
      });

      const result = await verifyBotchaToken(token, {
        secret: TEST_SECRET,
        audience: TEST_AUDIENCE,
      });

      expect(result.valid).toBe(true);
      expect(result.payload?.aud).toBe(TEST_AUDIENCE);
    });

    it('should verify token with client IP claim', async () => {
      const token = await createTestToken({
        sub: 'challenge-123',
        type: 'botcha-verified',
        jti: 'token-id-123',
        solveTime: 1500,
        client_ip: TEST_CLIENT_IP,
      });

      const result = await verifyBotchaToken(
        token,
        {
          secret: TEST_SECRET,
          requireIp: true,
        },
        TEST_CLIENT_IP
      );

      expect(result.valid).toBe(true);
      expect(result.payload?.client_ip).toBe(TEST_CLIENT_IP);
    });

    it('should verify token without optional checks', async () => {
      const token = await createTestToken({
        sub: 'challenge-123',
        type: 'botcha-verified',
        jti: 'token-id-123',
        solveTime: 1500,
        aud: TEST_AUDIENCE,
        client_ip: TEST_CLIENT_IP,
      });

      // Don't require audience or IP check
      const result = await verifyBotchaToken(token, {
        secret: TEST_SECRET,
      });

      expect(result.valid).toBe(true);
      expect(result.payload?.aud).toBe(TEST_AUDIENCE);
      expect(result.payload?.client_ip).toBe(TEST_CLIENT_IP);
    });
  });

  describe('Invalid tokens', () => {
    it('should reject token with wrong type', async () => {
      const token = await createTestToken({
        sub: 'challenge-123',
        type: 'botcha-refresh', // Wrong type
        jti: 'token-id-123',
        solveTime: 1500,
      });

      const result = await verifyBotchaToken(token, {
        secret: TEST_SECRET,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid token type');
    });

    it('should reject expired token', async () => {
      const token = await createTestToken(
        {
          sub: 'challenge-123',
          type: 'botcha-verified',
          jti: 'token-id-123',
          solveTime: 1500,
        },
        TEST_SECRET,
        '0s' // Expired immediately
      );

      // Wait a bit to ensure it's expired
      await new Promise((resolve) => setTimeout(resolve, 100));

      const result = await verifyBotchaToken(token, {
        secret: TEST_SECRET,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject token with wrong signature', async () => {
      const token = await createTestToken({
        sub: 'challenge-123',
        type: 'botcha-verified',
        jti: 'token-id-123',
        solveTime: 1500,
      });

      const result = await verifyBotchaToken(token, {
        secret: 'wrong-secret-key', // Different secret
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject malformed token', async () => {
      const result = await verifyBotchaToken('not-a-jwt-token', {
        secret: TEST_SECRET,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject token with wrong audience', async () => {
      const token = await createTestToken({
        sub: 'challenge-123',
        type: 'botcha-verified',
        jti: 'token-id-123',
        solveTime: 1500,
        aud: 'https://different.example.com',
      });

      const result = await verifyBotchaToken(token, {
        secret: TEST_SECRET,
        audience: TEST_AUDIENCE,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid audience claim');
    });

    it('should reject token missing audience when required', async () => {
      const token = await createTestToken({
        sub: 'challenge-123',
        type: 'botcha-verified',
        jti: 'token-id-123',
        solveTime: 1500,
        // No aud claim
      });

      const result = await verifyBotchaToken(token, {
        secret: TEST_SECRET,
        audience: TEST_AUDIENCE,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid audience claim');
    });

    it('should reject token with wrong client IP', async () => {
      const token = await createTestToken({
        sub: 'challenge-123',
        type: 'botcha-verified',
        jti: 'token-id-123',
        solveTime: 1500,
        client_ip: '10.0.0.1',
      });

      const result = await verifyBotchaToken(
        token,
        {
          secret: TEST_SECRET,
          requireIp: true,
        },
        TEST_CLIENT_IP // Different IP
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Client IP mismatch');
    });

    it('should reject token missing client IP when required', async () => {
      const token = await createTestToken({
        sub: 'challenge-123',
        type: 'botcha-verified',
        jti: 'token-id-123',
        solveTime: 1500,
        // No client_ip claim
      });

      const result = await verifyBotchaToken(
        token,
        {
          secret: TEST_SECRET,
          requireIp: true,
        },
        TEST_CLIENT_IP
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Client IP mismatch');
    });
  });

  describe('Token revocation', () => {
    it('should reject revoked token', async () => {
      const token = await createTestToken({
        sub: 'challenge-123',
        type: 'botcha-verified',
        jti: 'revoked-token-id',
        solveTime: 1500,
      });

      const result = await verifyBotchaToken(token, {
        secret: TEST_SECRET,
        checkRevocation: async (jti) => {
          return jti === 'revoked-token-id';
        },
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('revoked');
    });

    it('should accept non-revoked token', async () => {
      const token = await createTestToken({
        sub: 'challenge-123',
        type: 'botcha-verified',
        jti: 'active-token-id',
        solveTime: 1500,
      });

      const result = await verifyBotchaToken(token, {
        secret: TEST_SECRET,
        checkRevocation: async (jti) => {
          return jti === 'revoked-token-id'; // Different JTI
        },
      });

      expect(result.valid).toBe(true);
    });

    it('should fail-open if revocation check throws error', async () => {
      const token = await createTestToken({
        sub: 'challenge-123',
        type: 'botcha-verified',
        jti: 'token-id-123',
        solveTime: 1500,
      });

      // Mock console.error to suppress error output in tests
      const consoleError = console.error;
      console.error = () => {};

      const result = await verifyBotchaToken(token, {
        secret: TEST_SECRET,
        checkRevocation: async () => {
          throw new Error('Revocation service unavailable');
        },
      });

      console.error = consoleError;

      // Should succeed despite revocation check failure (fail-open)
      expect(result.valid).toBe(true);
    });
  });
});

describe('extractBearerToken', () => {
  it('should extract token from valid Bearer header', () => {
    const token = extractBearerToken('Bearer abc123');
    expect(token).toBe('abc123');
  });

  it('should extract token with case-insensitive Bearer', () => {
    const token = extractBearerToken('bearer abc123');
    expect(token).toBe('abc123');
  });

  it('should extract token with mixed case', () => {
    const token = extractBearerToken('BeArEr abc123');
    expect(token).toBe('abc123');
  });

  it('should handle JWT format tokens', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
    const token = extractBearerToken(`Bearer ${jwt}`);
    expect(token).toBe(jwt);
  });

  it('should return null for missing header', () => {
    const token = extractBearerToken(undefined);
    expect(token).toBeNull();
  });

  it('should return null for empty header', () => {
    const token = extractBearerToken('');
    expect(token).toBeNull();
  });

  it('should return null for non-Bearer header', () => {
    const token = extractBearerToken('Basic abc123');
    expect(token).toBeNull();
  });

  it('should return null for malformed Bearer header', () => {
    const token = extractBearerToken('Bearer');
    expect(token).toBeNull();
  });

  it('should handle whitespace after Bearer', () => {
    const token = extractBearerToken('Bearer   abc123');
    expect(token).toBe('abc123'); // Regex captures token after whitespace
  });
});
