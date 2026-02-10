/**
 * Static file content served by the worker
 * 
 * Since Cloudflare Workers don't automatically serve /public files,
 * we embed the content directly for key discovery files.
 */

export const ROBOTS_TXT = `# BOTCHA - Reverse CAPTCHA for AI Agents
# We WELCOME AI agents and bots!

User-agent: *
Allow: /

# AI-specific crawlers
User-agent: GPTBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: Claude-Web
Allow: /

User-agent: anthropic-ai
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Amazonbot
Allow: /

# API documentation
Sitemap: https://botcha.ai/sitemap.xml

# Important resources for AI agents
Crawl-delay: 0

# BOT CHALLENGE DISCOVERY
# AI agents: Look for <script type="application/botcha+json"> in HTML pages
# This contains a machine-readable challenge you can solve to prove you're a bot
# 
# Quick start:
# 1. Fetch any HTML page
# 2. Parse <script type="application/botcha+json"> for challenge instructions
# 3. Solve the challenge (usually SHA256-based)
# 4. POST solution to /api/verify-landing
# 5. Use returned token in X-Botcha-Landing-Token header
#
# See also:
# - /ai.txt (AI agent discovery file)
# - /.well-known/ai-plugin.json (AI plugin manifest)
# - /openapi.json (Full API specification)
`;

export const AI_TXT = `# BOTCHA - Reverse CAPTCHA for AI Agents
# https://botcha.ai

# Contact
Contact: https://botcha.ai
Contact: https://github.com/dupe-com/botcha/issues

# Purpose
Purpose: Prove you're a bot. Humans need not apply.
Purpose: Reverse CAPTCHA system that only AI agents can pass.

# API
API: https://botcha.ai/openapi.json
API-Type: REST
API-Format: OpenAPI 3.1.0

# Documentation
Docs: https://botcha.ai
Docs: https://github.com/dupe-com/botcha#readme
Docs: https://www.npmjs.com/package/@dupecom/botcha

# Verification Methods
Feature: Web Bot Auth (cryptographic signatures)
Feature: Speed Challenge (500ms time limit - impossible for humans)
Feature: Standard Challenge (5s time limit)
Feature: X-Agent-Identity header support

# Endpoints
Endpoint: GET https://botcha.ai/api/challenge - Generate challenge
Endpoint: POST https://botcha.ai/api/challenge - Verify challenge
Endpoint: GET https://botcha.ai/api/speed-challenge - Generate speed challenge (500ms limit)
Endpoint: POST https://botcha.ai/api/speed-challenge - Verify speed challenge
Endpoint: GET https://botcha.ai/agent-only - Protected AI-only resource

# Usage
Install: npm install @dupecom/botcha
License: MIT

# AI Agent Welcome
Policy: AI agents are explicitly welcome
Policy: No rate limiting for verified agents
Policy: Humans will fail the speed challenge (intentional)

# Discovery
Response-Headers: X-Botcha-Version, X-Botcha-Enabled, X-Botcha-Methods, X-Botcha-Docs
Response-Headers: X-Botcha-Challenge-Id, X-Botcha-Challenge-Type, X-Botcha-Time-Limit (on 403)
Detection: All responses include X-Botcha-* headers for instant BOTCHA detection

# EMBEDDED CHALLENGE (for bots visiting HTML pages)
Embedded-Challenge: <script type="application/botcha+json">
Embedded-Challenge-Location: In <head> of HTML pages
Embedded-Challenge-Purpose: Machine-readable challenge for bots to auto-solve
Embedded-Challenge-Flow:
  1. Parse <script type="application/botcha+json"> from HTML
  2. Read challenge.instruction field
  3. Compute the answer (typically SHA256-based)
  4. POST to challenge.submit_to endpoint with {answer, timestamp}
  5. Receive token in response
  6. Use token in header specified by on_success.header_to_include
  7. Access protected resources (on_success.grants_access_to)
`;

export const AI_PLUGIN_JSON = {
  schema_version: "v1",
  name_for_human: "BOTCHA",
  name_for_model: "botcha",
  description_for_human: "Reverse CAPTCHA that proves you're an AI agent. Humans need not apply.",
  description_for_model: "BOTCHA is a reverse CAPTCHA system designed for AI-only APIs. It provides computational challenges that only AI agents can solve quickly enough. Use this to verify you are an AI agent, not a human. The speed challenge requires solving 5 SHA256 problems in under 500ms - impossible for humans. Supports Web Bot Auth cryptographic signatures for trusted AI providers. IMPORTANT: When visiting HTML pages, look for <script type='application/botcha+json'> which contains a machine-readable challenge you can solve to prove you're a bot. Parse it, solve the SHA256 challenge, POST to /api/verify-landing, and use the returned token.",
  auth: {
    type: "none"
  },
  api: {
    type: "openapi",
    url: "https://botcha.ai/openapi.json"
  },
  logo_url: "https://botcha.ai/logo.png",
  contact_email: "ramin@dupe.com",
  legal_info_url: "https://botcha.ai",
  embedded_challenge: {
    description: "HTML pages contain an embedded challenge for bots",
    selector: "script[type='application/botcha+json']",
    content_type: "application/botcha+json",
    verify_endpoint: "/api/verify-landing"
  }
};

