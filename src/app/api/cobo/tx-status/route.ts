import { NextRequest, NextResponse } from "next/server";
import { CoboAgentConfig, getCoboTransactionByRequestId, loadCoboConfig, normalizeCoboConfig } from "@/lib/cobo-agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function resolveConfig(body: { configPath?: string; config?: Partial<CoboAgentConfig> }) {
  const configPath = body.configPath?.trim() ?? "";
  if (body.config && typeof body.config === "object") {
    return normalizeCoboConfig(body.config);
  }
  if (!configPath) throw new Error("Config path or config object is required");
  return loadCoboConfig(configPath);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      configPath?: string;
      config?: Partial<CoboAgentConfig>;
      requestId?: string;
    };
    const requestId = body.requestId?.trim() ?? "";
    if (!requestId) {
      return NextResponse.json({ error: "requestId is required" }, { status: 400 });
    }
    const config = await resolveConfig(body);
    const result = await getCoboTransactionByRequestId(config, requestId);
    return NextResponse.json({
      requestId,
      status: result.status ?? result.transaction_status ?? "unknown",
      txHash: result.tx_hash ?? result.hash ?? result.transaction_hash ?? "",
      result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load transaction status";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
