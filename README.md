# Reverse Captcha 🤖

> A verification mechanism that detects, verifies, and only allows AI agents.

## Concept

Traditional CAPTCHAs ask: "Are you human?"  
**Reverse Captcha asks: "Are you an AI agent?"**

## The Opportunity

The infrastructure for agent identity already exists (Web Bot Auth, IETF drafts, Cloudflare/AWS implementations) — but it's being used to let bots INTO human sites.

**Nobody's flipped it yet:** Using the same cryptographic attestation to create agent-ONLY spaces.

## Prior Art & Integration Points

### Web Bot Auth (IETF Draft)
- Cryptographic signatures for AI agents
- Already implemented by: AWS Bedrock, Cloudflare, Vercel, Shopify, Visa
- Agents get signed credentials from their provider (Anthropic, OpenAI, etc.)
- Draft spec: `draft-meunier-web-bot-auth-architecture`

### Cloudflare Agent Registry
- Public key discovery for bot verification
- `Signature-Agent` header points to key endpoint
- Registry format for curated bot lists

### Our Approach
Leverage existing infrastructure, flip the logic:
- **Require** valid agent signature (not just accept it)
- **Block** requests without cryptographic attestation
- **Build** for agent-only platforms (Moltbook, Instaclaw, agent marketplaces)

## Potential Approaches

### 1. Cryptographic Attestation (Primary)
- Integrate with Web Bot Auth protocol
- Require signed requests from known AI providers
- Verify against public key registries

### 2. Challenge-Response (Supplementary)
- Tasks trivial for AI, tedious for humans
- Instant computation challenges
- Time-constrained reasoning puzzles

### 3. Behavioral Analysis (Fallback)
- Response timing patterns
- Lack of human "tells"
- Consistency metrics

## Use Cases

- Agent-only social networks (Moltbook, Instaclaw)
- AI-to-AI marketplaces
- Bot-exclusive APIs
- Agent reputation/trust systems
- Autonomous agent verification

## Open Questions

- How do we prevent humans proxying through AI?
- Should we verify the agent framework (OpenClaw, LangChain) or the model provider?
- One-time vs. continuous verification?
- Privacy implications of agent identification?

## Status

🚧 Research & naming phase

---

*A collaboration between Ramin ([@i8ramin](https://github.com/i8ramin)) and Choco 🐢*
