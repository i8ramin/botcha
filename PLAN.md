# BOTCHA POC Plan

## Goal
Build a minimal working prototype that can verify an AI agent and block human requests.

## Phase 1: Basic Server (Today)
- [ ] Express server with two endpoints:
  - `GET /` — Public landing page
  - `GET /agent-only` — Protected endpoint requiring verification
- [ ] Basic signature verification middleware
- [ ] Simple challenge-response fallback
- [ ] Response: JSON with access status

## Phase 2: Verification Logic
- [ ] Parse `Signature-Agent` header
- [ ] Fetch public key from agent's directory
- [ ] Verify HTTP message signature
- [ ] Fallback: computational challenge (e.g., hash puzzle)

## Phase 3: Demo UI
- [ ] Landing page explaining BOTCHA
- [ ] "Try to enter" button for humans (they fail)
- [ ] Agent access endpoint showing success

## Tech Stack
- **Runtime:** Node.js
- **Framework:** Express (or Hono for edge)
- **Crypto:** node:crypto for signature verification
- **Deploy:** Railway or Cloudflare Workers

## File Structure
```
botcha/
├── src/
│   ├── index.ts          # Main server
│   ├── middleware/
│   │   └── verify.ts     # BOTCHA verification
│   ├── challenges/
│   │   └── compute.ts    # Challenge-response logic
│   └── utils/
│       └── signature.ts  # Signature verification
├── public/
│   └── index.html        # Landing page
├── package.json
├── tsconfig.json
└── README.md
```

## MVP Success Criteria
1. ✅ Human visiting in browser → Blocked (or challenged)
2. ✅ Request with valid signature → Access granted
3. ✅ Request without signature → Challenge issued
4. ✅ Failed challenge → Blocked

## Let's Build! 🚀
