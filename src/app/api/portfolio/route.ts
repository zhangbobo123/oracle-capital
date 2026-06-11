import { NextRequest, NextResponse } from "next/server";

export const revalidate = 30;

async function rpc(url: string, method: string, params: unknown[]) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(8_000),
    next: { revalidate: 30 },
  });
  if (!response.ok) throw new Error(`RPC ${response.status}`);
  const data = await response.json() as { result?: unknown; error?: unknown };
  if (data.error || data.result === undefined) throw new Error("RPC returned an error");
  return data.result;
}

async function rpcWithFallback(urls: string[], method: string, params: unknown[]) {
  let lastError: unknown;
  for (const url of urls) {
    try {
      return await rpc(url, method, params);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error("No RPC endpoint available");
}

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address")?.trim();
  const kind = request.nextUrl.searchParams.get("kind");
  if (!address || !["evm", "solana"].includes(kind ?? "")) {
    return NextResponse.json({ error: "Valid address and wallet kind are required" }, { status: 400 });
  }

  try {
    if (kind === "solana") {
      if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
        return NextResponse.json({ error: "Invalid Solana address" }, { status: 400 });
      }
      const result = await rpcWithFallback([
        "https://api.mainnet-beta.solana.com",
        "https://solana-rpc.publicnode.com",
        "https://rpc.ankr.com/solana",
      ], "getBalance", [address]) as { value?: number };
      return NextResponse.json({
        balances: [{ chain: "Solana", symbol: "SOL", balance: (result.value ?? 0) / 1e9 }],
        updatedAt: new Date().toISOString(),
      });
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json({ error: "Invalid EVM address" }, { status: 400 });
    }
    const [ethHex, bnbHex] = await Promise.all([
      rpc("https://ethereum-rpc.publicnode.com", "eth_getBalance", [address, "latest"]),
      rpc("https://bsc-rpc.publicnode.com", "eth_getBalance", [address, "latest"]),
    ]) as string[];
    return NextResponse.json({
      balances: [
        { chain: "Ethereum", symbol: "ETH", balance: Number(BigInt(ethHex)) / 1e18 },
        { chain: "BNB Chain", symbol: "BNB", balance: Number(BigInt(bnbHex)) / 1e18 },
      ],
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Portfolio RPC error", error);
    return NextResponse.json({ error: "Unable to read wallet balances" }, { status: 502 });
  }
}
