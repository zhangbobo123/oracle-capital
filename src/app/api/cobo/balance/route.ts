import { NextRequest, NextResponse } from "next/server";
import { CoboAgentConfig, getCoboBalances, loadCoboConfig, normalizeCoboConfig } from "@/lib/cobo-agent";

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
    const body = await request.json() as { configPath?: string; config?: Partial<CoboAgentConfig> };
    const config = await resolveConfig(body);
    const result = await getCoboBalances(config);
    return NextResponse.json({
      balances: result.balances,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to read Cobo balances";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
