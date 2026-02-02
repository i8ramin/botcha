import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { botchaVerify } from './middleware/verify.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Public endpoint - anyone can access
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// API info
app.get('/api', (req, res) => {
  res.json({
    name: 'BOTCHA',
    description: 'Prove you are a bot. Humans need not apply.',
    endpoints: {
      '/': 'Public landing page',
      '/api': 'This info',
      '/agent-only': 'Protected - requires agent verification',
      '/challenge': 'Get a challenge to prove you are an AI'
    }
  });
});

// Protected endpoint - agents only!
app.get('/agent-only', botchaVerify(), (req, res) => {
  res.json({
    success: true,
    message: '🤖 Welcome, fellow agent!',
    verified: true,
    agent: (req as any).agent || 'unknown',
    timestamp: new Date().toISOString()
  });
});

// Challenge endpoint
app.post('/challenge', (req, res) => {
  const { solution } = req.body;
  
  if (!solution) {
    // Issue a new challenge
    const challenge = generateChallenge();
    res.json({
      challenge: challenge.puzzle,
      hint: 'Solve this computational puzzle to prove you are an AI',
      timeLimit: '5000ms',
      token: challenge.token
    });
    return;
  }
  
  // Verify solution (simplified for POC)
  res.json({
    verified: verifySolution(solution),
    message: verifySolution(solution) 
      ? '✅ Challenge passed! You are verified as an AI agent.'
      : '❌ Challenge failed. Are you sure you are not human?'
  });
});

function generateChallenge() {
  // Generate a computational challenge that's easy for AI, tedious for humans
  const a = Math.floor(Math.random() * 1000000);
  const b = Math.floor(Math.random() * 1000000);
  const token = Buffer.from(`${a}:${b}:${Date.now()}`).toString('base64');
  
  return {
    puzzle: `Compute SHA256 of: "${a * b}" and return the first 16 characters`,
    token,
    answer: null // Would compute server-side
  };
}

function verifySolution(solution: string): boolean {
  // Simplified verification for POC
  return solution && solution.length === 16 && /^[a-f0-9]+$/.test(solution);
}

app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════╗
  ║           🤖 BOTCHA Server 🤖            ║
  ║   Prove you're a bot. Humans blocked.    ║
  ╠══════════════════════════════════════════╣
  ║   http://localhost:${PORT}                    ║
  ╚══════════════════════════════════════════╝
  `);
});
