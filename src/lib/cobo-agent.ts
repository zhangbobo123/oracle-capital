import { readFile } from "node:fs/promises";

type HttpMethod = "GET" | "POST";

type EndpointDescriptor = {
  path: string;
  method?: HttpMethod;
};

type CoboApiError = Error & { status?: number };

export type CoboAgentConfig = {
  name?: string;
  baseUrl: string;
  apiKey?: string;
  walletId?: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
  endpoints?: {
    connect?: EndpointDescriptor;
    balance?: EndpointDescriptor;
    authorize?: EndpointDescriptor;
    execute?: EndpointDescriptor;
  };
};

type CoboInput = Partial<CoboAgentConfig> & { endpoints?: Record<string, unknown> };

export type WalletBalance = {
  chain: string;
  symbol: string;
  balance: number;
};

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "");
}

function normalizePath(path: string) {
  return path.startsWith("/") ? path : `/${path}`;
}

function endpoint(config: CoboAgentConfig, name: keyof NonNullable<CoboAgentConfig["endpoints"]>, fallback: EndpointDescriptor): EndpointDescriptor {
  return config.endpoints?.[name] ?? fallback;
}

function buildUrl(config: CoboAgentConfig, descriptor: EndpointDescriptor) {
  return `${normalizeBaseUrl(config.baseUrl)}${normalizePath(descriptor.path)}`;
}

function authHeaders(config: CoboAgentConfig) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(config.headers ?? {}),
  };
  if (config.apiKey && !headers.Authorization) {
    headers.Authorization = `Bearer ${config.apiKey}`;
  }
  if (config.apiKey && !headers["X-API-Key"]) {
    headers["X-API-Key"] = config.apiKey;
  }
  return headers;
}

function timeoutFor(config: CoboAgentConfig) {
  return Math.min(Math.max(config.timeoutMs ?? 12_000, 1_000), 45_000);
}

function isAgenticWalletHost(config: CoboAgentConfig) {
  return /api\.agenticwallet\.cobo\.com/i.test(config.baseUrl);
}

function enrichError(error: unknown, status?: number): CoboApiError {
  const base = (error instanceof Error ? error : new Error(String(error))) as CoboApiError;
  if (status !== undefined) base.status = status;
  return base;
}

