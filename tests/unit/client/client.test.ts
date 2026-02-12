import { describe, test, expect, vi, beforeEach } from 'vitest';
import { BotchaClient } from '../../../lib/client/index.js';

describe('BotchaClient', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('Constructor', () => {
    test('uses default baseUrl', () => {
      const client = new BotchaClient();
      // Access private property for testing via bracket notation
      expect((client as any).baseUrl).toBe('https://botcha.ai');
    });

    test('uses default agentIdentity with SDK version', () => {
      const client = new BotchaClient();
      expect((client as any).agentIdentity).toMatch(/^BotchaClient\/\d+\.\d+\.\d+$/);
    });

    test('accepts custom options', () => {
      const client = new BotchaClient({
        baseUrl: 'https://custom.botcha.ai',
        agentIdentity: 'CustomAgent/1.0.0',
        maxRetries: 5,
      });
      
      expect((client as any).baseUrl).toBe('https://custom.botcha.ai');
      expect((client as any).agentIdentity).toBe('CustomAgent/1.0.0');
      expect((client as any).maxRetries).toBe(5);
    });

    test('accepts appId option', () => {
      const client = new BotchaClient({
        appId: 'test-app-123',
      });
      
      expect((client as any).appId).toBe('test-app-123');
    });
  });

  describe('solveChallenge()', () => {
    test('throws on non-200 response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        status: 500,
        ok: false,
        statusText: 'Internal Server Error',
      });

      const client = new BotchaClient();
      await expect(client.solveChallenge()).rejects.toThrow(
        'Challenge request failed with status 500 Internal Server Error'
      );
    });

    test('throws on non-JSON response (text/html)', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        headers: {
          get: vi.fn().mockReturnValue('text/html'),
        },
      });

      const client = new BotchaClient();
      await expect(client.solveChallenge()).rejects.toThrow(
        'Expected JSON response for challenge request'
      );
    });

    test('throws when success=false in response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        headers: {
          get: vi.fn().mockReturnValue('application/json'),
        },
        json: vi.fn().mockResolvedValue({
          success: false,
        }),
      });

      const client = new BotchaClient();
      await expect(client.solveChallenge()).rejects.toThrow(
        'Failed to get challenge'
      );
    });

    test('successfully solves challenge when response is valid', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        headers: {
          get: vi.fn().mockReturnValue('application/json'),
        },
        json: vi.fn().mockResolvedValue({
          success: true,
          challenge: {
            id: 'test-challenge-id',
            problems: [
              { num: 123456, operation: 'sha256_first8' },
              { num: 789012, operation: 'sha256_first8' },
            ],
            timeLimit: 10000,
            instructions: 'Solve these problems',
          },
        }),
      });

      const client = new BotchaClient();
      const result = await client.solveChallenge();
      
      expect(result.id).toBe('test-challenge-id');
      expect(result.answers).toHaveLength(2);
      expect(result.answers[0]).toHaveLength(8);
      expect(result.answers[1]).toHaveLength(8);
    });
  });

  describe('verify()', () => {
    test('throws on non-200 response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        status: 400,
        ok: false,
        statusText: 'Bad Request',
      });

      const client = new BotchaClient();
      await expect(client.verify('test-id', ['answer1'])).rejects.toThrow(
        'Verification request failed with status 400 Bad Request'
      );
    });

    test('throws on non-JSON response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        headers: {
          get: vi.fn().mockReturnValue('text/plain'),
        },
      });

      const client = new BotchaClient();
      await expect(client.verify('test-id', ['answer1'])).rejects.toThrow(
        'Expected JSON response for verification request'
      );
    });

    test('successfully verifies with valid response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        headers: {
          get: vi.fn().mockReturnValue('application/json'),
        },
        json: vi.fn().mockResolvedValue({
          success: true,
          message: 'Verification successful',
          solveTimeMs: 123,
          verdict: 'PASS',
        }),
      });

      const client = new BotchaClient();
      const result = await client.verify('test-id', ['answer1']);
      
      expect(result.success).toBe(true);
      expect(result.message).toBe('Verification successful');
    });
  });

  describe('fetch()', () => {
    const createClient = (options: ConstructorParameters<typeof BotchaClient>[0] = {}) =>
      new BotchaClient({ autoToken: false, ...options });

    test('returns response on 200 status', async () => {
      const mockResponse = {
        status: 200,
        ok: true,
        json: vi.fn().mockResolvedValue({ data: 'test' }),
      };

      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      const client = createClient();
      const response = await client.fetch('https://example.com');
      
      expect(response.status).toBe(200);
      expect(response.ok).toBe(true);
    });

    test('clones response before reading body (response.json() should still work for caller)', async () => {
      const mockJson = vi.fn().mockResolvedValue({ data: 'test' });
      const mockClone = vi.fn().mockReturnValue({
        json: vi.fn().mockResolvedValue({ data: 'test' }),
      });

      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        json: mockJson,
        clone: mockClone,
      });

      const client = createClient();
      const response = await client.fetch('https://example.com');
      
      // Ensure response body is still usable by caller
      const data = await response.json();
      expect(data).toEqual({ data: 'test' });
      expect(mockJson).toHaveBeenCalled();
    });

    test('retries on BOTCHA challenge (403 with challenge in body)', async () => {
      const challengeResponse = {
        status: 403,
        ok: false,
        clone: vi.fn().mockReturnValue({
          json: vi.fn().mockResolvedValue({
            challenge: {
              id: 'challenge-123',
              problems: [{ num: 123456, operation: 'sha256_first8' }],
            },
          }),
        }),
      };

      const successResponse = {
        status: 200,
        ok: true,
        json: vi.fn().mockResolvedValue({ data: 'success' }),
      };

      global.fetch = vi.fn()
        .mockResolvedValueOnce(challengeResponse)
        .mockResolvedValueOnce(successResponse);

      const client = createClient();
      const response = await client.fetch('https://example.com');
      
      expect(response.status).toBe(200);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    test('respects maxRetries limit (stops after max attempts)', async () => {
      const challengeResponse = {
        status: 403,
        ok: false,
        clone: vi.fn().mockReturnValue({
          json: vi.fn().mockResolvedValue({
            challenge: {
              id: 'challenge-123',
              problems: [{ num: 123456, operation: 'sha256_first8' }],
            },
          }),
        }),
      };

      global.fetch = vi.fn().mockResolvedValue(challengeResponse);

      const client = createClient({ maxRetries: 2 });
      const response = await client.fetch('https://example.com');
      
      // Initial request + 2 retries = 3 total calls
      expect(global.fetch).toHaveBeenCalledTimes(3);
      expect(response.status).toBe(403);
    });

    test('breaks loop on non-BOTCHA 403 (no challenge in body)', async () => {
      const non403Response = {
        status: 403,
        ok: false,
        clone: vi.fn().mockReturnValue({
          json: vi.fn().mockResolvedValue({
            error: 'Forbidden',
            message: 'Access denied',
          }),
        }),
      };

      global.fetch = vi.fn().mockResolvedValue(non403Response);

      const client = createClient({ maxRetries: 3 });
      const response = await client.fetch('https://example.com');
      
      // Should only call fetch once since it's not a BOTCHA challenge
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(response.status).toBe(403);
    });

    test('handles challenge with problems array directly', async () => {
      const challengeResponse = {
        status: 403,
        ok: false,
        clone: vi.fn().mockReturnValue({
          json: vi.fn().mockResolvedValue({
            challenge: {
              id: 'challenge-456',
              problems: [789012, 345678],
            },
          }),
        }),
      };

      const successResponse = {
        status: 200,
        ok: true,
        json: vi.fn().mockResolvedValue({ data: 'success' }),
      };

      global.fetch = vi.fn()
        .mockResolvedValueOnce(challengeResponse)
        .mockResolvedValueOnce(successResponse);

      const client = createClient();
      const response = await client.fetch('https://example.com');
      
      expect(response.status).toBe(200);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    test('solves standard challenge puzzle and retries with X-Botcha-Solution', async () => {
      const puzzle = 'Compute SHA256 of the first 10 prime numbers concatenated (no separators). Return the first 16 hex characters.';
      const challengeResponse = {
        status: 403,
        ok: false,
        clone: vi.fn().mockReturnValue({
          json: vi.fn().mockResolvedValue({
            challenge: {
              id: 'challenge-standard-1',
              puzzle,
            },
          }),
        }),
      };

      const successResponse = {
        status: 200,
        ok: true,
        json: vi.fn().mockResolvedValue({ data: 'success' }),
      };

      const fetchMock = vi.fn()
        .mockResolvedValueOnce(challengeResponse)
        .mockResolvedValueOnce(successResponse);

      global.fetch = fetchMock;

      const client = createClient();
      const response = await client.fetch('https://example.com');

      expect(response.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledTimes(2);

      const secondCallArgs = fetchMock.mock.calls[1];
      const secondInit = secondCallArgs[1] as RequestInit;
      const headers = new Headers(secondInit.headers);
      const solution = headers.get('X-Botcha-Solution');
      expect(solution).toBeTruthy();
      expect(headers.get('X-Botcha-Challenge-Id')).toBe('challenge-standard-1');
    });
  });

  describe('createHeaders()', () => {
    test('returns correct header structure', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        headers: {
          get: vi.fn().mockReturnValue('application/json'),
        },
        json: vi.fn().mockResolvedValue({
          success: true,
          challenge: {
            id: 'test-challenge-id',
            problems: [{ num: 123456, operation: 'sha256_first8' }],
            timeLimit: 10000,
            instructions: 'Solve this',
          },
        }),
      });

      const client = new BotchaClient();
      const headers = await client.createHeaders();
      
      expect(headers).toHaveProperty('X-Botcha-Id');
      expect(headers).toHaveProperty('X-Botcha-Challenge-Id');
      expect(headers).toHaveProperty('X-Botcha-Answers');
      expect(headers).toHaveProperty('User-Agent');
      expect(headers['X-Botcha-Id']).toBe('test-challenge-id');
      expect(headers['User-Agent']).toMatch(/^BotchaClient\/\d+\.\d+\.\d+$/);
      
      // Verify answers is a JSON string
      const answers = JSON.parse(headers['X-Botcha-Answers']);
      expect(Array.isArray(answers)).toBe(true);
      expect(answers).toHaveLength(1);
    });

    test('includes X-Botcha-App-Id header when appId is set', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        headers: {
          get: vi.fn().mockReturnValue('application/json'),
        },
        json: vi.fn().mockResolvedValue({
          success: true,
          challenge: {
            id: 'test-challenge-id',
            problems: [{ num: 123456, operation: 'sha256_first8' }],
            timeLimit: 10000,
            instructions: 'Solve this',
          },
        }),
      });

      const client = new BotchaClient({ appId: 'test-app-123' });
      const headers = await client.createHeaders();
      
      expect(headers).toHaveProperty('X-Botcha-App-Id');
      expect(headers['X-Botcha-App-Id']).toBe('test-app-123');
    });

    test('does not include X-Botcha-App-Id header when appId is not set', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        headers: {
          get: vi.fn().mockReturnValue('application/json'),
        },
        json: vi.fn().mockResolvedValue({
          success: true,
          challenge: {
            id: 'test-challenge-id',
            problems: [{ num: 123456, operation: 'sha256_first8' }],
            timeLimit: 10000,
            instructions: 'Solve this',
          },
        }),
      });

      const client = new BotchaClient();
      const headers = await client.createHeaders();
      
      expect(headers).not.toHaveProperty('X-Botcha-App-Id');
    });
  });

  describe('appId support', () => {
    test('appId is passed as query param in getToken()', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({
          status: 200,
          ok: true,
          json: vi.fn().mockResolvedValue({
            challenge: {
              id: 'test-challenge-id',
              problems: [{ num: 123456, operation: 'sha256_first8' }],
              timeLimit: 10000,
            },
          }),
        })
        .mockResolvedValueOnce({
          status: 200,
          ok: true,
          json: vi.fn().mockResolvedValue({
            success: true,
            verified: true,
            access_token: 'test-token',
            expires_in: 300,
          }),
        });

      global.fetch = fetchMock;

      const client = new BotchaClient({ appId: 'test-app-123' });
      await client.getToken();

      // Check first call (GET /v1/token)
      expect(fetchMock.mock.calls[0][0]).toContain('app_id=test-app-123');
    });

    test('appId is passed in POST /v1/token/verify body', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({
          status: 200,
          ok: true,
          json: vi.fn().mockResolvedValue({
            challenge: {
              id: 'test-challenge-id',
              problems: [{ num: 123456, operation: 'sha256_first8' }],
              timeLimit: 10000,
            },
          }),
        })
        .mockResolvedValueOnce({
          status: 200,
          ok: true,
          json: vi.fn().mockResolvedValue({
            success: true,
            verified: true,
            access_token: 'test-token',
            expires_in: 300,
          }),
        });

      global.fetch = fetchMock;

      const client = new BotchaClient({ appId: 'test-app-123' });
      await client.getToken();

      // Check second call (POST /v1/token/verify)
      const verifyCall = fetchMock.mock.calls[1];
      const body = JSON.parse(verifyCall[1].body);
      expect(body.app_id).toBe('test-app-123');
    });

    test('appId is passed as query param in solveChallenge()', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        headers: {
          get: vi.fn().mockReturnValue('application/json'),
        },
        json: vi.fn().mockResolvedValue({
          success: true,
          challenge: {
            id: 'test-challenge-id',
            problems: [{ num: 123456, operation: 'sha256_first8' }],
            timeLimit: 10000,
            instructions: 'Solve this',
          },
        }),
      });

      global.fetch = fetchMock;

      const client = new BotchaClient({ appId: 'test-app-123' });
      await client.solveChallenge();

      expect(fetchMock.mock.calls[0][0]).toContain('app_id=test-app-123');
    });

    test('backward compatibility: no appId means no query param', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({
          status: 200,
          ok: true,
          json: vi.fn().mockResolvedValue({
            challenge: {
              id: 'test-challenge-id',
              problems: [{ num: 123456, operation: 'sha256_first8' }],
              timeLimit: 10000,
            },
          }),
        })
        .mockResolvedValueOnce({
          status: 200,
          ok: true,
          json: vi.fn().mockResolvedValue({
            success: true,
            verified: true,
            access_token: 'test-token',
            expires_in: 300,
          }),
        });

      global.fetch = fetchMock;

      const client = new BotchaClient();
      await client.getToken();

      // Check first call - should NOT contain app_id
      expect(fetchMock.mock.calls[0][0]).not.toContain('app_id');
      
      // Check second call - body should NOT contain app_id
      const verifyCall = fetchMock.mock.calls[1];
      const body = JSON.parse(verifyCall[1].body);
      expect(body.app_id).toBeUndefined();
    });
  });

  describe('createApp()', () => {
    test('creates app and auto-sets appId', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        status: 201,
        ok: true,
        json: vi.fn().mockResolvedValue({
          success: true,
          app_id: 'app_test123',
          app_secret: 'sk_secret',
          email: 'agent@example.com',
          email_verified: false,
          verification_required: true,
          warning: 'Save your secret!',
          credential_advice: 'Store securely.',
          created_at: '2026-01-01T00:00:00Z',
          rate_limit: 100,
          next_step: 'POST /v1/apps/app_test123/verify-email',
        }),
      });

      const client = new BotchaClient();
      const result = await client.createApp('agent@example.com');

      expect(result.success).toBe(true);
      expect(result.app_id).toBe('app_test123');
      expect(result.app_secret).toBe('sk_secret');
      expect(result.email).toBe('agent@example.com');
      expect(result.email_verified).toBe(false);
      // appId should be auto-set
      expect((client as any).appId).toBe('app_test123');

      // Verify POST body
      const call = (global.fetch as any).mock.calls[0];
      expect(call[0]).toContain('/v1/apps');
      expect(call[1].method).toBe('POST');
      const body = JSON.parse(call[1].body);
      expect(body.email).toBe('agent@example.com');
    });

    test('throws on missing email (400)', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        status: 400,
        ok: false,
        json: vi.fn().mockResolvedValue({
          success: false,
          error: 'MISSING_EMAIL',
          message: 'Email is required',
        }),
      });

      const client = new BotchaClient();
      await expect(client.createApp('')).rejects.toThrow('Email is required');
    });
  });

  describe('verifyEmail()', () => {
    test('verifies email with code', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        json: vi.fn().mockResolvedValue({
          success: true,
          email_verified: true,
        }),
      });

      const client = new BotchaClient({ appId: 'app_test123' });
      const result = await client.verifyEmail('123456');

      expect(result.success).toBe(true);
      expect(result.email_verified).toBe(true);

      const call = (global.fetch as any).mock.calls[0];
      expect(call[0]).toContain('/v1/apps/app_test123/verify-email');
      const body = JSON.parse(call[1].body);
      expect(body.code).toBe('123456');
    });

    test('throws when no appId set', async () => {
      const client = new BotchaClient();
      await expect(client.verifyEmail('123456')).rejects.toThrow('No app ID');
    });

    test('accepts explicit appId override', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        json: vi.fn().mockResolvedValue({ success: true, email_verified: true }),
      });

      const client = new BotchaClient({ appId: 'app_default' });
      await client.verifyEmail('123456', 'app_override');

      const call = (global.fetch as any).mock.calls[0];
      expect(call[0]).toContain('/v1/apps/app_override/verify-email');
    });
  });

  describe('resendVerification()', () => {
    test('resends verification email', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        json: vi.fn().mockResolvedValue({
          success: true,
          message: 'Verification code sent',
        }),
      });

      const client = new BotchaClient({ appId: 'app_test123' });
      const result = await client.resendVerification();

      expect(result.success).toBe(true);

      const call = (global.fetch as any).mock.calls[0];
      expect(call[0]).toContain('/v1/apps/app_test123/resend-verification');
      expect(call[1].method).toBe('POST');
    });

    test('throws when no appId set', async () => {
      const client = new BotchaClient();
      await expect(client.resendVerification()).rejects.toThrow('No app ID');
    });
  });

  describe('recoverAccount()', () => {
    test('sends recovery request', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        json: vi.fn().mockResolvedValue({
          success: true,
          message: 'If this email is registered, a recovery code has been sent.',
        }),
      });

      const client = new BotchaClient();
      const result = await client.recoverAccount('agent@example.com');

      expect(result.success).toBe(true);
      expect(result.message).toContain('recovery code');

      const call = (global.fetch as any).mock.calls[0];
      expect(call[0]).toContain('/v1/auth/recover');
      const body = JSON.parse(call[1].body);
      expect(body.email).toBe('agent@example.com');
    });
  });

  describe('rotateSecret()', () => {
    test('rotates secret with Bearer token', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        json: vi.fn().mockResolvedValue({
          success: true,
          app_id: 'app_test123',
          app_secret: 'sk_new_secret',
          warning: 'Save your new secret!',
          rotated_at: '2026-01-01T00:00:00Z',
        }),
      });

      const client = new BotchaClient({ appId: 'app_test123' });
      // Simulate having a cached token
      (client as any).cachedToken = 'session-token-xyz';

      const result = await client.rotateSecret();

      expect(result.success).toBe(true);
      expect(result.app_secret).toBe('sk_new_secret');

      const call = (global.fetch as any).mock.calls[0];
      expect(call[0]).toContain('/v1/apps/app_test123/rotate-secret');
      expect(call[1].headers['Authorization']).toBe('Bearer session-token-xyz');
    });

    test('throws when no appId set', async () => {
      const client = new BotchaClient();
      await expect(client.rotateSecret()).rejects.toThrow('No app ID');
    });

    test('throws on auth failure (401)', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        status: 401,
        ok: false,
        json: vi.fn().mockResolvedValue({
          success: false,
          message: 'Authentication required',
        }),
      });

      const client = new BotchaClient({ appId: 'app_test123' });
      await expect(client.rotateSecret()).rejects.toThrow('Authentication required');
    });
  });
});
