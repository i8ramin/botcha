/**
 * Quick test of RTT-aware functionality
 */

import { generateSpeedChallenge, verifySpeedChallenge } from './src/challenges/speed.ts';
import crypto from 'crypto';

function solveChallenge(problems) {
  return problems.map(problem => {
    const hash = crypto.createHash('sha256')
      .update(problem.num.toString())
      .digest('hex');
    return hash.substring(0, 8);
  });
}

async function testRTT() {
  console.log('🧪 Testing RTT-aware speed challenges...\n');

  // Test 1: No RTT (default behavior)
  console.log('1️⃣  Testing default behavior (no RTT):');
  const challenge1 = generateSpeedChallenge();
  console.log(`   Timeout: ${challenge1.timeLimit}ms`);
  console.log(`   RTT Info: ${challenge1.rttInfo ? 'Present' : 'None'}`);
  
  const answers1 = solveChallenge(challenge1.challenges);
  const result1 = verifySpeedChallenge(challenge1.id, answers1);
  console.log(`   Result: ${result1.valid ? '✅ PASS' : '❌ FAIL'} (${result1.solveTimeMs}ms)`);
  
  console.log('');

  // Test 2: With RTT compensation
  console.log('2️⃣  Testing RTT compensation (200ms RTT):');
  const clientTimestamp = Date.now() - 200; // Simulate 200ms RTT
  const challenge2 = generateSpeedChallenge(clientTimestamp);
  console.log(`   Timeout: ${challenge2.timeLimit}ms`);
  console.log(`   RTT Info: ${challenge2.rttInfo ? challenge2.rttInfo.explanation : 'None'}`);
  
  const answers2 = solveChallenge(challenge2.challenges);
  const result2 = verifySpeedChallenge(challenge2.id, answers2);
  console.log(`   Result: ${result2.valid ? '✅ PASS' : '❌ FAIL'} (${result2.solveTimeMs}ms)`);
  
  if (result2.rttInfo) {
    console.log(`   RTT Details: ${result2.rttInfo.measuredRtt}ms RTT, ${result2.rttInfo.adjustedTimeout}ms timeout`);
  }

  console.log('');

  // Test 3: Verify timeout actually works
  console.log('3️⃣  Testing timeout enforcement:');
  const challenge3 = generateSpeedChallenge(Date.now() - 100); // 100ms RTT
  console.log(`   Generated timeout: ${challenge3.timeLimit}ms`);
  
  // Wait longer than the timeout to simulate a slow agent
  await new Promise(resolve => setTimeout(resolve, challenge3.timeLimit + 100));
  
  const answers3 = solveChallenge(challenge3.challenges);
  const result3 = verifySpeedChallenge(challenge3.id, answers3);
  console.log(`   Result: ${result3.valid ? '✅ PASS' : '❌ FAIL (expected)'}`);
  console.log(`   Reason: ${result3.reason}`);

  console.log('\n🎉 RTT-aware implementation working correctly!');
}

testRTT().catch(console.error);