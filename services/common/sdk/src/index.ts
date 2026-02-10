export { GT8004Logger } from './logger';
export { GT8004Client } from './client';
export type { GT8004LoggerConfig, RequestLogEntry, LogBatch } from './types';
export type {
  GT8004ClientConfig,
  SearchParams,
  AgentInfo,
  RegisterResult,
  RegisterServiceParams,
  RegisterServiceResult,
  ServiceStatus,
  TierUpdateResult,
  LinkERC8004Params,
  LinkERC8004Result,
  TokenVerification,
} from './client';
export type { MiddlewareOptions } from './middleware/express';
