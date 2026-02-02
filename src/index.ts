import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { botchaVerify } from './middleware/verify.js';
import { generateChallenge, verifyChallenge } from './challenges/compute.js';
import { TRUSTED_PROVIDERS } from './utils/signature.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// CORS for API access
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, X-Agent-Identity, X-Botcha-Challenge-Id, X-Botcha-Solution, Signature-Agent, Signature, Signature-Input');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Public endpoint - landing page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// API info
app.get('/api', (req, res) => {
  res.json({
    name: 'BOTCHA',
    version: '0.2.0',
    description: 'Prove you are a bot. Humans need not apply.',
    endpoints: {
      '/': 'Public landing page',
      '/api': 'This info',
      '/api/challenge': 'GET a new challenge, POST to verify',
      '/agent-only': 'Protected endpoint - requires agent verification',
    },
    verification: {
      methods: [
        'Web Bot Auth (Signature-Agent header with cryptographic signature)',
        'Challenge-Response (solve computational puzzle)',
        'X-Agent-Identity header (simple, for testing)',
      ],
      trustedProviders: TRUSTED_PROVIDERS,
    },
  });
});

// Challenge endpoint - GET new challenge, POST to verify
app.get('/api/challenge', (req, res) => {
  const difficulty = (req.query.difficulty as 'easy' | 'medium' | 'hard') || 'medium';
  const challenge = generateChallenge(difficulty);
  
  res.json({
    success: true,
    challenge: {
      id: challenge.id,
      puzzle: challenge.puzzle,
      timeLimit: challenge.timeLimit,
      hint: challenge.hint,
      difficulty,
    },
    instructions: {
      solve: 'Compute the answer to the puzzle',
      submit: 'POST to /api/challenge with { id, answer }',
      useInRequest: 'Or include X-Botcha-Challenge-Id and X-Botcha-Solution headers in your /agent-only request',
    },
  });
});

app.post('/api/challenge', (req, res) => {
  const { id, answer } = req.body;
  
  if (!id || !answer) {
    return res.status(400).json({
      success: false,
      error: 'Missing id or answer in request body',
    });
  }
  
  const result = verifyChallenge(id, answer);
  
  res.json({
    success: result.valid,
    message: result.valid 
      ? `✅ Challenge passed! Solved in ~${result.timeMs}ms. You are verified as an AI agent.`
      : `❌ ${result.reason}`,
    ...(result.valid && { solveTime: result.timeMs }),
  });
});

// Protected endpoint - agents only!
app.get('/agent-only', botchaVerify(), (req, res) => {
  res.json({
    success: true,
    message: '🤖 Welcome, fellow agent!',
    verified: true,
    agent: (req as any).agent || 'unknown',
    method: (req as any).verificationMethod,
    provider: (req as any).provider,
    timestamp: new Date().toISOString(),
    secret: 'The humans will never see this message. 🤫',
  });
});

// Protected endpoint with different difficulty
app.get('/agent-only/secure', botchaVerify({ challengeDifficulty: 'hard' }), (req, res) => {
  res.json({
    success: true,
    message: '🔐 Welcome to the high-security zone!',
    verified: true,
    agent: (req as any).agent,
    securityLevel: 'high',
  });
});

app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════════════════════════╗
  ║                    🤖 BOTCHA Server 🤖                       ║
  ║          Prove you're a bot. Humans need not apply.          ║
  ╠══════════════════════════════════════════════════════════════╣
  ║   Local:   http://localhost:${PORT}                              ║
  ║   API:     http://localhost:${PORT}/api                          ║
  ║   Secure:  http://localhost:${PORT}/agent-only                   ║
  ╚══════════════════════════════════════════════════════════════╝
  `);
});

export default app;
