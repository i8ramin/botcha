import { describe, test, expect, beforeEach } from 'vitest';
import {
  checkRateLimit,
  getClientIP,
  type RateLimitResult,
} from '../../../packages/cloudflare-workers/src/rate-limit.js';
import type { KVNamespace } from '../../../packages/cloudflare-workers/src/challenges.js';

// Mock KV namespace using a simple Map
class MockKV implements KVNamespace {
  private store = new Map<string, string>();
  public shouldFailOnNextOp = false; // For testing error handling

  async get(key: string, type?: 'text' | 'json' | 'arrayBuffer' | 'stream'): Promise<any> {
    if (this.shouldFailOnNextOp) {
      this.shouldFailOnNextOp = false;
      throw new Error('KV get failed');
    }
    
    const value = this.store.get(key);
    if (!value) return null;
    
    if (type === 'json') {
      return JSON.parse(value);
    }
    return value;
  }

  async put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
    if (this.shouldFailOnNextOp) {
      this.shouldFailOnNextOp = false;
      throw new Error('KV put failed');
    }
    
    this.store.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  // Helper to inspect store in tests
  has(key: string): boolean {
    return this.store.has(key);
  }

  size(): number {
    return this.store.size;
  }

  getKey(key: string): string | undefined {
    return this.store.get(key);
  }
}

