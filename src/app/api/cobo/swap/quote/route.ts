import { NextRequest, NextResponse } from "next/server";
import { CoboAgentConfig, getCoboWalletAddresses, loadCoboConfig, normalizeCoboConfig } from "@/lib/cobo-agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TokenSpec = {
  symbol: string;
  tokenId: string;
  address: string;
  decimals: number;
};

const TOKENS: Record<string, TokenSpec> = {
  USDT: { symbol: "USDT", tokenId: "SETH_USDT", address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6 },
  BTC: { symbol: "BTC", tokenId: "SETH_WBTC", address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", decimals: 8 },
  ETH: { symbol: "ETH", tokenId: "SETH_WETH", address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", decimals: 18 },
};

function decimalToBaseUnits(value: string, decimals: number) {
  const trimmed = value.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error("金额格式无效");
  }
  const [wholePart, fractionPart = ""] = trimmed.split(".");
  const fraction = `${fractionPart}${"0".repeat(decimals)}`.slice(0, decimals);
  const normalized = `${wholePart}${fraction}`;
  const digits = normalized.replace(/^0+/, "") || "0";
  return BigInt(digits).toString();
}

function baseUnitsToDecimal(value: string, decimals: number) {
  const raw = value.replace(/^0+/, "") || "0";
  if (decimals === 0) return raw;
  const padded = raw.padStart(decimals + 1, "0");
  const whole = padded.slice(0, -decimals);
  const fraction = padded.slice(-decimals).replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
}

async function resolveConfig(body: { configPath?: string; config?: Partial<CoboAgentConfig> }) {
  const configPath = body.configPath?.trim() ?? "";
  if (body.config && typeof body.config === "object") {
    return normalizeCoboConfig(body.config);
  }
  if (!configPath) throw new Error("Config path or config object is required");
  return loadCoboConfig(configPath);
}

function approveCalldata(spender: string, amountBaseUnits: string) {
  const spenderHex = spender.toLowerCase().replace(/^0x/, "").padStart(64, "0");
  const amountHex = BigInt(amountBaseUnits).toString(16).padStart(64, "0");
  return `0x095ea7b3000000000000000000000000${spenderHex.slice(-40)}${amountHex}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      configPath?: string;
      config?: Partial<CoboAgentConfig>;
      sellSymbol?: string;
      buySymbol?: string;
      amount?: string | number;
      slippageBps?: number;
      quoteApiKey?: string;
    };
    const config = await resolveConfig(body);
    if (!config.walletId?.trim()) {
      return NextResponse.json({ error: "walletId is required for swap" }, { status: 400 });
    }

    const sell = TOKENS[String(body.sellSymbol ?? "USDT").toUpperCase()];
    const buy = TOKENS[String(body.buySymbol ?? "").toUpperCase()];
    if (!sell || !buy || sell.symbol === buy.symbol) {
      return NextResponse.json({ error: "仅支持 USDT 与 BTC/ETH 间兑换" }, { status: 400 });
    }

    const amountText = String(body.amount ?? "").trim();
    if (!amountText) {
      return NextResponse.json({ error: "amount is required" }, { status: 400 });
    }
    const sellAmount = decimalToBaseUnits(amountText, sell.decimals);
    if (sellAmount === "0") {
      return NextResponse.json({ error: "amount must be greater than 0" }, { status: 400 });
    }

    let addresses: string[] = [];
    try {
      addresses = await getCoboWalletAddresses(config);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unknown";
      throw new Error(`Cobo 地址读取失败（可能是 Cobo API Key 或 walletId 无权限）：${reason}`);
    }
    const taker = addresses[0];
    if (!taker) {
      return NextResponse.json({ error: "未读取到钱包地址，无法请求可执行报价" }, { status: 400 });
    }

    const slippageBps = Number.isFinite(body.slippageBps) ? Math.max(10, Math.min(300, Math.round(body.slippageBps!))) : 100;
    const quoteUrl = new URL("https://api.0x.org/swap/allowance-holder/quote");
    quoteUrl.searchParams.set("chainId", "1");
    quoteUrl.searchParams.set("sellToken", sell.address);
    quoteUrl.searchParams.set("buyToken", buy.address);
    quoteUrl.searchParams.set("sellAmount", sellAmount);
    quoteUrl.searchParams.set("taker", taker);
    quoteUrl.searchParams.set("slippageBps", String(slippageBps));

    const headers: Record<string, string> = { "0x-version": "v2" };
    const quoteApiKey = String(body.quoteApiKey ?? "").trim()
      || config.headers?.["0x-api-key"]
      || process.env.ZEROX_API_KEY
      || "";
    if (!quoteApiKey) {
      throw new Error("No API key found in request。请填写 0x API Key 或配置 ZEROX_API_KEY");
    }
    headers["0x-api-key"] = quoteApiKey;
    const quoteResp = await fetch(quoteUrl, { method: "GET", headers, cache: "no-store" });
    const quoteJson = await quoteResp.json().catch(() => ({})) as Record<string, unknown>;
    if (!quoteResp.ok) {
      if (quoteResp.status === 401) {
        throw new Error("0x Unauthorized：请确认填写的是 0x API Key（不是 Cobo API Key），且该 Key 已开通 Swap API 权限");
      }
      const reason = String(quoteJson.validationErrors ?? quoteJson.reason ?? quoteJson.message ?? quoteJson.error ?? "0x quote failed");
      throw new Error(reason);
    }

    const allowanceTarget = String(quoteJson.allowanceTarget ?? "");
    const buyAmountBase = String(quoteJson.buyAmount ?? "0");
    const sellAmountBase = String(quoteJson.sellAmount ?? sellAmount);
    const swapTo = String(quoteJson.to ?? "");
    const swapData = String(quoteJson.data ?? "");
    if (!allowanceTarget || !swapTo || !swapData) {
      throw new Error("聚合器未返回可执行的链上 calldata");
    }

    const approveOperation = {
      action: "contract_call",
      chain_id: "SETH",
      contract_addr: sell.address,
      calldata: approveCalldata(allowanceTarget, sellAmountBase),
      value: "0",
      memo: `Approve ${sell.symbol} allowance for 0x`,
    };
    const swapOperation = {
      action: "contract_call",
      chain_id: "SETH",
      contract_addr: swapTo,
      calldata: swapData,
      value: "0",
      memo: `Swap ${sell.symbol} -> ${buy.symbol} via 0x`,
    };

    return NextResponse.json({
      chain: "ethereum",
      taker,
      sell: { ...sell, amount: amountText, amountBaseUnits: sellAmountBase },
      buy: { ...buy, amount: baseUnitsToDecimal(buyAmountBase, buy.decimals), amountBaseUnits: buyAmountBase },
      allowanceTarget,
      slippageBps,
      quoteSource: "0x",
      approveOperation,
      swapOperation,
      rawQuote: quoteJson,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to quote swap";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
