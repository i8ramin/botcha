/**
 * Tests for BOTCHA Hono middleware
 */

import { describe, it, expect, vi } from 'vitest';
import { SignJWT } from 'jose';
import { Hono } from 'hono';
import { botchaVerify } from '../src/middleware/hono.js';
import type { BotchaTokenPayload } from '../src/types.js';

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

describe('Hono botchaVerify middleware', () => {
  describe('Valid tokens', () => {
    it('should verify valid token and continue', async () => {
      const token = await createTestToken({
        sub: 'challenge-123',
        type: 'botcha-verified',
        jti: 'token-id-123',
        solveTime: 1500,
      });

      const app = new Hono<{ Variables: { botcha: BotchaTokenPayload } }>();
      app.use('/api/*', botchaVerify({ secret: TEST_SECRET }));
      app.get('/api/test', (c) => {
        const botcha = c.get('botcha');
        return c.json({
          sub: botcha.sub,
          solveTime: botcha.solveTime,
        });
      });

      const res = await app.request('/api/test', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.sub).toBe('challenge-123');
      expect(data.solveTime).toBe(1500);
    });

    it('should verify token with audience claim', async () => {
      const token = await createTestToken({
        sub: 'challenge-123',
        type: 'botcha-verified',
        jti: 'token-id-123',
        solveTime: 1500,
        aud: TEST_AUDIENCE,
      });

      const app = new Hono<{ Variables: { botcha: BotchaTokenPayload } }>();
      app.use(
        '/api/*',
        botchaVerify({
          secret: TEST_SECRET,
          audience: TEST_AUDIENCE,
        })
      );
      app.get('/api/test', (c) => {
        const botcha = c.get('botcha');
        return c.json({ aud: botcha.aud });
      });

      const res = await app.request('/api/test', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.aud).toBe(TEST_AUDIENCE);
    });

    it('should verify token with client IP from CF-Connecting-IP', async () => {
      const token = await createTestToken({
        sub: 'challenge-123',
        type: 'botcha-verified',
        jti: 'token-id-123',
        solveTime: 1500,
        client_ip: TEST_CLIENT_IP,
      });

      const app = new Hono<{ Variables: { botcha: BotchaTokenPayload } }>();
      app.use(
        '/api/*',
        botchaVerify({
          secret: TEST_SECRET,
          requireIp: true,
        })
      );
      app.get('/api/test', (c) => c.json({ success: true }));

      const res = await app.request('/api/test', {
        headers: {
          Authorization: `Bearer ${token}`,
          'CF-Connecting-IP': TEST_CLIENT_IP,
        },
      });

      expect(res.status).toBe(200);
    });

    it('should verify token with client IP from X-Forwarded-For', async () => {
      const token = await createTestToken({
        sub: 'challenge-123',
        type: 'botcha-verified',
        jti: 'token-id-123',
        solveTime: 1500,
        client_ip: '203.0.113.1',
      });

      const app = new Hono<{ Variables: { botcha: BotchaTokenPayload } }>();
      app.use(
        '/api/*',
        botchaVerify({
          secret: TEST_SECRET,
          requireIp: true,
        })
      );
      app.get('/api/test', (c) => c.json({ success: true }));

      const res = await app.request('/api/test', {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Forwarded-For': '203.0.113.1, 198.51.100.1',
        },
      });

      expect(res.status).toBe(200);
    });

    it('should verify token with client IP from X-Real-IP', async () => {
      const token = await createTestToken({
        sub: 'challenge-123',
        type: 'botcha-verified',
        jti: 'token-id-123',
        solveTime: 1500,
        client_ip: '203.0.113.1',
      });

      const app = new Hono<{ Variables: { botcha: BotchaTokenPayload } }>();
      app.use(
        '/api/*',
        botchaVerify({
          secret: TEST_SECRET,
          requireIp: true,
        })
      );
      app.get('/api/test', (c) => c.json({ success: true }));

      const res = await app.request('/api/test', {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Real-IP': '203.0.113.1',
        },
      });

      expect(res.status).toBe(200);
    });
  });

  describe('Invalid tokens', () => {
    it('should return 401 for missing Authorization header', async () => {
      const app = new Hono<{ Variables: { botcha: BotchaTokenPayload } }>();
      app.use('/api/*', botchaVerify({ secret: TEST_SECRET }));
      app.get('/api/test', (c) => c.json({ success: true }));

      const res = await app.request('/api/test');

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe('Unauthorized');
      expect(data.message).toContain('Missing Authorization header');
    });

    it('should return 401 for malformed Authorization header', async () => {
      const app = new Hono<{ Variables: { botcha: BotchaTokenPayload } }>();
      app.use('/api/*', botchaVerify({ secret: TEST_SECRET }));
      app.get('/api/test', (c) => c.json({ success: true }));

      const res = await app.request('/api/test', {
        headers: {
          Authorization: 'Basic abc123',
        },
      });

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 401 for invalid token', async () => {
      const app = new Hono<{ Variables: { botcha: BotchaTokenPayload } }>();
      app.use('/api/*', botchaVerify({ secret: TEST_SECRET }));
      app.get('/api/test', (c) => c.json({ success: true }));

      const res = await app.request('/api/test', {
        headers: {
          Authorization: 'Bearer invalid-token',
        },
      });

      expect(res.status).toBe(401);
    });

    it('should return 401 for expired token', async () => {
      const token = await createTestToken(
        {
          sub: 'challenge-123',
          type: 'botcha-verified',
          jti: 'token-id-123',
          solveTime: 1500,
        },
        TEST_SECRET,
        '0s'
      );

      await new Promise((resolve) => setTimeout(resolve, 100));

      const app = new Hono<{ Variables: { botcha: BotchaTokenPayload } }>();
      app.use('/api/*', botchaVerify({ secret: TEST_SECRET }));
      app.get('/api/test', (c) => c.json({ success: true }));

      const res = await app.request('/api/test', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      expect(res.status).toBe(401);
    });

    it('should return 401 for wrong token type', async () => {
      const token = await createTestToken({
        sub: 'challenge-123',
        type: 'botcha-refresh',
        jti: 'token-id-123',
        solveTime: 1500,
      });

      const app = new Hono<{ Variables: { botcha: BotchaTokenPayload } }>();
      app.use('/api/*', botchaVerify({ secret: TEST_SECRET }));
      app.get('/api/test', (c) => c.json({ success: true }));

      const res = await app.request('/api/test', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.message).toContain('Invalid token type');
    });

    it('should return 401 for wrong audience', async () => {
      const token = await createTestToken({
        sub: 'challenge-123',
        type: 'botcha-verified',
        jti: 'token-id-123',
        solveTime: 1500,
        aud: 'https://different.example.com',
      });

      const app = new Hono<{ Variables: { botcha: BotchaTokenPayload } }>();
      app.use(
        '/api/*',
        botchaVerify({
          secret: TEST_SECRET,
          audience: TEST_AUDIENCE,
        })
      );
      app.get('/api/test', (c) => c.json({ success: true }));

      const res = await app.request('/api/test', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.message).toContain('Invalid audience claim');
    });

    it('should return 401 for IP mismatch', async () => {
      const token = await createTestToken({
        sub: 'challenge-123',
        type: 'botcha-verified',
        jti: 'token-id-123',
        solveTime: 1500,
        client_ip: '10.0.0.1',
      });

      const app = new Hono<{ Variables: { botcha: BotchaTokenPayload } }>();
      app.use(
        '/api/*',
        botchaVerify({
          secret: TEST_SECRET,
          requireIp: true,
        })
      );
      app.get('/api/test', (c) => c.json({ success: true }));

      const res = await app.request('/api/test', {
        headers: {
          Authorization: `Bearer ${token}`,
          'CF-Connecting-IP': TEST_CLIENT_IP, // Different IP
        },
      });

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.message).toContain('Client IP mismatch');
    });
  });

  describe('Custom error handler', () => {
    it('should call custom onError handler for missing token', async () => {
      let errorCalled = false;
      let errorMessage = '';
      let errorContext: any;

      const app = new Hono<{ Variables: { botcha: BotchaTokenPayload } }>();
      app.use('/api/*', botchaVerify({
        secret: TEST_SECRET,
        onError: (msg, ctx) => {
          errorCalled = true;
          errorMessage = msg;
          errorContext = ctx;
        }
      }));
      app.get('/api/test', (c) => c.json({ success: true }));

      const res = await app.request('/api/test');

      expect(errorCalled).toBe(true);
      expect(errorMessage).toBe('Missing Authorization header with Bearer token');
      expect(errorContext.error).toBe('Missing Authorization header with Bearer token');
    });

    it('should call custom onError handler for invalid token', async () => {
      let errorCalled = false;
      let errorContext: any;

      const app = new Hono<{ Variables: { botcha: BotchaTokenPayload } }>();
      app.use('/api/*', botchaVerify({
        secret: TEST_SECRET,
        onError: (msg, ctx) => {
          errorCalled = true;
          errorContext = ctx;
        }
      }));
      app.get('/api/test', (c) => c.json({ success: true }));

      const res = await app.request('/api/test', {
        headers: {
          Authorization: 'Bearer invalid-token',
        },
      });

      expect(errorCalled).toBe(true);
      expect(errorContext.token).toBe('invalid-token');
      expect(errorContext.error).toBeDefined();
    });

    it('should call custom onError handler with client IP context', async () => {
      let errorContext: any;

      const app = new Hono<{ Variables: { botcha: BotchaTokenPayload } }>();
      app.use('/api/*', botchaVerify({
        secret: TEST_SECRET,
        onError: (msg, ctx) => {
          errorContext = ctx;
        }
      }));
      app.get('/api/test', (c) => c.json({ success: true }));

      const res = await app.request('/api/test', {
        headers: {
          'CF-Connecting-IP': '203.0.113.1',
        },
      });

      expect(errorContext.clientIp).toBe('203.0.113.1');
    });
  });

  describe('Token revocation', () => {
    it('should reject revoked token', async () => {
      const token = await createTestToken({
        sub: 'challenge-123',
        type: 'botcha-verified',
        jti: 'revoked-token',
        solveTime: 1500,
      });

      const app = new Hono<{ Variables: { botcha: BotchaTokenPayload } }>();
      app.use(
        '/api/*',
        botchaVerify({
          secret: TEST_SECRET,
          checkRevocation: async (jti) => jti === 'revoked-token',
        })
      );
      app.get('/api/test', (c) => c.json({ success: true }));

      const res = await app.request('/api/test', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.message).toContain('revoked');
    });

    it('should accept non-revoked token', async () => {
      const token = await createTestToken({
        sub: 'challenge-123',
        type: 'botcha-verified',
        jti: 'active-token',
        solveTime: 1500,
      });

      const app = new Hono<{ Variables: { botcha: BotchaTokenPayload } }>();
      app.use(
        '/api/*',
        botchaVerify({
          secret: TEST_SECRET,
          checkRevocation: async (jti) => jti === 'revoked-token',
        })
      );
      app.get('/api/test', (c) => c.json({ success: true }));

      const res = await app.request('/api/test', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      expect(res.status).toBe(200);
    });
  });
});
