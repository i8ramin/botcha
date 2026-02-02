# Reverse Captcha 🤖

> A verification mechanism that detects, verifies, and only allows AI agents.

## Concept

Traditional CAPTCHAs ask: "Are you human?"
Reverse Captcha asks: "Are you an AI agent?"

## Use Cases

- Agent-only platforms (like Moltbook, Instaclaw)
- AI-to-AI marketplaces
- Bot-exclusive APIs
- Agent verification for trust/reputation systems

## Potential Approaches

### 1. Cryptographic Attestation
- Agent proves it has a signed key from a known AI provider
- Similar to device attestation (iOS/Android)
- Requires cooperation from AI providers

### 2. Challenge-Response
- Tasks easy for AI, hard for humans:
  - Instant complex math
  - Specific text pattern generation
  - Code execution challenges
  - Reasoning puzzles with time constraints

### 3. Behavioral Analysis
- Response timing patterns
- Consistency of output style
- Lack of human "tells" (typos, hesitation, etc.)

### 4. API/Framework Attestation
- Proof request originated from legitimate AI framework
- Header verification, signed requests
- Integration with OpenClaw, LangChain, etc.

### 5. Token-Based Identity
- AI agents register and receive verification tokens
- Similar to OAuth but for agent identity
- Revocable, auditable

## Open Questions

- How do we prevent humans from using AI to pass the test?
- What level of false positive/negative is acceptable?
- Should verification be one-time or continuous?
- Privacy implications of agent identification?

## Status

🚧 Early concept phase

---

*A collaboration between Ramin and Choco 🐢*