describe('Rate Limiting', () => {
  describe('checkRateLimit() - IP-based (default behavior)', () => {
    let mockKV: MockKV;
    const testIP = '203.0.113.42';

    beforeEach(() => {
      mockKV = new MockKV();
    });

    test('allows first request and sets remaining count', async () => {
      const result = await checkRateLimit(mockKV, testIP, 100);
      
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(99);
      expect(result.resetAt).toBeGreaterThan(Date.now());
      expect(result.retryAfter).toBeUndefined();
    });

    test('uses IP-based key format: ratelimit:{ip}', async () => {
      await checkRateLimit(mockKV, testIP, 100);
      
      expect(mockKV.has(`ratelimit:${testIP}`)).toBe(true);
    });

    test('decrements remaining count on subsequent requests', async () => {
      const result1 = await checkRateLimit(mockKV, testIP, 100);
      expect(result1.remaining).toBe(99);

      const result2 = await checkRateLimit(mockKV, testIP, 100);
      expect(result2.remaining).toBe(98);

      const result3 = await checkRateLimit(mockKV, testIP, 100);
      expect(result3.remaining).toBe(97);
    });

    test('blocks requests when limit exceeded', async () => {
      // Make 5 requests (limit = 5)
      for (let i = 0; i < 5; i++) {
        const result = await checkRateLimit(mockKV, testIP, 5);
        expect(result.allowed).toBe(true);
      }

      // 6th request should be blocked
      const blocked = await checkRateLimit(mockKV, testIP, 5);
      expect(blocked.allowed).toBe(false);
      expect(blocked.remaining).toBe(0);
      expect(blocked.retryAfter).toBeGreaterThan(0);
    });

    test('tracks different IPs independently', async () => {
      const ip1 = '203.0.113.1';
      const ip2 = '203.0.113.2';

      // IP1: use up limit
      for (let i = 0; i < 3; i++) {
        await checkRateLimit(mockKV, ip1, 3);
      }
      const ip1Blocked = await checkRateLimit(mockKV, ip1, 3);
      expect(ip1Blocked.allowed).toBe(false);

      // IP2: should still be allowed
      const ip2Result = await checkRateLimit(mockKV, ip2, 3);
      expect(ip2Result.allowed).toBe(true);
      expect(ip2Result.remaining).toBe(2);
    });

    test('resets window after expiration', async () => {
      // Mock first request with old timestamp
      const oldTimestamp = Date.now() - 3700000; // 1 hour + 100 seconds ago
      await mockKV.put(
        `ratelimit:${testIP}`,
        JSON.stringify({ count: 100, firstRequest: oldTimestamp })
      );

      // New request should reset window
      const result = await checkRateLimit(mockKV, testIP, 100);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(99); // Fresh window
    });

    test('returns default limit of 100 when not specified', async () => {
      const result = await checkRateLimit(mockKV, testIP);
      expect(result.remaining).toBe(99); // 100 - 1
    });
  });

  describe('checkRateLimit() - App-scoped rate limiting', () => {
    let mockKV: MockKV;
    const testIP = '203.0.113.42';
    const testAppId = 'app_test123456789abc';

    beforeEach(() => {
      mockKV = new MockKV();
    });

    test('uses app-scoped key format: rate:app:{app_id}', async () => {
      await checkRateLimit(mockKV, testIP, 100, testAppId);
      
      expect(mockKV.has(`rate:app:${testAppId}`)).toBe(true);
      expect(mockKV.has(`ratelimit:${testIP}`)).toBe(false); // IP key NOT used
    });

    test('allows first request for app', async () => {
      const result = await checkRateLimit(mockKV, testIP, 100, testAppId);
      
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(99);
      expect(result.resetAt).toBeGreaterThan(Date.now());
    });

    test('tracks app rate limit independently of IP', async () => {
      // App requests (limit 3)
      for (let i = 0; i < 3; i++) {
        await checkRateLimit(mockKV, testIP, 3, testAppId);
      }
      const appBlocked = await checkRateLimit(mockKV, testIP, 3, testAppId);
      expect(appBlocked.allowed).toBe(false);

      // IP-based request (no app_id) should still be allowed
      const ipResult = await checkRateLimit(mockKV, testIP, 3);
      expect(ipResult.allowed).toBe(true);
      expect(ipResult.remaining).toBe(2);
    });

    test('blocks app when limit exceeded', async () => {
      // Use up the limit
      for (let i = 0; i < 5; i++) {
        const result = await checkRateLimit(mockKV, testIP, 5, testAppId);
        expect(result.allowed).toBe(true);
      }

      // Next request should be blocked
      const blocked = await checkRateLimit(mockKV, testIP, 5, testAppId);
      expect(blocked.allowed).toBe(false);
      expect(blocked.remaining).toBe(0);
      expect(blocked.retryAfter).toBeGreaterThan(0);
    });

    test('tracks different apps independently', async () => {
      const app1 = 'app_111111111111111';
      const app2 = 'app_222222222222222';

      // App1: use up limit
      for (let i = 0; i < 3; i++) {
        await checkRateLimit(mockKV, testIP, 3, app1);
      }
      const app1Blocked = await checkRateLimit(mockKV, testIP, 3, app1);
      expect(app1Blocked.allowed).toBe(false);

      // App2: should still be allowed
      const app2Result = await checkRateLimit(mockKV, testIP, 3, app2);
      expect(app2Result.allowed).toBe(true);
      expect(app2Result.remaining).toBe(2);
    });

    test('app rate limit applies globally regardless of IP', async () => {
      const ip1 = '203.0.113.1';
      const ip2 = '203.0.113.2';

      // Use up app limit from IP1
      for (let i = 0; i < 3; i++) {
        await checkRateLimit(mockKV, ip1, 3, testAppId);
      }

      // Request from IP2 with same app should also be blocked
      const blockedFromIP2 = await checkRateLimit(mockKV, ip2, 3, testAppId);
      expect(blockedFromIP2.allowed).toBe(false);
      expect(blockedFromIP2.remaining).toBe(0);
    });

    test('resets app window after expiration', async () => {
      // Mock first request with old timestamp
      const oldTimestamp = Date.now() - 3700000; // 1 hour + 100 seconds ago
      await mockKV.put(
        `rate:app:${testAppId}`,
        JSON.stringify({ count: 100, firstRequest: oldTimestamp })
      );

      // New request should reset window
      const result = await checkRateLimit(mockKV, testIP, 100, testAppId);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(99); // Fresh window
    });
  });

  describe('checkRateLimit() - No KV (local dev)', () => {
    test('always allows requests when KV is undefined', async () => {
      const result1 = await checkRateLimit(undefined, '203.0.113.1', 100);
      expect(result1.allowed).toBe(true);
      expect(result1.remaining).toBe(100);

      const result2 = await checkRateLimit(undefined, '203.0.113.1', 100);
      expect(result2.allowed).toBe(true);
      expect(result2.remaining).toBe(100);
    });

    test('works with app_id when KV is undefined', async () => {
      const result = await checkRateLimit(undefined, '203.0.113.1', 100, 'app_test');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(100);
    });
  });

  describe('checkRateLimit() - Error handling (fail-open)', () => {
    let mockKV: MockKV;
    const testIP = '203.0.113.42';

    beforeEach(() => {
      mockKV = new MockKV();
    });

    test('allows request on KV get error', async () => {
      mockKV.shouldFailOnNextOp = true;
      
      const result = await checkRateLimit(mockKV, testIP, 100);
      
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(100);
      expect(result.resetAt).toBeGreaterThan(Date.now());
    });

    test('allows request on KV put error', async () => {
      // First request succeeds
      await checkRateLimit(mockKV, testIP, 100);

      // Second request fails on put
      mockKV.shouldFailOnNextOp = true;
      const result = await checkRateLimit(mockKV, testIP, 100);
      
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(100);
    });

    test('fails open for app-scoped requests on error', async () => {
      mockKV.shouldFailOnNextOp = true;
      
      const result = await checkRateLimit(mockKV, testIP, 100, 'app_test');
      
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(100);
    });
  });

  describe('checkRateLimit() - Rate limit headers data', () => {
    let mockKV: MockKV;
    const testIP = '203.0.113.42';

    beforeEach(() => {
      mockKV = new MockKV();
    });

    test('returns correct limit, remaining, and reset values', async () => {
      const result = await checkRateLimit(mockKV, testIP, 100);
      
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(99); // X-RateLimit-Remaining
      expect(result.resetAt).toBeGreaterThan(Date.now()); // X-RateLimit-Reset
      expect(result.resetAt).toBeLessThanOrEqual(Date.now() + 3600000);
    });

    test('returns retryAfter when blocked', async () => {
      // Use up limit
      for (let i = 0; i < 5; i++) {
        await checkRateLimit(mockKV, testIP, 5);
      }

      const blocked = await checkRateLimit(mockKV, testIP, 5);
      
      expect(blocked.allowed).toBe(false);
      expect(blocked.remaining).toBe(0); // X-RateLimit-Remaining: 0
      expect(blocked.retryAfter).toBeDefined(); // Retry-After header
      expect(blocked.retryAfter).toBeGreaterThan(0);
      expect(blocked.retryAfter).toBeLessThanOrEqual(3600); // Max 1 hour in seconds
    });

    test('remaining count decreases correctly', async () => {
      const results: RateLimitResult[] = [];
      for (let i = 0; i < 5; i++) {
        results.push(await checkRateLimit(mockKV, testIP, 10));
      }

      expect(results[0].remaining).toBe(9);
      expect(results[1].remaining).toBe(8);
      expect(results[2].remaining).toBe(7);
      expect(results[3].remaining).toBe(6);
      expect(results[4].remaining).toBe(5);
    });
  });

  describe('checkRateLimit() - Backward compatibility', () => {
    let mockKV: MockKV;
    const testIP = '203.0.113.42';

    beforeEach(() => {
      mockKV = new MockKV();
    });

    test('works without app_id parameter (original behavior)', async () => {
      // Should work exactly as before when app_id is not provided
      const result = await checkRateLimit(mockKV, testIP, 100);
      
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(99);
      expect(mockKV.has(`ratelimit:${testIP}`)).toBe(true);
    });

    test('maintains existing IP-based key format when no app_id', async () => {
      await checkRateLimit(mockKV, testIP, 100);
      
      const data = mockKV.getKey(`ratelimit:${testIP}`);
      expect(data).toBeDefined();
      
      const parsed = JSON.parse(data!);
      expect(parsed.count).toBe(1);
      expect(parsed.firstRequest).toBeGreaterThan(0);
    });

    test('original function signature still works', async () => {
      // Test with all original parameter combinations
      const result1 = await checkRateLimit(mockKV, testIP);
      expect(result1.allowed).toBe(true);

      const result2 = await checkRateLimit(mockKV, testIP, 50);
      expect(result2.allowed).toBe(true);

      const result3 = await checkRateLimit(undefined, testIP);
      expect(result3.allowed).toBe(true);
    });
  });

  describe('getClientIP()', () => {
    test('extracts CF-Connecting-IP header (Cloudflare)', () => {
      const request = new Request('https://example.com', {
        headers: { 'cf-connecting-ip': '203.0.113.1' },
      });

      const ip = getClientIP(request);
      expect(ip).toBe('203.0.113.1');
    });

    test('falls back to X-Forwarded-For header', () => {
      const request = new Request('https://example.com', {
        headers: { 'x-forwarded-for': '203.0.113.2, 198.51.100.1' },
      });

      const ip = getClientIP(request);
      expect(ip).toBe('203.0.113.2'); // First IP in list
    });

    test('falls back to X-Real-IP header', () => {
      const request = new Request('https://example.com', {
        headers: { 'x-real-ip': '203.0.113.3' },
      });

      const ip = getClientIP(request);
      expect(ip).toBe('203.0.113.3');
    });

    test('returns "unknown" when no IP headers present', () => {
      const request = new Request('https://example.com');

      const ip = getClientIP(request);
      expect(ip).toBe('unknown');
    });

    test('prioritizes CF-Connecting-IP over other headers', () => {
      const request = new Request('https://example.com', {
        headers: {
          'cf-connecting-ip': '203.0.113.1',
          'x-forwarded-for': '203.0.113.2',
          'x-real-ip': '203.0.113.3',
        },
      });

      const ip = getClientIP(request);
      expect(ip).toBe('203.0.113.1'); // CF header wins
    });

    test('handles X-Forwarded-For with multiple IPs', () => {
      const request = new Request('https://example.com', {
        headers: { 'x-forwarded-for': '203.0.113.1, 198.51.100.1, 192.0.2.1' },
      });

      const ip = getClientIP(request);
      expect(ip).toBe('203.0.113.1'); // First IP
    });

    test('trims whitespace from X-Forwarded-For', () => {
      const request = new Request('https://example.com', {
        headers: { 'x-forwarded-for': '  203.0.113.1  , 198.51.100.1' },
      });

      const ip = getClientIP(request);
      expect(ip).toBe('203.0.113.1'); // Trimmed
    });
  });

  describe('Integration: Full workflow', () => {
    let mockKV: MockKV;

    beforeEach(() => {
      mockKV = new MockKV();
    });

    test('complete IP-based rate limiting flow', async () => {
      const ip = '203.0.113.1';
      const limit = 5;

      // Make 5 allowed requests
      for (let i = 0; i < limit; i++) {
        const result = await checkRateLimit(mockKV, ip, limit);
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(limit - i - 1);
      }

      // 6th request blocked
      const blocked = await checkRateLimit(mockKV, ip, limit);
      expect(blocked.allowed).toBe(false);
      expect(blocked.remaining).toBe(0);
      expect(blocked.retryAfter).toBeGreaterThan(0);
    });

    test('complete app-based rate limiting flow', async () => {
      const app = 'app_test123456789abc';
      const limit = 3;

      // Make 3 allowed requests from different IPs
      const result1 = await checkRateLimit(mockKV, '203.0.113.1', limit, app);
      expect(result1.allowed).toBe(true);

      const result2 = await checkRateLimit(mockKV, '203.0.113.2', limit, app);
      expect(result2.allowed).toBe(true);

      const result3 = await checkRateLimit(mockKV, '203.0.113.3', limit, app);
      expect(result3.allowed).toBe(true);

      // 4th request blocked (global app limit)
      const blocked = await checkRateLimit(mockKV, '203.0.113.4', limit, app);
      expect(blocked.allowed).toBe(false);
      expect(blocked.remaining).toBe(0);
    });

    test('mixed IP and app rate limiting', async () => {
      const ip = '203.0.113.1';
      const app = 'app_test';

      // IP-based requests
      await checkRateLimit(mockKV, ip, 10);
      await checkRateLimit(mockKV, ip, 10);

      // App-based requests (independent)
      await checkRateLimit(mockKV, ip, 10, app);
      await checkRateLimit(mockKV, ip, 10, app);

      // Check both are tracked separately
      expect(mockKV.has(`ratelimit:${ip}`)).toBe(true);
      expect(mockKV.has(`rate:app:${app}`)).toBe(true);

      const ipData = JSON.parse(mockKV.getKey(`ratelimit:${ip}`)!);
      expect(ipData.count).toBe(2);

      const appData = JSON.parse(mockKV.getKey(`rate:app:${app}`)!);
      expect(appData.count).toBe(2);
    });
  });
});