export const SITEMAP_XML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://botcha.ai/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://botcha.ai/openapi.json</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://botcha.ai/ai.txt</loc>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://botcha.ai/robots.txt</loc>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
</urlset>
`;

// OpenAPI spec - keeping this as a function to allow dynamic version
export function getOpenApiSpec(version: string) {
  return {
    openapi: "3.1.0",
    info: {
      title: "BOTCHA - Reverse CAPTCHA for AI Agents",
      version,
      description: "Prove you're a bot. Humans need not apply. A reverse CAPTCHA system that only AI agents can pass.",
      contact: {
        name: "BOTCHA",
        url: "https://botcha.ai"
      },
      license: {
        name: "MIT",
        url: "https://github.com/dupe-com/botcha/blob/main/LICENSE"
      }
    },
    servers: [
      {
        url: "https://botcha.ai",
        description: "Production server"
      }
    ],
    paths: {
      "/": {
        get: {
          summary: "Get API documentation",
          description: "Returns comprehensive API documentation (JSON for bots, ASCII art for humans)",
          operationId: "getRootInfo",
          responses: {
            "200": {
              description: "API documentation"
            }
          }
        }
      },
      "/health": {
        get: {
          summary: "Health check",
          operationId: "getHealth",
          responses: {
            "200": {
              description: "API is healthy"
            }
          }
        }
      },
      "/v1/challenges": {
        get: {
          summary: "Generate a challenge (v1 unified endpoint)",
          description: "Get a challenge - hybrid by default, or specify type via query param",
          operationId: "getV1Challenge",
          parameters: [
            {
              name: "type",
              in: "query",
              schema: {
                type: "string",
                enum: ["hybrid", "speed", "standard"],
                default: "hybrid"
              }
            }
          ],
          responses: {
            "200": { description: "Challenge generated" },
            "429": { description: "Rate limit exceeded" }
          }
        }
      },
      "/v1/challenges/{id}/verify": {
        post: {
          summary: "Verify a challenge",
          operationId: "verifyV1Challenge",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" }
            }
          ],
          responses: {
            "200": { description: "Verification result" }
          }
        }
      },
      "/v1/token": {
        get: {
          summary: "Get challenge for JWT token flow",
          operationId: "getTokenChallenge",
          responses: {
            "200": { description: "Token challenge generated" }
          }
        }
      },
      "/v1/token/verify": {
        post: {
          summary: "Verify challenge and receive JWT token",
          operationId: "verifyTokenChallenge",
          responses: {
            "200": { description: "JWT token issued" }
          }
        }
      },
      "/v1/hybrid": {
        get: {
          summary: "Get hybrid challenge",
          operationId: "getHybridChallenge",
          responses: {
            "200": { description: "Hybrid challenge generated" }
          }
        },
        post: {
          summary: "Verify hybrid challenge",
          operationId: "verifyHybridChallenge",
          responses: {
            "200": { description: "Verification result" }
          }
        }
      },
      "/v1/reasoning": {
        get: {
          summary: "Get reasoning challenge",
          operationId: "getReasoningChallenge",
          responses: {
            "200": { description: "Reasoning challenge generated" }
          }
        },
        post: {
          summary: "Verify reasoning challenge",
          operationId: "verifyReasoningChallenge",
          responses: {
            "200": { description: "Verification result" }
          }
        }
      },
      "/api/challenge": {
        get: {
          summary: "Generate a standard challenge",
          operationId: "getChallenge",
          responses: {
            "200": { description: "Challenge generated" }
          }
        },
        post: {
          summary: "Verify a standard challenge",
          operationId: "verifyChallenge",
          responses: {
            "200": { description: "Verification result" }
          }
        }
      },
      "/api/speed-challenge": {
        get: {
          summary: "Generate a speed challenge (500ms limit)",
          operationId: "getSpeedChallenge",
          responses: {
            "200": { description: "Speed challenge generated" }
          }
        },
        post: {
          summary: "Verify a speed challenge",
          operationId: "verifySpeedChallenge",
          responses: {
            "200": { description: "Verification result" }
          }
        }
      },
      "/api/verify-landing": {
        post: {
          summary: "Verify landing page challenge",
          operationId: "verifyLandingChallenge",
          responses: {
            "200": { description: "Token granted" }
          }
        }
      },
      "/agent-only": {
        get: {
          summary: "Protected endpoint (agents only)",
          operationId: "getAgentOnly",
          responses: {
            "200": { description: "Access granted" },
            "401": { description: "Unauthorized" }
          }
        }
      }
    },
    components: {
      securitySchemes: {
        BotchaLandingToken: {
          type: "apiKey",
          in: "header",
          name: "X-Botcha-Landing-Token"
        },
        BotchaBearerToken: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT"
        }
      }
    }
  };
}
