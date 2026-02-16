// API Gateway endpoint
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080';

// Types
export interface Ticker {
  symbol: string;
  last_price: number;
  price_change?: number;
  price_change_percent: number;
  high_24h: number;
  low_24h: number;
  volume_24h: number;
  quote_volume_24h?: number;
  turnover_24h?: number;
  mark_price: number;
  index_price?: number;
  funding_rate?: number;
  next_funding_time?: number;
  open_interest?: number;
}

export interface Kline {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Trade {
  price: number;
  amount: number;
  side: string;
  time: number;
}

export interface Position {
  id: string;
  user_id: string;
  address: string;
  symbol: string;
  side: string;
  amount: number;        // BTC size
  entry_price: number;
  collateral: number;    // USD margin
  leverage: number;
  is_open: boolean;
  created_at: string;
  closed_at?: string;
  close_price?: number;
  realized_pnl?: number;
  // On-chain UTxO reference
  tx_hash?: string;
  output_index?: number;
}

export interface PositionWithPnL extends Position {
  unrealized_pnl: number;
  pnl_percent: number;
  liquidation_price: number;
  mark_price: number;
}

export interface ClosePositionResponse {
  status: string;
  position_id: string;
  close_price: number;
  realized_pnl: number;
  pnl_percent: number;
}

export interface Order {
  id: string;
  user_id: string;
  symbol: string;
  side: string;
  type: string;
  price: number;
  amount: number;
  filled: number;
  status: string;
  time_in_force: string;
  reduce_only: boolean;
  created_at: string;
}

export interface Balance {
  asset: string;
  available: number;
  locked: number;
  total: number;
}

export interface Vault {
  id: string;
  name: string;
  address: string;
  tvl: number;
  apy: number;
  capacity: number;
  min_deposit: number;
  lock_period_days: number;
  management_fee: number;
  performance_fee: number;
  status: string;
  depositors: number;
  daily_change: number;
  weekly_change: number;
  monthly_change: number;
}

export interface VaultPerformance {
  date: string;
  value: number;
}

export interface VaultTransaction {
  id: string;
  type: string;
  amount: number;
  address: string;
  status: string;
  created_at: string;
}

export interface UserVaultInfo {
  balance: number;
  shares: number;
}

export interface User {
  id: string;
  wallet_address: string;
  created_at: string;
}

// Helper function for API calls
async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  
  const defaultHeaders: HeadersInit = {
    'Content-Type': 'application/json',
  };

  // Add user ID if available
  if (typeof window !== 'undefined') {
    const userId = localStorage.getItem('hydrox_user_id');
    if (userId) {
      (defaultHeaders as Record<string, string>)['X-User-ID'] = userId;
    }
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }

  return response.json();
}

// Market API
export const marketApi = {
  getAllMarkets: () => fetchAPI<Ticker[]>('/api/v1/markets'),
  
  getTicker: (symbol: string) => 
    fetchAPI<Ticker>(`/api/v1/markets/${symbol}/ticker`),
  
  getKlines: (symbol: string, interval: string = '1h') =>
    fetchAPI<Kline[]>(`/api/v1/markets/${symbol}/klines?interval=${interval}`),
  
  getTrades: (symbol: string) =>
    fetchAPI<Trade[]>(`/api/v1/markets/${symbol}/trades`),
};

// Trading API (now routed through Account service)
export const tradingApi = {
  // Get positions (basic)
  getPositions: (address: string) =>
    fetchAPI<Position[]>(`/api/v1/account/positions/${address}`),

  // Get positions with real-time PnL
  getPositionsWithPnL: (address: string) =>
    fetchAPI<PositionWithPnL[]>(`/api/v1/account/positions/${address}/with-pnl`),

  // Create a new position
  createPosition: (position: {
    address: string;
    symbol: string;
    side: string;
    entry_price: number;
    amount: number;
    collateral: number;
    leverage: number;
    tx_hash: string;      // On-chain UTxO reference
    output_index: number;
  }) =>
    fetchAPI<{ status: string; position_id: string; position: Position }>(
      '/api/v1/account/position',
      {
        method: 'POST',
        body: JSON.stringify(position),
      }
    ),

  // Close a position
  closePosition: (positionId: string, address: string) =>
    fetchAPI<ClosePositionResponse>(`/api/v1/account/position/${positionId}/close`, {
      method: 'POST',
      body: JSON.stringify({ address }),
    }),

  // Get position history (closed positions)
  getPositionHistory: (address: string) =>
    fetchAPI<Position[]>(`/api/v1/account/positions/${address}/history`),

  getOrders: () => fetchAPI<Order[]>('/api/v1/orders'),

  createOrder: (order: {
    symbol: string;
    side: string;
    type: string;
    price?: number;
    amount: number;
    leverage: number;
    time_in_force: string;
    reduce_only: boolean;
  }) =>
    fetchAPI<{ id: string; status: string }>('/api/v1/orders', {
      method: 'POST',
      body: JSON.stringify(order),
    }),

  cancelOrder: (orderId: string) =>
    fetchAPI<{ status: string }>(`/api/v1/orders/${orderId}`, {
      method: 'DELETE',
    }),

  getOrderHistory: () => fetchAPI<Order[]>('/api/v1/orders/history'),

  getBalances: () => fetchAPI<Balance[]>('/api/v1/balances'),
};

