import { NextRequest } from "next/server";
import { authenticateBearer } from "@/server/auth-token";
import { getWebActor, readJson, readPath, errorResponse } from "@/server/http";
import { handleMcpApi, handleWebApi } from "@/server/handlers";

async function dispatch(req: NextRequest) {
  const [, apiKind, ...rest] = readPath(req);
  const body = await readJson(req);

  if (apiKind === "mcp") {
    const actor = await authenticateBearer(req.headers.get("authorization"));
    if (!actor) return errorResponse("UNAUTHORIZED", "Valid bearer token is required.", 401);
    return handleMcpApi(rest.join("/"), actor, body);
  }

  return handleWebApi(req.method, [apiKind, ...rest].filter(Boolean), getWebActor(req), body);
}

export const GET = dispatch;
export const POST = dispatch;
export const PATCH = dispatch;
export const DELETE = dispatch;
