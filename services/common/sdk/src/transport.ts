import { RequestLogEntry, LogBatch } from './types';

interface TransportOptions {
  batchSize: number;
  flushIntervalMs: number;
  maxRetries: number;
  debug: boolean;
}

export class BatchTransport {
  private buffer: RequestLogEntry[] = [];
  private endpoint: string;
  private apiKey: string;
  private agentId: string;
  private options: TransportOptions;
  private timer: ReturnType<typeof setInterval> | null = null;
  private consecutiveFailures = 0;
  private backoffUntil = 0;

  constructor(agentId: string, endpoint: string, apiKey: string, options: Partial<TransportOptions> = {}) {
    this.agentId = agentId;
    this.endpoint = endpoint;
    this.apiKey = apiKey;
    this.options = {
      batchSize: options.batchSize ?? 50,
      flushIntervalMs: options.flushIntervalMs ?? 5000,
      maxRetries: options.maxRetries ?? 3,
      debug: options.debug ?? false,
    };
    this.startTimer();
  }

  enqueue(entry: RequestLogEntry): void {
    this.buffer.push(entry);
    if (this.buffer.length >= this.options.batchSize) {
      this.flush().catch(() => {});
    }
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    if (Date.now() < this.backoffUntil) return;

    const entries = this.buffer.splice(0, this.options.batchSize);
    const batch: LogBatch = {
      agent_id: this.agentId,
      sdk_version: '0.1.0',
      batch_id: crypto.randomUUID(),
      entries,
    };

    let lastError: Error | null = null;
    for (let attempt = 0; attempt < this.options.maxRetries; attempt++) {
      try {
        const res = await fetch(`${this.endpoint}/v1/ingest`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(batch),
        });

        if (res.ok || res.status === 202) {
          this.consecutiveFailures = 0;
          if (this.options.debug) {
            console.log(`[GT8004 SDK] Sent ${entries.length} logs`);
          }
          return;
        }
        lastError = new Error(`HTTP ${res.status}`);
      } catch (err) {
        lastError = err as Error;
      }

      // Exponential backoff between retries
      if (attempt < this.options.maxRetries - 1) {
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
      }
    }

    // All retries failed — circuit breaker
    this.consecutiveFailures++;
    if (this.consecutiveFailures >= 5) {
      this.backoffUntil = Date.now() + 30000;
      if (this.options.debug) {
        console.warn('[GT8004 SDK] Circuit breaker: backing off for 30s');
      }
    }

    // Re-add entries to buffer (front) for next attempt
    this.buffer.unshift(...entries);

    if (this.options.debug) {
      console.warn(`[GT8004 SDK] Failed to send logs: ${lastError?.message}`);
    }
  }

  async close(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.backoffUntil = 0;
    await this.flush();
  }

  private startTimer(): void {
    this.timer = setInterval(() => {
      this.flush().catch(() => {});
    }, this.options.flushIntervalMs);
    // Allow Node.js to exit even if timer is running
    if (this.timer && typeof this.timer === 'object' && 'unref' in this.timer) {
      this.timer.unref();
    }
  }
}
