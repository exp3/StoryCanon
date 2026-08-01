-- CreateEnum
CREATE TYPE "MysteryScope" AS ENUM ('CENTRAL', 'ARC', 'EPISODE', 'SCENE');

-- CreateTable
CREATE TABLE "Mystery" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "scope" "MysteryScope" NOT NULL DEFAULT 'CENTRAL',
    "question" TEXT NOT NULL,
    "truth" TEXT,
    "knownBy" TEXT,
    "clues" TEXT,
    "revealPoint" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mystery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Mystery_projectId_deletedAt_idx" ON "Mystery"("projectId", "deletedAt");

-- AddForeignKey
ALTER TABLE "Mystery" ADD CONSTRAINT "Mystery_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
