import { NextResponse } from "next/server";
import { handleMastersRequest } from "../../../agent-backend/http";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json(await handleMastersRequest());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load masters";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
