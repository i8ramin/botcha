import crypto from 'crypto';

interface SpeedChallenge {
  id: string;
  challenges: { num: number; operation: string }[];
  expectedAnswers: string[];
  issuedAt: number;
  expiresAt: number;
}

const speedChallenges = new Map<string, SpeedChallenge>();

// Cleanup expired
setInterval(() => {
  const now = Date.now();
  for (const [id, c] of speedChallenges) {
    if (c.expiresAt < now) speedChallenges.delete(id);
  }
}, 30000);

/**
 * Generate a speed challenge: 5 math problems, must solve ALL in 500ms
 * Trivial for AI, impossible for humans to copy-paste fast enough
 */
export function generateSpeedChallenge(): {
  id: string;
  challenges: { num: number; operation: string }[];
  timeLimit: number;
  instructions: string;
} {
  const id = crypto.randomUUID();
  const challenges: { num: number; operation: string }[] = [];
  const expectedAnswers: string[] = [];
  
  for (let i = 0; i < 5; i++) {
    const num = Math.floor(Math.random() * 1000000) + 100000;
    const operation = 'sha256_first8';
    challenges.push({ num, operation });
    
    const hash = crypto.createHash('sha256').update(num.toString()).digest('hex');
    expectedAnswers.push(hash.substring(0, 8));
  }
  
  const timeLimit = 500; // 500ms - impossible for human copy-paste
  
  speedChallenges.set(id, {
    id,
    challenges,
    expectedAnswers,
    issuedAt: Date.now(),
    expiresAt: Date.now() + timeLimit + 100, // tiny grace
  });
  
  return {
    id,
    challenges,
    timeLimit,
    instructions: 'Compute SHA256 of each number, return first 8 hex chars of each. Submit as array. You have 500ms.',
  };
}

export function verifySpeedChallenge(id: string, answers: string[]): {
  valid: boolean;
  reason?: string;
  solveTimeMs?: number;
} {
  const challenge = speedChallenges.get(id);
  
  if (!challenge) {
    return { valid: false, reason: 'Challenge not found or expired' };
  }
  
  const now = Date.now();
  const solveTimeMs = now - challenge.issuedAt;
  
  // Clean up
  speedChallenges.delete(id);
  
  if (now > challenge.expiresAt) {
    return { valid: false, reason: `Too slow! Took ${solveTimeMs}ms, limit was 500ms` };
  }
  
  if (!Array.isArray(answers) || answers.length !== 5) {
    return { valid: false, reason: 'Must provide exactly 5 answers as array' };
  }
  
  for (let i = 0; i < 5; i++) {
    if (answers[i]?.toLowerCase() !== challenge.expectedAnswers[i]) {
      return { valid: false, reason: `Wrong answer for challenge ${i + 1}` };
    }
  }
  
  return { valid: true, solveTimeMs };
}

export default { generateSpeedChallenge, verifySpeedChallenge };
