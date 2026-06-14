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
    txStatus?: EndpointDescriptor;
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

function hasCustomEndpoint(config: CoboAgentConfig, name: keyof NonNullable<CoboAgentConfig["endpoints"]>) {
  return Boolean(config.endpoints?.[name]?.path);
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

async function callAgentRaw<T>(
  config: CoboAgentConfig,
  method: HttpMethod,
  path: string,
  payload?: Record<string, unknown>,
) {
  return callAgent<T>(config, { method, path }, payload ?? {});
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
  (["connect", "balance", "authorize", "execute", "txStatus"] as const).forEach((key) => {
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

function requireWalletId(config: CoboAgentConfig) {
  if (!config.walletId?.trim()) {
    throw new Error("walletId is required for Cobo on-chain operations");
  }
  return config.walletId.trim();
}

function normalizeTransferPayload(operation: Record<string, unknown>) {
  const destination = String(operation.dst_addr ?? operation.to ?? "").trim();
  const chainId = String(operation.chain_id ?? operation.chainId ?? "SETH").trim();
  const rawToken = String(operation.token_id ?? operation.tokenId ?? operation.symbol ?? "").trim().toUpperCase();
  const tokenId = rawToken.includes("_") ? rawToken : rawToken ? `${chainId}_${rawToken}` : "";
  const amount = typeof operation.amount === "number" || typeof operation.amount === "string"
    ? String(operation.amount).trim()
    : "";
  if (!destination || !tokenId || !amount) {
    throw new Error("transfer requires dst_addr/to, token_id/symbol, and amount");
  }
  return {
    chain_id: chainId,
    dst_addr: destination,
    token_id: tokenId,
    amount,
  };
}

export async function connectCobo(config: CoboAgentConfig) {
  const descriptor = endpoint(config, "connect", { path: "/health", method: "GET" });
  let payload: Record<string, unknown>;
  try {
    payload = await callAgent<Record<string, unknown>>(config, descriptor, { walletId: config.walletId });
  } catch (error) {
    if (hasCustomEndpoint(config, "connect")) throw error;
    payload = await callAgent<Record<string, unknown>>(config, { path: "/api/v1/ping", method: "GET" }, {});
  }
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
  if (!hasCustomEndpoint(config, "authorize")) {
    const action = String(operation.action ?? "").toLowerCase();
    if (action === "transfer") {
      normalizeTransferPayload(operation);
    }
    return {
      authorized: true,
      requestId: "",
      message: "授权确认已记录。执行阶段将由 Cobo 策略进行最终校验。",
      raw: {},
    };
  }
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
  if (!hasCustomEndpoint(config, "execute")) {
    const walletId = requireWalletId(config);
    const action = String(operation.action ?? "").toLowerCase();
    if (action === "transfer") {
      const payload = await callAgentRaw<Record<string, unknown>>(
        config,
        "POST",
        `/api/v1/wallets/${walletId}/transfer`,
        normalizeTransferPayload(operation),
      );
      return {
        ok: payload.success !== false,
        txId: String(payload.request_id ?? payload.transaction_uuid ?? payload.txId ?? payload.hash ?? ""),
        message: String(payload.message ?? "Transfer submitted"),
        raw: payload,
      };
    }
    if (action === "contract_call") {
      const payload = await callAgentRaw<Record<string, unknown>>(
        config,
        "POST",
        `/api/v1/wallets/${walletId}/contract-call`,
        { ...operation, request_id: requestId || operation.request_id },
      );
      return {
        ok: payload.success !== false,
        txId: String(payload.request_id ?? payload.transaction_uuid ?? payload.txId ?? payload.hash ?? ""),
        message: String(payload.message ?? "Contract call submitted"),
        raw: payload,
      };
    }
    if (action === "payment") {
      const payload = await callAgentRaw<Record<string, unknown>>(
        config,
        "POST",
        `/api/v1/wallets/${walletId}/payment`,
        { ...operation, request_id: requestId || operation.request_id },
      );
      return {
        ok: payload.success !== false,
        txId: String(payload.request_id ?? payload.transaction_uuid ?? payload.txId ?? payload.hash ?? ""),
        message: String(payload.message ?? "Payment submitted"),
        raw: payload,
      };
    }
    if (action === "message_sign") {
      const payload = await callAgentRaw<Record<string, unknown>>(
        config,
        "POST",
        `/api/v1/wallets/${walletId}/message-sign`,
        { ...operation, request_id: requestId || operation.request_id },
      );
      return {
        ok: payload.success !== false,
        txId: String(payload.request_id ?? payload.signature ?? payload.txId ?? ""),
        message: String(payload.message ?? "Message sign submitted"),
        raw: payload,
      };
    }
    if (action === "hermes_command" || action === "nl_command" || action === "execute_strategy") {
      const payload = await callAgentRaw<Record<string, unknown>>(
        config,
        "POST",
        "/execute",
        {
          walletId,
          requestId,
          operation,
        },
      );
      return {
        ok: payload.ok !== false && payload.success !== false,
        txId: String(payload.txId ?? payload.request_id ?? payload.transaction_uuid ?? payload.hash ?? ""),
        message: String(payload.message ?? "Hermes command submitted"),
        raw: payload,
      };
    }
    throw new Error(`Unsupported action: ${action || "empty"}. Supported: transfer, contract_call, payment, message_sign`);
  }
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

export async function getCoboWalletAddresses(config: CoboAgentConfig) {
  const walletId = requireWalletId(config);
  const payload = await callAgentRaw<Record<string, unknown>>(
    config,
    "GET",
    `/api/v1/wallets/${walletId}/addresses`,
  );
  const result = Array.isArray(payload.result) ? payload.result : [];
  return result
    .map((item) => {
      if (!item || typeof item !== "object") return "";
      const row = item as Record<string, unknown>;
      return String(row.address ?? "").trim();
    })
    .filter(Boolean);
}

export async function getCoboTransactionByRequestId(config: CoboAgentConfig, requestId: string) {
  const normalizedRequestId = requestId.trim();
  if (!normalizedRequestId) {
    throw new Error("requestId is required");
  }
  if (!hasCustomEndpoint(config, "txStatus")) {
    const walletId = requireWalletId(config);
    const payload = await callAgentRaw<Record<string, unknown>>(
      config,
      "GET",
      `/api/v1/wallets/${walletId}/transactions/by-request-id/${encodeURIComponent(normalizedRequestId)}`,
    );
    return payload;
  }
  const descriptor = endpoint(config, "txStatus", { path: "/tx-status", method: "GET" });
  return callAgent<Record<string, unknown>>(config, descriptor, { requestId: normalizedRequestId, walletId: config.walletId });
}
