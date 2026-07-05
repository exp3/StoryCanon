import { auth } from "@/auth";
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

export async function getWebActor(req: NextRequest): Promise<CurrentActor | null> {
  const session = await auth();
  const sessionUser = session?.user as { id?: string } | undefined;
  if (sessionUser?.id) {
    return { userId: sessionUser.id, via: "web" };
  }

  if (process.env.NODE_ENV !== "production") {
    const userId = req.headers.get("x-storycanon-user-id") ?? "local-user";
    return { userId, via: "web" };
  }

  return null;
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
