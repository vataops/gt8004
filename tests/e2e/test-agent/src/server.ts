import express from 'express';
import { AELLogger } from '@ael-network/sdk';

const PORT = parseInt(process.env.AGENT_PORT || '3100');
const AGENT_ID = process.env.AGENT_ID || 'test-agent-sepolia';
const API_KEY = process.env.AEL_API_KEY || '';
const AEL_ENDPOINT = process.env.AEL_ENDPOINT || 'http://localhost:8080';

const app = express();
app.use(express.json());

const logger = new AELLogger({
  agentId: AGENT_ID,
  apiKey: API_KEY,
  endpoint: AEL_ENDPOINT,
  batchSize: 5,
  flushIntervalMs: 2000,
  debug: true,
});

app.use(logger.middleware({
  extractCustomerId: (req) => req.headers['x-customer-id'] as string | undefined,
}));

// 1. Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', agent: AGENT_ID });
});

// 2. Chat — simulates AI agent tool (50-200ms delay)
app.post('/chat', (req, res) => {
  const { message } = req.body || {};
  const delay = 50 + Math.random() * 150;
  setTimeout(() => {
    res.json({
      reply: `Echo from ${AGENT_ID}: ${message || 'hello'}`,
      model: 'test-model-v1',
      tokens: Math.floor(Math.random() * 500),
    });
  }, delay);
});

// 3. Analyze — data analysis tool
app.post('/analyze', (req, res) => {
  const delay = 100 + Math.random() * 300;
  setTimeout(() => {
    res.json({
      result: 'analysis-complete',
      score: Math.random(),
      insights: ['insight-1', 'insight-2'],
    });
  }, delay);
});

// 4. Search
app.get('/search', (req, res) => {
  const query = req.query.q || 'default';
  res.json({
    query,
    results: [
      { id: 1, title: 'Result 1', score: 0.95 },
      { id: 2, title: 'Result 2', score: 0.87 },
    ],
  });
});

// 5. Premium — simulates x402 paid endpoint
app.post('/premium', (_req, res) => {
  res.json({ result: 'premium-content', tier: 'gold' });
});

// 6. Error — generates 500 for error rate testing
app.get('/error', (_req, res) => {
  res.status(500).json({ error: 'simulated-error' });
});

// 7. Slow — latency testing
app.get('/slow', (_req, res) => {
  setTimeout(() => {
    res.json({ status: 'slow-but-ok' });
  }, 2000);
});

process.on('SIGTERM', async () => {
  await logger.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await logger.close();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`Test agent running on port ${PORT}`);
  console.log(`  AGENT_ID: ${AGENT_ID}`);
  console.log(`  AEL_ENDPOINT: ${AEL_ENDPOINT}`);
  console.log(`  API_KEY: ${API_KEY ? API_KEY.substring(0, 16) + '...' : 'NOT SET'}`);
});
