import { NextRequest, NextResponse } from "next/server";

export type CurrentActor = {
  userId: string;
  via: "web" | "api-token";
  apiTokenId?: string;
};

export function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function readPath(req: NextRequest) {
  return req.nextUrl.pathname.split("/").filter(Boolean);
}

export function getWebActor(req: NextRequest): CurrentActor {
  const userId = req.headers.get("x-storycanon-user-id") ?? "local-user";
  return { userId, via: "web" };
}

export async function readJson(req: NextRequest) {
  if (req.method === "GET" || req.method === "DELETE") return {};
  try {
    return await req.json();
  } catch {
    return {};
  }
}

export function errorResponse(code: string, message: string, status = 400, extra = {}) {
  return json({ error: code, message, ...extra }, { status });
}
