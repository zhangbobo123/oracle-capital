import { readFile } from "node:fs/promises";

type HttpMethod = "GET" | "POST";

type EndpointDescriptor = {
  path: string;
  method?: HttpMethod;
};

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
    throw new Error(detail || `Cobo agent returned ${response.status}`);
  }
  return response.json() as Promise<T>;
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
  const descriptor = endpoint(config, "connect", { path: "/health", method: "GET" });
  const payload = await callAgent<Record<string, unknown>>(config, descriptor, { walletId: config.walletId });
  return {
    connected: true,
    endpoint: normalizeBaseUrl(config.baseUrl),
    walletId: config.walletId ?? String(payload.walletId ?? payload.accountId ?? "cobo-agent"),
    message: String(payload.message ?? "Connected to Cobo agent"),
    raw: payload,
  };
}

export async function getCoboBalances(config: CoboAgentConfig) {
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

export async function authorizeCoboOperation(config: CoboAgentConfig, operation: Record<string, unknown>) {
  const descriptor = endpoint(config, "authorize", { path: "/authorize", method: "POST" });
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
}

export async function executeCoboOperation(
  config: CoboAgentConfig,
  operation: Record<string, unknown>,
  requestId?: string,
) {
  const descriptor = endpoint(config, "execute", { path: "/execute", method: "POST" });
  const payload = await callAgent<Record<string, unknown>>(config, descriptor, {
    walletId: config.walletId,
    requestId,
    operation,
  });
  return {
    ok: payload.ok !== false,
    txId: String(payload.txId ?? payload.transactionId ?? payload.hash ?? ""),
    message: String(payload.message ?? "Operation executed"),
    raw: payload,
  };
}
