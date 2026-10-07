import { db } from "../db/index.js";
import { workspaces } from "../db/schema.js";
import { eq } from "drizzle-orm";


export async function getWorkspaceByOwner(userId: number) {
  const [workspace] = await db
    .select({ id: workspaces.id, ownerId: workspaces.ownerId })
    .from(workspaces)
    .where(eq(workspaces.ownerId, userId))
    .limit(1);

  return workspace;
}
