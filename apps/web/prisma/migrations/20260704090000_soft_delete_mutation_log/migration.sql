ALTER TABLE "ApiToken" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Project" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Chapter" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Scene" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Character" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "CharacterNote" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "WorldNote" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "PlotThread" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Foreshadowing" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "RevisionTodo" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "StoryStateSnapshot" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "ExportJob" ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE TABLE "MutationLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "commandId" TEXT NOT NULL,
  "transactionId" TEXT,
  "userId" TEXT NOT NULL,
  "apiTokenId" TEXT,
  "projectId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "beforeSnapshot" JSONB,
  "afterSnapshot" JSONB,
  "rolledBackAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MutationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MutationLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "MutationLog_commandId_key" ON "MutationLog"("commandId");
CREATE INDEX "Project_userId_deletedAt_idx" ON "Project"("userId", "deletedAt");
CREATE INDEX "Chapter_projectId_deletedAt_idx" ON "Chapter"("projectId", "deletedAt");
CREATE INDEX "Scene_projectId_deletedAt_idx" ON "Scene"("projectId", "deletedAt");
CREATE INDEX "Character_projectId_deletedAt_idx" ON "Character"("projectId", "deletedAt");
CREATE INDEX "CharacterNote_projectId_deletedAt_idx" ON "CharacterNote"("projectId", "deletedAt");
CREATE INDEX "CharacterNote_characterId_deletedAt_idx" ON "CharacterNote"("characterId", "deletedAt");
CREATE INDEX "WorldNote_projectId_deletedAt_idx" ON "WorldNote"("projectId", "deletedAt");
CREATE INDEX "PlotThread_projectId_deletedAt_idx" ON "PlotThread"("projectId", "deletedAt");
CREATE INDEX "Foreshadowing_projectId_deletedAt_idx" ON "Foreshadowing"("projectId", "deletedAt");
CREATE INDEX "RevisionTodo_projectId_deletedAt_idx" ON "RevisionTodo"("projectId", "deletedAt");
CREATE INDEX "StoryStateSnapshot_projectId_deletedAt_idx" ON "StoryStateSnapshot"("projectId", "deletedAt");
CREATE INDEX "MutationLog_transactionId_createdAt_idx" ON "MutationLog"("transactionId", "createdAt");
CREATE INDEX "MutationLog_userId_projectId_createdAt_idx" ON "MutationLog"("userId", "projectId", "createdAt");
CREATE INDEX "MutationLog_targetType_targetId_createdAt_idx" ON "MutationLog"("targetType", "targetId", "createdAt");