// Vault API
export const vaultApi = {
  getVaults: () => fetchAPI<Vault[]>('/api/v1/vaults'),
  
  getVault: (vaultId: string) => fetchAPI<Vault>(`/api/v1/vaults/${vaultId}`),
  
  getPerformance: (vaultId: string) =>
    fetchAPI<VaultPerformance[]>(`/api/v1/vaults/${vaultId}/performance`),
  
  getTransactions: (vaultId: string) =>
    fetchAPI<VaultTransaction[]>(`/api/v1/vaults/${vaultId}/transactions`),
  
  deposit: (vaultId: string, amount: number) =>
    fetchAPI<{ status: string }>(`/api/v1/vaults/${vaultId}/deposit`, {
      method: 'POST',
      body: JSON.stringify({ amount }),
    }),
  
  withdraw: (vaultId: string, amount: number) =>
    fetchAPI<{ status: string }>(`/api/v1/vaults/${vaultId}/withdraw`, {
      method: 'POST',
      body: JSON.stringify({ amount }),
    }),
  
  getUserInfo: (vaultId: string) =>
    fetchAPI<UserVaultInfo>(`/api/v1/vaults/${vaultId}/user`),
};

// User API
export const userApi = {
  connect: (walletAddress: string) =>
    fetchAPI<{ user_id: string; wallet_address: string; status: string }>(
      '/api/v1/auth/connect',
      {
        method: 'POST',
        body: JSON.stringify({ wallet_address: walletAddress }),
      }
    ),

  disconnect: () =>
    fetchAPI<{ status: string }>('/api/v1/auth/disconnect', {
      method: 'POST',
    }),

  getProfile: () => fetchAPI<User>('/api/v1/users/profile'),

  getBalances: () => fetchAPI<Balance[]>('/api/v1/users/balances'),
};

// Account API - On-chain balance queries
export const accountApi = {
  // Get all balances for a wallet address (USD, ADA, etc.)
  getBalances: (address: string) =>
    fetchAPI<Balance[]>(`/api/v1/account/balances/${address}`),

  // Get USD balance specifically
  getUSDBalance: async (address: string): Promise<number> => {
    try {
      const balances = await fetchAPI<Balance[]>(`/api/v1/account/balances/${address}`);
      const usd = balances.find(b => b.asset === 'USD');
      return usd?.available ?? 0;
    } catch (error) {
      console.error('Failed to fetch USD balance:', error);
      return 0;
    }
  },
};

// Vault Script Info - On-chain vault balance queries
export interface VaultScriptInfo {
  script_address: string;
  total_usdm: number;
  total_ada: number;
}

export const vaultScriptApi = {
  // Get USD and ADA balance at the vault script address
  getVaultInfo: () => fetchAPI<VaultScriptInfo>('/api/v1/vault/info'),
};

// Contract Config API
export interface ContractConfig {
  network: string;
  position_script_addr: string;
  vault_script_addr: string;
  usdm_policy_id: string;
  usdm_asset_name: string;
  position_script_hash?: string;
  vault_script_hash?: string;
}

let cachedConfig: ContractConfig | null = null;

export const configApi = {
  getContractConfig: async (): Promise<ContractConfig> => {
    if (cachedConfig) return cachedConfig;
    cachedConfig = await fetchAPI<ContractConfig>('/api/v1/config/contracts');
    console.log("Loaded contract config from API:", cachedConfig);
    return cachedConfig;
  },
  // Clear cache to force reload (useful after backend restart)
  clearCache: () => {
    cachedConfig = null;
  },
};

// Oracle API - Signed price feeds for on-chain verification
export interface OraclePriceFeed {
  symbol: string;      // Asset symbol (e.g., "BTC")
  price: number;       // Price scaled by 1e6 (e.g., $97000 = 97000000000)
  timestamp: number;   // POSIX seconds
  signature: string;   // Ed25519 signature in hex
}

export interface SignedPriceResponse {
  success: boolean;
  data?: OraclePriceFeed;
  error?: string;
}

export interface OraclePublicKeyResponse {
  public_key: string;  // Hex-encoded Ed25519 public key
}

// Options for oracle price request (for detailed logging)
export interface OraclePriceOptions {
  address?: string;      // Wallet address requesting the price
  action?: 'close' | 'liquidate';  // Action type
  side?: 'Long' | 'Short';         // Position side
  positionId?: string;   // Position ID being closed
}

