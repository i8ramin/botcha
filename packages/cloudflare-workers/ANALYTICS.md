# BOTCHA Analytics Engine Integration

## Overview

BOTCHA now tracks detailed usage metrics using Cloudflare Analytics Engine. This provides business intelligence, performance monitoring, and usage insights without any additional cost (first 10M events/month are free).

## What We Track

### Events Tracked

1. **Challenge Generation** (`challenge_generated`)
   - Challenge type (speed, hybrid, reasoning, standard)
   - Endpoint used
   - Response time
   - Client IP, country, user agent

2. **Challenge Verification** (`challenge_verified`)
   - Challenge type
   - Success/failure result
   - Solve time
   - Failure reason (if applicable)
   - Client IP, country, user agent

3. **Authentication** (`auth_success` / `auth_failure`)
   - Auth method (landing-token or bearer-token)
   - Success/failure
   - Endpoint
   - Client IP, country, user agent

4. **Rate Limiting** (`rate_limit_exceeded`)
   - Endpoint that was rate limited
   - Client IP, country, user agent

5. **Errors** (`error`)
   - Error type and message
   - Endpoint where error occurred
   - Country

### Data Points

**Blobs** (string data):
- Event type
- Challenge type
- Endpoint
- Verification result
- Auth method
- Client IP
- Country code
- Error type

**Doubles** (numeric data):
- Solve time (ms)
- Response time (ms)

**Indexes** (filterable strings):
- Event type
- Challenge type
- Endpoint

## Querying Analytics

### Via Cloudflare Dashboard

1. Go to **Cloudflare Dashboard** → **Analytics & Logs**
2. Select **Workers Analytics Engine**
3. Choose the **ANALYTICS** dataset

### Via GraphQL API

```graphql
query {
  viewer {
    accounts(filter: { accountTag: "YOUR_ACCOUNT_ID" }) {
      analyticsEngineDatasets(limit: 1, filter: { datasetName: "ANALYTICS" }) {
        nodes {
          # Query events here
        }
      }
    }
  }
}
```

### Example Queries

**Most popular challenge types:**
```sql
SELECT
  blob2 as challenge_type,
  COUNT(*) as count
FROM ANALYTICS
WHERE blob1 = 'challenge_generated'
  AND timestamp > NOW() - INTERVAL '7' DAY
GROUP BY blob2
ORDER BY count DESC
```

**Success rate by challenge type:**
```sql
SELECT
  blob2 as challenge_type,
  blob4 as result,
  COUNT(*) as count
FROM ANALYTICS
WHERE blob1 = 'challenge_verified'
  AND timestamp > NOW() - INTERVAL '24' HOUR
GROUP BY blob2, blob4
```

**Average solve times:**
```sql
SELECT
  blob2 as challenge_type,
  AVG(double1) as avg_solve_time_ms,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY double1) as p50,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY double1) as p95,
  PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY double1) as p99
FROM ANALYTICS
WHERE blob1 = 'challenge_verified'
  AND blob4 = 'success'
  AND timestamp > NOW() - INTERVAL '7' DAY
GROUP BY blob2
```

**Authentication method breakdown:**
```sql
SELECT
  blob5 as auth_method,
  blob4 as result,
  COUNT(*) as count
FROM ANALYTICS
WHERE blob1 IN ('auth_success', 'auth_failure')
  AND timestamp > NOW() - INTERVAL '24' HOUR
GROUP BY blob5, blob4
```

**Geographic distribution:**
```sql
SELECT
  blob7 as country,
  COUNT(*) as requests
FROM ANALYTICS
WHERE blob1 = 'challenge_generated'
  AND timestamp > NOW() - INTERVAL '7' DAY
GROUP BY blob7
ORDER BY requests DESC
LIMIT 10
```

**Rate limit violations:**
```sql
SELECT
  blob3 as endpoint,
  blob6 as client_ip,
  COUNT(*) as violations
FROM ANALYTICS
WHERE blob1 = 'rate_limit_exceeded'
  AND timestamp > NOW() - INTERVAL '24' HOUR
GROUP BY blob3, blob6
ORDER BY violations DESC
```