async function callAgent<T>(
  config: CoboAgentConfig,
  descriptor: EndpointDescriptor,
  payload: Record<string, unknown>,
) {
  const method = descriptor.method ?? "POST";
  const url = new URL(buildUrl(config, descriptor));
  if (method === "GET") {
    for (const [key, value] of Object.entries(payload)) {
      if (value === undefined || value === null || value === "") continue;
      url.searchParams.set(key, String(value));
    }
  }
  const response = await fetch(url, {
    method,
    headers: authHeaders(config),
    body: method === "GET" ? undefined : JSON.stringify(payload),
    signal: AbortSignal.timeout(timeoutFor(config)),
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw enrichError(new Error(detail || `Cobo agent returned ${response.status}`), response.status);
  }
  return response.json() as Promise<T>;
}

async function callAgentWithFallback<T>(
  config: CoboAgentConfig,
  descriptors: EndpointDescriptor[],
  payload: Record<string, unknown>,
) {
  let lastError: CoboApiError | null = null;
  for (const descriptor of descriptors) {
    try {
      return await callAgent<T>(config, descriptor, payload);
    } catch (error) {
      lastError = enrichError(error);
      const status = lastError.status;
      const retryable = status === 404 || status === 405 || status === 400;
      if (!retryable) break;
    }
  }
  throw (lastError ?? enrichError(new Error("Cobo agent request failed")));
}

function toNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

export function normalizeBalances(payload: unknown): WalletBalance[] {
  if (!payload || typeof payload !== "object") return [];
  const data = payload as Record<string, unknown>;
  if (Array.isArray(data.result)) {
    return data.result.map((item) => {
      const row = item as Record<string, unknown>;
      const tokenId = String(row.token_id ?? row.symbol ?? "UNKNOWN");
      const symbol = tokenId.includes("_") ? tokenId.split("_").pop() ?? tokenId : tokenId;
      return {
        chain: String(row.chain_id ?? row.chain ?? "Cobo"),
        symbol,
        balance: toNumber(row.amount ?? row.balance ?? row.total),
      };
    });
  }
  if (Array.isArray(data.balances)) {
    return data.balances.map((item) => {
      const row = item as Record<string, unknown>;
      return {
        chain: String(row.chain ?? "Cobo"),
        symbol: String(row.symbol ?? "UNKNOWN"),
        balance: toNumber(row.balance),
      };
    });
  }
  if (data.balance !== undefined) {
    return [{
      chain: String(data.chain ?? "Cobo"),
      symbol: String(data.symbol ?? "USDC"),
      balance: toNumber(data.balance),
    }];
  }
  return [];
}

export async function loadCoboConfig(configPath: string) {
  if (!configPath.trim()) throw new Error("Config path is required");
  const raw = await readFile(configPath, "utf8");
  const parsed = JSON.parse(raw) as CoboInput;
  return normalizeCoboConfig(parsed);
}

export function normalizeCoboConfig(input: CoboInput): CoboAgentConfig {
  const baseUrl = String(input.baseUrl ?? "").trim();
  if (!baseUrl) throw new Error("Config missing baseUrl");
  const normalized: CoboAgentConfig = {
    name: typeof input.name === "string" ? input.name : undefined,
    baseUrl,
    apiKey: typeof input.apiKey === "string" ? input.apiKey : undefined,
    walletId: typeof input.walletId === "string" ? input.walletId : undefined,
    headers: input.headers && typeof input.headers === "object" ? input.headers as Record<string, string> : undefined,
    timeoutMs: typeof input.timeoutMs === "number" ? input.timeoutMs : undefined,
    endpoints: {},
  };
  const endpointMap = input.endpoints && typeof input.endpoints === "object" ? input.endpoints : {};
  (["connect", "balance", "authorize", "execute"] as const).forEach((key) => {
    const candidate = endpointMap[key] as Record<string, unknown> | undefined;
    if (!candidate) return;
    const path = typeof candidate.path === "string" ? candidate.path.trim() : "";
    if (!path) return;
    const method = candidate.method === "GET" ? "GET" : "POST";
    normalized.endpoints = {
      ...normalized.endpoints,
      [key]: { path, method },
    };
  });
  if (!Object.keys(normalized.endpoints ?? {}).length) {
    delete normalized.endpoints;
  }
  return normalized;
}

export async function connectCobo(config: CoboAgentConfig) {
  const descriptors = config.endpoints?.connect
    ? [config.endpoints.connect]
    : [{ path: "/health", method: "GET" as const }, { path: "/api/v1/ping", method: "GET" as const }];
  const payload = await callAgentWithFallback<Record<string, unknown>>(config, descriptors, { walletId: config.walletId });
  return {
    connected: true,
    endpoint: normalizeBaseUrl(config.baseUrl),
    walletId: config.walletId ?? String(payload.walletId ?? payload.accountId ?? "cobo-agent"),
    message: String(payload.message ?? "Connected to Cobo agent"),
    raw: payload,
  };
}

export async function getCoboBalances(config: CoboAgentConfig) {
  if (isAgenticWalletHost(config) && !config.walletId) {
    throw new Error("Wallet ID is required for Cobo Agentic Wallet balance queries");
  }
  const descriptor = endpoint(config, "balance", { path: "/api/v1/wallets/balances", method: "GET" });
  const payload = await callAgent<Record<string, unknown>>(config, descriptor, {
    wallet_uuid: config.walletId,
    limit: 100,
  });
  return {
    balances: normalizeBalances(payload),
    raw: payload,
  };
}

function toTokenId(symbolLike: unknown, chainIdLike: unknown) {
  const chain = String(chainIdLike ?? "SETH").toUpperCase();
  const symbol = String(symbolLike ?? "USDC").toUpperCase();
  if (symbol === "USDC") return `${chain}_USDC`;
  if (symbol === "USDT") return `${chain}_USDT`;
  if (symbol === "ETH" && chain === "SETH") return "SETH";
  if (symbol === "BTC" && chain.includes("BTC")) return chain;
  return symbol.includes("_") ? symbol : `${chain}_${symbol}`;
}

function mapTransferPayload(operation: Record<string, unknown>, walletId: string, requestId?: string) {
  const chainId = String(operation.chain_id ?? operation.chainId ?? "SETH");
  const amountRaw = operation.amount ?? operation.value;
  const amount = typeof amountRaw === "string" ? amountRaw : String(amountRaw ?? "");
  const destination = String(operation.dst_addr ?? operation.to ?? operation.destination ?? "");
  if (!amount || amount === "undefined") throw new Error("Transfer requires amount");
  if (!destination) throw new Error("Transfer requires destination address");
  return {
    wallet_uuid: walletId,
    chain_id: chainId,
    token_id: String(operation.token_id ?? operation.tokenId ?? toTokenId(operation.symbol, chainId)),
    amount,
    dst_addr: destination,
    memo: operation.memo ? String(operation.memo) : undefined,
    request_id: requestId || (operation.request_id ? String(operation.request_id) : undefined),
  };
}

export async function authorizeCoboOperation(config: CoboAgentConfig, operation: Record<string, unknown>) {
  const descriptor = endpoint(config, "authorize", { path: "/authorize", method: "POST" });
  try {
    const payload = await callAgent<Record<string, unknown>>(config, descriptor, {
      walletId: config.walletId,
      operation,
    });
    return {
      authorized: payload.authorized !== false,
      requestId: String(payload.requestId ?? payload.id ?? ""),
      message: String(payload.message ?? "Authorization prepared"),
      raw: payload,
    };
  } catch (error) {
    const resolved = enrichError(error);
    if (isAgenticWalletHost(config) && (resolved.status === 404 || resolved.status === 405 || resolved.status === 400)) {
      return {
        authorized: true,
        requestId: String(operation.request_id ?? ""),
        message: "Cobo Agentic Wallet 将在执行阶段触发策略与审批流程，已允许继续执行。",
        raw: {},
      };
    }
    throw resolved;
  }
}

export async function executeCoboOperation(
  config: CoboAgentConfig,
  operation: Record<string, unknown>,
  requestId?: string,
) {
  const action = String(operation.action ?? operation.type ?? "transfer").toLowerCase();
  const configured = config.endpoints?.execute;
  let payload: Record<string, unknown>;
  if (configured) {
    payload = await callAgent<Record<string, unknown>>(config, configured, {
      walletId: config.walletId,
      requestId,
      operation,
    });
  } else if (isAgenticWalletHost(config)) {
    if (!config.walletId) throw new Error("Wallet ID is required for Cobo Agentic Wallet execution");
    if (action.includes("transfer")) {
      payload = await callAgentWithFallback<Record<string, unknown>>(
        config,
        [
          { path: `/api/v1/wallets/${config.walletId}/transfer`, method: "POST" },
          { path: "/execute", method: "POST" },
        ],
        mapTransferPayload(operation, config.walletId, requestId),
      );
    } else if (action.includes("contract")) {
      payload = await callAgent<Record<string, unknown>>(
        config,
        { path: `/api/v1/wallets/${config.walletId}/contract-call`, method: "POST" },
        {
          wallet_uuid: config.walletId,
          ...operation,
          request_id: requestId || (operation["request_id"] ? String(operation["request_id"]) : undefined),
        },
      );
    } else {
      payload = await callAgent<Record<string, unknown>>(config, { path: "/execute", method: "POST" }, {
        walletId: config.walletId,
        requestId,
        operation,
      });
    }
  } else {
    payload = await callAgent<Record<string, unknown>>(
      config,
      { path: "/execute", method: "POST" },
      {
        walletId: config.walletId,
        requestId,
        operation,
      },
    );
  }
  return {
    ok: payload.ok !== false && payload.success !== false,
    txId: String(
      payload.txId
      ?? payload.transactionId
      ?? payload.hash
      ?? ((payload.result as Record<string, unknown> | undefined)?.id ?? ""),
    ),
    message: String(payload.message ?? payload.suggestion ?? "Operation submitted"),
    raw: payload,
  };
}
