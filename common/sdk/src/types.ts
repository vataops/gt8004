export interface GT8004LoggerConfig {
  agentId: string;
  apiKey: string;
  endpoint?: string;
  batchSize?: number;
  flushIntervalMs?: number;
  maxRetries?: number;
  debug?: boolean;
}

export interface RequestLogEntry {
  requestId: string;
  customerId?: string;
  toolName?: string;
  method: string;
  path: string;
  statusCode: number;
  responseMs: number;
  errorType?: string;
  x402Amount?: number;
  x402TxHash?: string;
  x402Token?: string;
  x402Payer?: string;
  requestBodySize?: number;
  responseBodySize?: number;
  timestamp: string;
}

export interface LogBatch {
  agent_id: string;
  sdk_version: string;
  batch_id: string;
  entries: RequestLogEntry[];
}
