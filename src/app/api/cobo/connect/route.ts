import { NextRequest, NextResponse } from "next/server";
import { CoboAgentConfig, connectCobo, getCoboBalances, loadCoboConfig, normalizeCoboConfig } from "@/lib/cobo-agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function resolveConfig(body: { configPath?: string; config?: Partial<CoboAgentConfig> }) {
  const configPath = body.configPath?.trim() ?? "";
  if (body.config && typeof body.config === "object") {
    return { config: normalizeCoboConfig(body.config), configPath };
  }
  if (!configPath) throw new Error("Config path or config object is required");
  return { config: await loadCoboConfig(configPath), configPath };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { configPath?: string; config?: Partial<CoboAgentConfig> };
    const { config, configPath } = await resolveConfig(body);
    const connection = await connectCobo(config);
    const balances = await getCoboBalances(config).catch(() => ({ balances: [] }));
    return NextResponse.json({
      connected: connection.connected,
      wallet: {
        kind: "cobo",
        label: config.name || "Cobo Agent",
        address: connection.walletId,
        endpoint: connection.endpoint,
        ...(configPath ? { configPath } : {}),
      },
      message: connection.message,
      balances: balances.balances,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to connect Cobo agent";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
