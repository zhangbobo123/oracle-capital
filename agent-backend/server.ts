import { createServer } from "node:http";
import { handleDiscussionRequest, handleDiscussionStream, handleMastersRequest } from "./http";

function sendJson(response: import("node:http").ServerResponse, statusCode: number, payload: unknown) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  response.end(JSON.stringify(payload));
}

async function readJsonBody(request: import("node:http").IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
}

function sendSseEvent(
  response: import("node:http").ServerResponse,
  event: string,
  payload: unknown,
) {
  response.write(`event: ${event}\n`);
  response.write(`data: ${JSON.stringify(payload)}\n\n`);
}

const server = createServer(async (request, response) => {
  try {
    const method = request.method ?? "GET";
    const url = new URL(request.url ?? "/", "http://127.0.0.1");

    if (method === "OPTIONS") {
      sendJson(response, 204, {});
      return;
    }

    if (method === "GET" && url.pathname === "/masters") {
      const payload = await handleMastersRequest();
      sendJson(response, 200, payload);
      return;
    }

    if (method === "POST" && url.pathname === "/discussions") {
      const body = await readJsonBody(request);
      const payload = await handleDiscussionRequest(body);
      sendJson(response, 200, payload);
      return;
    }

    if (method === "POST" && url.pathname === "/discussions/stream") {
      response.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      });

      const body = await readJsonBody(request);
      try {
        await handleDiscussionStream(body, async (event) => {
          sendSseEvent(response, event.event, event.data);
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to stream discussion";
        sendSseEvent(response, "error", { error: message });
      } finally {
        response.end();
      }
      return;
    }

    sendJson(response, 404, { error: "Not found" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    sendJson(response, 500, { error: message });
  }
});

const port = Number(process.env.AGENT_BACKEND_PORT || 4010);

server.listen(port, () => {
  console.log(`Oracle Capital agent backend listening on http://127.0.0.1:${port}`);
});
