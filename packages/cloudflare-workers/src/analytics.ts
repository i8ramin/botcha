/**
 * BOTCHA Analytics Engine Integration
 * 
 * Tracks usage metrics for business intelligence and monitoring
 */

// Analytics Engine binding type
export type AnalyticsEngineDataset = {
  writeDataPoint: (data: {
    blobs?: string[];
    doubles?: number[];
    indexes?: string[];
  }) => void;
};

export interface AnalyticsEvent {
  // Event identification
  eventType: 'challenge_generated' | 'challenge_verified' | 'auth_success' | 'auth_failure' | 'rate_limit_exceeded' | 'error';
  
  // Challenge details
  challengeType?: 'speed' | 'standard' | 'reasoning' | 'hybrid';
  endpoint?: string;
  
  // Verification details
  verificationResult?: 'success' | 'failure';
  verificationReason?: string;
  
  // Authentication details
  authMethod?: 'landing-token' | 'bearer-token' | 'none';
  
  // Performance metrics
  solveTimeMs?: number;
  responseTimeMs?: number;
  
  // Context
  clientIP?: string;
  userAgent?: string;
  country?: string;
  
  // Error details
  errorType?: string;
  errorMessage?: string;
}

/**
 * Log an analytics event to Cloudflare Analytics Engine
 */
export async function logAnalyticsEvent(
  analytics: AnalyticsEngineDataset | undefined,
  event: AnalyticsEvent
): Promise<void> {
  if (!analytics) {
    // Analytics not configured (local dev)
    return;
  }

  try {
    // Cloudflare Analytics Engine uses:
    // - blobs: string[] (up to 20 strings, max 5120 chars total)
    // - doubles: number[] (up to 20 numbers)
    // - indexes: string[] (up to 20 strings for filtering, each max 96 bytes)

    const blobs: string[] = [
      event.eventType,
      event.challengeType || '',
      event.endpoint || '',
      event.verificationResult || '',
      event.authMethod || '',
      event.clientIP || '',
      event.country || '',
      event.errorType || '',
    ];

    const doubles: number[] = [
      event.solveTimeMs || 0,
      event.responseTimeMs || 0,
    ];

    const indexes: string[] = [
      event.eventType,
      event.challengeType || 'none',
      event.endpoint || 'unknown',
    ];

    analytics.writeDataPoint({
      blobs,
      doubles,
      indexes,
    });
  } catch (error) {
    // Never throw on analytics failures
    console.error('Analytics logging failed:', error);
  }
}

/**
 * Extract country from Cloudflare headers
 */
export function getCountry(request: Request): string {
  return request.headers.get('cf-ipcountry') || 'unknown';
}

/**
 * Extract user agent
 */
export function getUserAgent(request: Request): string {
  const ua = request.headers.get('user-agent') || 'unknown';
  // Truncate to 100 chars to avoid bloating analytics
  return ua.substring(0, 100);
}

/**
 * Helper to track challenge generation
 */
export async function trackChallengeGenerated(
  analytics: AnalyticsEngineDataset | undefined,
  challengeType: 'speed' | 'standard' | 'reasoning' | 'hybrid',
  endpoint: string,
  request: Request,
  clientIP: string,
  responseTimeMs: number
): Promise<void> {
  await logAnalyticsEvent(analytics, {
    eventType: 'challenge_generated',
    challengeType,
    endpoint,
    clientIP,
    country: getCountry(request),
    userAgent: getUserAgent(request),
    responseTimeMs,
  });
}

/**
 * Helper to track challenge verification
 */
export async function trackChallengeVerified(
  analytics: AnalyticsEngineDataset | undefined,
  challengeType: 'speed' | 'standard' | 'reasoning' | 'hybrid',
  endpoint: string,
  success: boolean,
  solveTimeMs: number | undefined,
  reason: string | undefined,
  request: Request,
  clientIP: string
): Promise<void> {
  await logAnalyticsEvent(analytics, {
    eventType: 'challenge_verified',
    challengeType,
    endpoint,
    verificationResult: success ? 'success' : 'failure',
    verificationReason: reason,
    solveTimeMs,
    clientIP,
    country: getCountry(request),
    userAgent: getUserAgent(request),
  });
}

/**
 * Helper to track authentication attempts
 */
export async function trackAuthAttempt(
  analytics: AnalyticsEngineDataset | undefined,
  authMethod: 'landing-token' | 'bearer-token',
  success: boolean,
  endpoint: string,
  request: Request,
  clientIP: string
): Promise<void> {
  await logAnalyticsEvent(analytics, {
    eventType: success ? 'auth_success' : 'auth_failure',
    authMethod,
    endpoint,
    verificationResult: success ? 'success' : 'failure',
    clientIP,
    country: getCountry(request),
    userAgent: getUserAgent(request),
  });
}

/**
 * Helper to track rate limit exceeded
 */
export async function trackRateLimitExceeded(
  analytics: AnalyticsEngineDataset | undefined,
  endpoint: string,
  request: Request,
  clientIP: string
): Promise<void> {
  await logAnalyticsEvent(analytics, {
    eventType: 'rate_limit_exceeded',
    endpoint,
    clientIP,
    country: getCountry(request),
    userAgent: getUserAgent(request),
  });
}

/**
 * Helper to track errors
 */
export async function trackError(
  analytics: AnalyticsEngineDataset | undefined,
  errorType: string,
  errorMessage: string,
  endpoint: string,
  request: Request
): Promise<void> {
  await logAnalyticsEvent(analytics, {
    eventType: 'error',
    errorType,
    errorMessage: errorMessage.substring(0, 200), // Truncate
    endpoint,
    country: getCountry(request),
  });
}
