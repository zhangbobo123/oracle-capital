import { NextRequest, NextResponse } from "next/server";
import { CoboAgentConfig, executeCoboOperation, loadCoboConfig, normalizeCoboConfig } from "@/lib/cobo-agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SwapOperationPayload = {
  action: "contract_call";
  chain_id: string;
  contract_addr: string;
  calldata: string;
  value?: string;
  memo?: string;
};

async function resolveConfig(body: { configPath?: string; config?: Partial<CoboAgentConfig> }) {
  const configPath = body.configPath?.trim() ?? "";
  if (body.config && typeof body.config === "object") {
    return normalizeCoboConfig(body.config);
  }
  if (!configPath) throw new Error("Config path or config object is required");
  return loadCoboConfig(configPath);
}

function createRequestId(prefix: string) {
  return `${prefix}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      configPath?: string;
      config?: Partial<CoboAgentConfig>;
      approveOperation?: SwapOperationPayload;
      swapOperation?: SwapOperationPayload;
      skipApprove?: boolean;
    };
    const config = await resolveConfig(body);
    if (!body.swapOperation) {
      return NextResponse.json({ error: "swapOperation is required" }, { status: 400 });
    }

    let approveResult: { requestId?: string; txId?: string; message?: string } | undefined;
    if (!body.skipApprove && body.approveOperation) {
      const approveRequestId = createRequestId("approve");
      const approveExecution = await executeCoboOperation(config, {
        ...body.approveOperation,
        action: "contract_call",
      }, approveRequestId);
      if (approveExecution.ok === false) {
        throw new Error(approveExecution.message || "Approve transaction rejected");
      }
      approveResult = {
        requestId: approveRequestId,
        txId: approveExecution.txId,
        message: approveExecution.message,
      };
    }

    const swapRequestId = createRequestId("swap");
    const swapExecution = await executeCoboOperation(config, {
      ...body.swapOperation,
      action: "contract_call",
    }, swapRequestId);
    if (swapExecution.ok === false) {
      throw new Error(swapExecution.message || "Swap transaction rejected");
    }

    return NextResponse.json({
      ok: true,
      approve: approveResult,
      swap: {
        requestId: swapRequestId,
        txId: swapExecution.txId,
        message: swapExecution.message,
      },
      raw: swapExecution.raw,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to execute swap";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
