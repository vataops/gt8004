import { AESLoggerConfig, RequestLogEntry } from './types';
import { BatchTransport } from './transport';
import { createExpressMiddleware, MiddlewareOptions } from './middleware/express';

const DEFAULT_ENDPOINT = 'https://api.aes.network';

export class AESLogger {
  private transport: BatchTransport;
  private config: Required<Pick<AESLoggerConfig, 'agentId' | 'apiKey' | 'endpoint' | 'debug'>>;

  constructor(config: AESLoggerConfig) {
    this.config = {
      agentId: config.agentId,
      apiKey: config.apiKey,
      endpoint: config.endpoint ?? DEFAULT_ENDPOINT,
      debug: config.debug ?? false,
    };

    this.transport = new BatchTransport(
      this.config.agentId,
      this.config.endpoint,
      this.config.apiKey,
      {
        batchSize: config.batchSize,
        flushIntervalMs: config.flushIntervalMs,
        maxRetries: config.maxRetries,
        debug: this.config.debug,
      }
    );
  }

  /**
   * Returns Express middleware that automatically captures request/response logs.
   */
  middleware(options?: MiddlewareOptions) {
    return createExpressMiddleware(
      (entry) => this.transport.enqueue(entry),
      options
    );
  }

  /**
   * Manually log a request entry.
   */
  logRequest(entry: RequestLogEntry): void {
    this.transport.enqueue(entry);
  }

  /**
   * Flush all pending logs.
   */
  async flush(): Promise<void> {
    await this.transport.flush();
  }

  /**
   * Gracefully close the logger, flushing remaining logs.
   */
  async close(): Promise<void> {
    await this.transport.close();
  }
}
