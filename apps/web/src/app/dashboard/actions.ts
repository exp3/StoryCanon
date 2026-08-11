"use server";

import { redirect } from "next/navigation";
import { requireSessionUser } from "@/server/session";
import { createSampleProject } from "@/server/sample-project";

/**
 * Seeds the demo work and opens it. Idempotent — pressing the button again
 * just reopens the existing sample rather than seeding a second copy.
 */
export async function addSampleProject() {
  const user = await requireSessionUser("/dashboard");
  const projectId = await createSampleProject(user.id, user.locale);
  redirect(`/projects/${projectId}`);
}
