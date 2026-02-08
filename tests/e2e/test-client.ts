/**
 * AEL End-to-End Test Client
 *
 * Tests the full pipeline:
 *   Register → ERC-8004 Identity → Gateway Enable → Agent Health →
 *   Traffic via Gateway → SDK Flush → Dashboard API Verification
 *
 * Uses ethers.js for EVM wallet signing on Sepolia testnet.
 */
import { ethers } from 'ethers';

const AEL_BACKEND = process.env.AEL_BACKEND || 'http://localhost:8080';
const AGENT_PORT = process.env.AGENT_PORT || '3100';
const AGENT_ORIGIN = process.env.AGENT_ORIGIN || `http://host.docker.internal:${AGENT_PORT}`;
const AGENT_LOCAL = `http://localhost:${AGENT_PORT}`;

// Use pre-existing wallet from env (run-e2e.sh) or generate a fresh one
const wallet = process.env.WALLET_PRIVATE_KEY
  ? new ethers.Wallet(process.env.WALLET_PRIVATE_KEY)
  : ethers.Wallet.createRandom();
const AGENT_ID = process.env.AGENT_ID || wallet.address;

// If API key is pre-provisioned (from run-e2e.sh), skip registration
const PRE_API_KEY = process.env.AEL_API_KEY || '';

interface TestResult {
  step: string;
  passed: boolean;
  detail: string;
  duration: number;
}

const results: TestResult[] = [];

async function api(
  method: string,
  path: string,
  body?: unknown,
  headers?: Record<string, string>,
): Promise<{ status: number; data: any }> {
  const url = `${AEL_BACKEND}${path}`;
  const opts: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(url, opts);
  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  return { status: res.status, data };
}

async function runStep(
  name: string,
  fn: () => Promise<{ passed: boolean; detail: string }>,
): Promise<boolean> {
  const start = Date.now();
  try {
    const { passed, detail } = await fn();
    results.push({ step: name, passed, detail, duration: Date.now() - start });
    const icon = passed ? 'PASS' : 'FAIL';
    console.log(`  [${icon}] ${name} (${Date.now() - start}ms) — ${detail}`);
    return passed;
  } catch (err: any) {
    results.push({ step: name, passed: false, detail: err.message, duration: Date.now() - start });
    console.log(`  [FAIL] ${name} (${Date.now() - start}ms) — ${err.message}`);
    return false;
  }
}