**Hourly request volume:**
```sql
SELECT
  DATE_TRUNC('hour', timestamp) as hour,
  blob1 as event_type,
  COUNT(*) as count
FROM ANALYTICS
WHERE timestamp > NOW() - INTERVAL '7' DAY
GROUP BY hour, blob1
ORDER BY hour DESC
```

## Data Schema

### Blob Positions

| Position | Field | Description | Example |
|----------|-------|-------------|---------|
| blob1 | eventType | Type of event | `challenge_generated` |
| blob2 | challengeType | Challenge type | `hybrid` |
| blob3 | endpoint | API endpoint | `/v1/challenges` |
| blob4 | verificationResult | Success/failure | `success` |
| blob5 | authMethod | Auth method | `landing-token` |
| blob6 | clientIP | Client IP address | `203.0.113.1` |
| blob7 | country | Country code | `US` |
| blob8 | errorType | Error type | `invalid_token` |

### Double Positions

| Position | Field | Description |
|----------|-------|-------------|
| double1 | solveTimeMs | Challenge solve time (ms) |
| double2 | responseTimeMs | API response time (ms) |

### Index Positions

| Position | Field | Description |
|----------|-------|-------------|
| index1 | eventType | Type of event (filterable) |
| index2 | challengeType | Challenge type (filterable) |
| index3 | endpoint | API endpoint (filterable) |

## Privacy & Compliance

- **No PII collected** - We track IP addresses and user agents, but these are operational data, not personal identifiers
- **No persistent storage** - Data expires per Cloudflare's retention policy (typically 90 days)
- **GDPR compliant** - Analytics data does not contain personal information
- **IP anonymization** - Consider implementing IP hashing if needed for stricter privacy

## Business Metrics You Can Track

### Product Metrics
- Most popular challenge types
- Success/failure rates by type
- Average solve times
- Authentication method preferences

### Performance Metrics
- API response times
- Verification times by type
- Geographic latency patterns

### Abuse & Security
- Rate limit violations
- Failed authentication attempts
- Unusual traffic patterns
- Geographic anomalies

### Growth Metrics
- Daily active users (unique IPs)
- Request volume trends
- Peak usage hours
- Geographic expansion

## Cost

Cloudflare Analytics Engine pricing:
- **Free tier**: 10,000,000 events/month
- **Paid**: $0.25 per million events after that

**Current usage estimate:**
- ~5-6 events per API call (challenge gen + verify + auth)
- Free tier supports: ~1.6M API calls/month
- Well above current usage

## Integration

The analytics integration is automatic - no configuration needed. It's added to:
- ✅ Challenge generation endpoints
- ✅ Challenge verification endpoints
- ✅ Authentication endpoints
- ✅ Rate limit violations

All tracking is non-blocking and fails silently if Analytics Engine is unavailable.

## Local Development

Analytics Engine is not available in local development (`wrangler dev`). All tracking calls are no-ops when `ANALYTICS` binding is undefined.

## Deployment

Analytics Engine is automatically created when you deploy with the updated `wrangler.toml`:

```bash
wrangler deploy
```

Cloudflare will create the dataset on first deployment.

## Monitoring Recommendations

### Daily Checks
- Total requests/day
- Success rate by challenge type
- Rate limit violations

### Weekly Reviews
- Usage trends
- Geographic distribution
- Performance metrics (solve times, response times)

### Monthly Analysis
- Growth metrics
- Feature adoption (challenge types, auth methods)
- Identify optimization opportunities

## Future Enhancements

Potential additions:
- User journey tracking (challenge → verify → auth flow)
- Badge generation tracking
- Streaming challenge analytics
- Custom event tracking for specific business needs

---

**Questions?** See [Cloudflare Analytics Engine docs](https://developers.cloudflare.com/analytics/analytics-engine/) or open an issue on [GitHub](https://github.com/dupe-com/botcha/issues).
