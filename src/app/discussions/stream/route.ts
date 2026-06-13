import { NextRequest } from "next/server";
import { handleDiscussionStream } from "../../../../agent-backend/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const encoder = new TextEncoder();

export async function POST(request: NextRequest) {
  const body = await request.json();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        await handleDiscussionStream(body, async (event) => {
          controller.enqueue(encoder.encode(`event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`));
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to stream discussion";
        controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: message })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