async function main() {
  console.log('=== AEL E2E Test ===');
  console.log(`  Backend:  ${AEL_BACKEND}`);
  console.log(`  Agent ID: ${AGENT_ID}`);
  console.log(`  Wallet:   ${wallet.address}`);
  console.log('');

  let apiKey = PRE_API_KEY;

  // ── Step 1: Register Agent ──
  if (apiKey) {
    // Pre-registered by run-e2e.sh
    await runStep('1. Register Agent', async () => {
      return { passed: true, detail: `pre-registered, api_key=${apiKey.substring(0, 16)}...` };
    });
  } else {
    await runStep('1. Register Agent', async () => {
      const { status, data } = await api('POST', '/v1/agents/register', {
        agent_id: AGENT_ID,
        name: 'E2E Test Agent (Sepolia)',
        origin_endpoint: AGENT_ORIGIN,
        protocols: ['erc8004', 'x402'],
        category: 'ai-chat',
        pricing: { model: 'per-request', amount: '0.001', currency: 'ETH' },
      });

      if (status !== 201 || !data.api_key) {
        return { passed: false, detail: `status=${status}, body=${JSON.stringify(data)}` };
      }
      apiKey = data.api_key;
      return { passed: true, detail: `api_key=${apiKey.substring(0, 16)}...` };
    });

    if (!apiKey) {
      console.log('\nRegistration failed — cannot continue.');
      process.exit(1);
    }
  }

  const authHeaders = { Authorization: `Bearer ${apiKey}` };

  // ── Step 2: ERC-8004 Challenge → Sign → Verify ──
  await runStep('2. ERC-8004 Identity Verification', async () => {
    // 2a. Request challenge
    const { status: cs, data: challengeData } = await api('POST', '/v1/auth/challenge', {
      agent_id: AGENT_ID,
    });
    if (cs !== 200 || !challengeData.challenge) {
      return { passed: false, detail: `challenge request failed: status=${cs}` };
    }

    const challenge: string = challengeData.challenge;

    // 2b. Sign the challenge with ethers personal_sign
    // The backend expects: keccak256("\x19Ethereum Signed Message:\n32" + rawBytes)
    // ethers.signMessage(bytes) does exactly this when given raw bytes
    const challengeBytes = Buffer.from(challenge, 'hex');
    const signature = await wallet.signMessage(challengeBytes);

    // 2c. Verify
    const { status: vs, data: verifyData } = await api('POST', '/v1/auth/verify', {
      challenge,
      signature,
      agent_id: AGENT_ID,
    });

    if (vs !== 200 || !verifyData.verified) {
      return { passed: false, detail: `verify failed: status=${vs}, body=${JSON.stringify(verifyData)}` };
    }

    return {
      passed: true,
      detail: `verified=true, evm_address=${verifyData.evm_address}`,
    };
  });

  // ── Step 3: Enable Gateway ──
  await runStep('3. Enable Gateway', async () => {
    const { status, data } = await api(
      'POST',
      `/v1/agents/${AGENT_ID}/gateway/enable`,
      {},
      authHeaders,
    );
    if (status !== 200 || !data.gateway_enabled) {
      return { passed: false, detail: `status=${status}, body=${JSON.stringify(data)}` };
    }
    return { passed: true, detail: 'gateway_enabled=true' };
  });

  // ── Step 4: Agent Health Check ──
  await runStep('4. Agent Health Check', async () => {
    const res = await fetch(`${AGENT_LOCAL}/health`);
    const data = await res.json();
    if (res.status !== 200 || data.status !== 'ok') {
      return { passed: false, detail: `status=${res.status}` };
    }
    return { passed: true, detail: `agent=${data.agent}` };
  });

  // ── Step 5: Send Traffic via Gateway ──
  await runStep('5. Send Traffic via Gateway (~25 requests)', async () => {
    const customers = ['customer-alice', 'customer-bob', 'customer-charlie'];
    let sent = 0;
    let errors = 0;

    // 5a. Chat requests (10)
    for (let i = 0; i < 10; i++) {
      try {
        const cust = customers[i % customers.length];
        await api(
          'POST',
          `/gateway/${AGENT_ID}/chat`,
          { message: `E2E test message #${i}` },
          { 'x-customer-id': cust },
        );
        sent++;
      } catch {
        errors++;
      }
    }

    // 5b. Analyze requests (5)
    for (let i = 0; i < 5; i++) {
      try {
        await api(
          'POST',
          `/gateway/${AGENT_ID}/analyze`,
          { data: [1, 2, 3] },
          { 'x-customer-id': customers[i % customers.length] },
        );
        sent++;
      } catch {
        errors++;
      }
    }

    // 5c. Search requests (5)
    for (let i = 0; i < 5; i++) {
      try {
        const res = await fetch(
          `${AEL_BACKEND}/gateway/${AGENT_ID}/search?q=test-${i}`,
          { headers: { 'x-customer-id': customers[i % customers.length] } },
        );
        if (res.ok) sent++;
        else errors++;
      } catch {
        errors++;
      }
    }

    // 5d. Premium with payment header (3)
    for (let i = 0; i < 3; i++) {
      try {
        const payment = JSON.stringify({
          amount: '0.001',
          tx_hash: `0x${i.toString().padStart(64, 'a')}`,
          token: 'ETH',
          payer: `0x${(i + 1).toString().padStart(40, '0')}`,
        });
        await api(
          'POST',
          `/gateway/${AGENT_ID}/premium`,
          {},
          {
            'x-customer-id': customers[i % customers.length],
            'x-payment': payment,
          },
        );
        sent++;
      } catch {
        errors++;
      }
    }

    // 5e. Error endpoint (2)
    for (let i = 0; i < 2; i++) {
      try {
        await fetch(`${AEL_BACKEND}/gateway/${AGENT_ID}/error`);
        sent++;
      } catch {
        errors++;
      }
    }

    if (sent < 20) {
      return { passed: false, detail: `only ${sent} sent, ${errors} errors` };
    }
    return { passed: true, detail: `sent=${sent}, errors=${errors}` };
  });

  // ── Step 6: Wait for SDK Flush ──
  await runStep('6. Wait for SDK Flush (8s)', async () => {
    await new Promise(resolve => setTimeout(resolve, 8000));
    return { passed: true, detail: 'waited 8 seconds for batch flush' };
  });

  // ── Step 7: Verify Dashboard APIs ──
  await runStep('7. Verify Dashboard APIs', async () => {
    const checks: string[] = [];
    let allOk = true;

    // 7a. Overview
    const { status: os, data: overview } = await api('GET', '/v1/dashboard/overview');
    if (os === 200 && overview.total_agents >= 1) {
      checks.push(`overview: agents=${overview.total_agents}`);
    } else {
      checks.push(`overview: FAIL (status=${os})`);
      allOk = false;
    }

    // 7b. Agent stats
    const { status: ss, data: stats } = await api(
      'GET',
      `/v1/agents/${AGENT_ID}/stats`,
      undefined,
      authHeaders,
    );
    if (ss === 200) {
      checks.push(`stats: requests=${stats.total_requests ?? stats.request_count ?? 'n/a'}`);
    } else {
      checks.push(`stats: FAIL (status=${ss})`);
      allOk = false;
    }

    // 7c. Request logs
    const { status: ls, data: logsData } = await api(
      'GET',
      `/v1/agents/${AGENT_ID}/logs?limit=10`,
      undefined,
      authHeaders,
    );
    if (ls === 200 && logsData.logs && logsData.logs.length > 0) {
      checks.push(`logs: count=${logsData.logs.length}`);
    } else {
      checks.push(`logs: FAIL (status=${ls}, total=${logsData?.total ?? 0})`);
      allOk = false;
    }

    // 7d. Customers
    const { status: custS, data: custData } = await api(
      'GET',
      `/v1/agents/${AGENT_ID}/customers`,
      undefined,
      authHeaders,
    );
    if (custS === 200 && custData.customers && custData.customers.length > 0) {
      checks.push(`customers: count=${custData.customers.length}`);
    } else {
      checks.push(`customers: FAIL (status=${custS})`);
      allOk = false;
    }

    // 7e. Revenue
    const { status: rs, data: revData } = await api(
      'GET',
      `/v1/agents/${AGENT_ID}/revenue`,
      undefined,
      authHeaders,
    );
    if (rs === 200) {
      checks.push(`revenue: ok`);
    } else {
      checks.push(`revenue: FAIL (status=${rs})`);
      allOk = false;
    }

    // 7f. Performance
    const { status: ps, data: perfData } = await api(
      'GET',
      `/v1/agents/${AGENT_ID}/performance?window=1h`,
      undefined,
      authHeaders,
    );
    if (ps === 200) {
      checks.push(`performance: ok`);
    } else {
      checks.push(`performance: FAIL (status=${ps})`);
      allOk = false;
    }

    // 7g. Agent search
    const { status: searchS, data: searchData } = await api(
      'GET',
      `/v1/agents/search?category=ai-chat`,
    );
    if (searchS === 200 && searchData.agents && searchData.agents.length > 0) {
      checks.push(`search: found=${searchData.agents.length}`);
    } else {
      checks.push(`search: FAIL (status=${searchS})`);
      allOk = false;
    }

    return {
      passed: allOk,
      detail: checks.join(' | '),
    };
  });

  // ── Step 8: Summary ──
  console.log('\n=== Results ===');
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;
  console.log(`  ${passed}/${total} passed, ${failed} failed`);
  console.log(`  Total time: ${results.reduce((a, r) => a + r.duration, 0)}ms`);

  if (failed > 0) {
    console.log('\nFailed steps:');
    for (const r of results.filter(r => !r.passed)) {
      console.log(`  - ${r.step}: ${r.detail}`);
    }
    process.exit(1);
  }

  console.log('\n  ALL PASS');
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
