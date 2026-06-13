import { NextRequest, NextResponse } from "next/server";
import { handleDiscussionRequest } from "../../../agent-backend/http";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    return NextResponse.json(await handleDiscussionRequest(await request.json()));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start discussion";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
