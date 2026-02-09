import type { Request, Response, NextFunction } from 'express';
import type { RequestLogEntry } from '../types';

export interface MiddlewareOptions {
  extractCustomerId?: (req: Request) => string | undefined;
  extractToolName?: (req: Request) => string | undefined;
  /** Capture request/response body content. Default: false */
  captureBody?: boolean;
  /** Max body size to capture in bytes. Default: 16384 (16KB) */
  maxBodySize?: number;
}

export function createExpressMiddleware(
  onLog: (entry: RequestLogEntry) => void,
  options: MiddlewareOptions = {}
) {
  const captureBody = options.captureBody ?? false;
  const maxBodySize = options.maxBodySize ?? 16384;

  return (req: Request, res: Response, next: NextFunction): void => {
    const startTime = Date.now();
    const requestId = crypto.randomUUID();

    // Capture request body (requires body-parser / express.json())
    let requestBody: string | undefined;
    if (captureBody && req.body) {
      try {
        const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
        requestBody = raw.length > maxBodySize ? raw.slice(0, maxBodySize) : raw;
      } catch {}
    }

    // Capture response body chunks
    const responseChunks: Buffer[] = [];
    if (captureBody) {
      const originalWrite = res.write;
      res.write = function (this: Response, ...args: any[]): boolean {
        const chunk = args[0];
        if (chunk) {
          responseChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        return originalWrite.apply(this, args as any);
      } as any;
    }

    // Capture response finish
    const originalEnd = res.end;
    let statusCode = 200;

    res.end = function (this: Response, ...args: any[]): Response {
      statusCode = res.statusCode;
      const responseMs = Date.now() - startTime;

      // Capture final chunk from res.end
      let responseBody: string | undefined;
      if (captureBody) {
        const finalChunk = args[0];
        if (finalChunk && typeof finalChunk !== 'function') {
          responseChunks.push(Buffer.isBuffer(finalChunk) ? finalChunk : Buffer.from(finalChunk));
        }
        const full = Buffer.concat(responseChunks).toString('utf-8');
        responseBody = full.length > maxBodySize ? full.slice(0, maxBodySize) : full;
        if (responseBody.length === 0) responseBody = undefined;
      }

      // Extract x402 payment info from headers
      const x402Header = req.headers['x-payment'] as string | undefined;
      let x402Amount: number | undefined;
      let x402TxHash: string | undefined;
      let x402Token: string | undefined;
      let x402Payer: string | undefined;

      if (x402Header) {
        try {
          const payment = JSON.parse(x402Header);
          x402Amount = payment.amount ? parseFloat(payment.amount) : undefined;
          x402TxHash = payment.tx_hash;
          x402Token = payment.token;
          x402Payer = payment.payer;
        } catch {}
      }

      const entry: RequestLogEntry = {
        requestId,
        customerId: options.extractCustomerId?.(req) ?? (req.headers['x-agent-id'] as string),
        toolName: options.extractToolName?.(req) ?? extractToolFromPath(req.path),
        method: req.method,
        path: req.path,
        statusCode,
        responseMs,
        errorType: statusCode >= 500 ? `HTTP_${statusCode}` : undefined,
        x402Amount,
        x402TxHash,
        x402Token,
        x402Payer,
        requestBodySize: req.headers['content-length'] ? parseInt(req.headers['content-length'] as string) : undefined,
        responseBodySize: res.getHeader('content-length') ? parseInt(res.getHeader('content-length') as string) : undefined,
        requestBody,
        responseBody,
        timestamp: new Date().toISOString(),
      };

      onLog(entry);

      return originalEnd.apply(this, args as any);
    } as any;

    next();
  };
}

function extractToolFromPath(path: string): string {
  // Extract last meaningful segment from path
  // e.g., /mcp/meerkat-19/chat -> chat
  const segments = path.split('/').filter(Boolean);
  return segments[segments.length - 1] || 'unknown';
}