export const oracleApi = {
  // Get the oracle's Ed25519 public key (for vault datum)
  getPublicKey: () =>
    fetchAPI<OraclePublicKeyResponse>('/api/v1/oracle/pubkey'),

  // Get a signed price feed for a symbol (for close position TX)
  // Options param adds logging context on the oracle service
  getSignedPrice: async (symbol: string, options?: OraclePriceOptions): Promise<OraclePriceFeed> => {
    // Build query params for logging on oracle service
    const params = new URLSearchParams();
    if (options?.address) params.set('address', options.address);
    if (options?.action) params.set('action', options.action);
    if (options?.side) params.set('side', options.side);
    if (options?.positionId) params.set('position_id', options.positionId);

    const queryString = params.toString();
    const url = `/api/v1/oracle/price/${symbol}${queryString ? '?' + queryString : ''}`;

    const response = await fetchAPI<SignedPriceResponse>(url);
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get signed price');
    }
    return response.data;
  },
};

// TX Builder API - Backend transaction construction
export interface BuildOpenPositionRequest {
  wallet_address: string;
  symbol: string;
  side: 'Long' | 'Short';
  entry_price: number;
  amount: number;
  collateral: number;
  leverage: number;
}

export interface BuildClosePositionRequest {
  wallet_address: string;
  position_tx_hash: string;
  position_output_index: number;
  symbol: string;
  side: 'Long' | 'Short';
}

export interface BuildDepositRequest {
  wallet_address: string;
  amount: number;
}

export interface BuildWithdrawRequest {
  wallet_address: string;
  shares: number;
}

export interface BuildTxResponse {
  success: boolean;
  tx_cbor?: string;
  tx_hash?: string;
  error?: string;
}

export interface BuildOpenPositionResponse extends BuildTxResponse {
  output_index?: number;
  fee?: number;
}

export interface BuildClosePositionResponse extends BuildTxResponse {
  oracle_price?: number;
  pnl_amount?: number;
  is_profit?: boolean;
  trader_receives?: number;
}

export interface BuildDepositResponse extends BuildTxResponse {
  shares_to_receive?: number;
  is_initial_deposit?: boolean;
}

export interface BuildWithdrawResponse extends BuildTxResponse {
  usdm_to_receive?: number;
  is_full_withdrawal?: boolean;
}

export const txBuilderApi = {
  // Build OpenPosition transaction
  buildOpenPosition: (params: BuildOpenPositionRequest) =>
    fetchAPI<BuildOpenPositionResponse>('/api/v1/tx/build/open-position', {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  // Build ClosePosition transaction
  buildClosePosition: (params: BuildClosePositionRequest) =>
    fetchAPI<BuildClosePositionResponse>('/api/v1/tx/build/close-position', {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  // Build Deposit transaction
  buildDeposit: (params: BuildDepositRequest) =>
    fetchAPI<BuildDepositResponse>('/api/v1/tx/build/deposit', {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  // Build Withdraw transaction
  buildWithdraw: (params: BuildWithdrawRequest) =>
    fetchAPI<BuildWithdrawResponse>('/api/v1/tx/build/withdraw', {
      method: 'POST',
      body: JSON.stringify(params),
    }),
};

// WebSocket connection manager
export class WSClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private listeners: Map<string, Set<(data: unknown) => void>> = new Map();
  private subscriptions: Set<string> = new Set();

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.ws = new WebSocket(`${WS_BASE}/ws`);

    this.ws.onopen = () => {
      console.log('[WS] Connected');
      this.reconnectAttempts = 0;
      // Resubscribe to all channels
      this.subscriptions.forEach(channel => {
        this.send({ method: 'SUBSCRIBE', params: [channel] });
      });
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        const channel = message.channel || message.type;
        
        if (channel && this.listeners.has(channel)) {
          this.listeners.get(channel)?.forEach(callback => {
            callback(message.data || message);
          });
        }
      } catch (e) {
        console.error('[WS] Parse error:', e);
      }
    };

    this.ws.onclose = () => {
      console.log('[WS] Disconnected');
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        setTimeout(() => this.connect(), 1000 * this.reconnectAttempts);
      }
    };

    this.ws.onerror = (error) => {
      console.error('[WS] Error:', error);
    };
  }

  disconnect() {
    this.ws?.close();
    this.ws = null;
    this.subscriptions.clear();
  }

  private send(data: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  subscribe(channel: string, callback: (data: unknown) => void) {
    if (!this.listeners.has(channel)) {
      this.listeners.set(channel, new Set());
    }
    this.listeners.get(channel)?.add(callback);
    
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.add(channel);
      this.send({ method: 'SUBSCRIBE', params: [channel] });
    }

    // Return unsubscribe function
    return () => {
      this.listeners.get(channel)?.delete(callback);
      if (this.listeners.get(channel)?.size === 0) {
        this.listeners.delete(channel);
        this.subscriptions.delete(channel);
        this.send({ method: 'UNSUBSCRIBE', params: [channel] });
      }
    };
  }
}

// Singleton WebSocket client
let wsClient: WSClient | null = null;

export function getWSClient(): WSClient {
  if (!wsClient) {
    wsClient = new WSClient();
  }
  return wsClient;
}

