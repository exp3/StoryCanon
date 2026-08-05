-- CreateTable
CREATE TABLE "TimelineEvent" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "occurredAt" TEXT,
    "order" INTEGER NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimelineEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimelineTag" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimelineTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_TimelineEventCharacters" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_TimelineEventCharacters_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_TimelineEventTags" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_TimelineEventTags_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "TimelineEvent_projectId_order_idx" ON "TimelineEvent"("projectId", "order");

-- CreateIndex
CREATE INDEX "TimelineEvent_projectId_deletedAt_idx" ON "TimelineEvent"("projectId", "deletedAt");

-- CreateIndex
CREATE INDEX "TimelineTag_projectId_deletedAt_idx" ON "TimelineTag"("projectId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TimelineTag_projectId_name_key" ON "TimelineTag"("projectId", "name");

-- CreateIndex
CREATE INDEX "_TimelineEventCharacters_B_index" ON "_TimelineEventCharacters"("B");

-- CreateIndex
CREATE INDEX "_TimelineEventTags_B_index" ON "_TimelineEventTags"("B");

-- AddForeignKey
ALTER TABLE "TimelineEvent" ADD CONSTRAINT "TimelineEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimelineTag" ADD CONSTRAINT "TimelineTag_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TimelineEventCharacters" ADD CONSTRAINT "_TimelineEventCharacters_A_fkey" FOREIGN KEY ("A") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TimelineEventCharacters" ADD CONSTRAINT "_TimelineEventCharacters_B_fkey" FOREIGN KEY ("B") REFERENCES "TimelineEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TimelineEventTags" ADD CONSTRAINT "_TimelineEventTags_A_fkey" FOREIGN KEY ("A") REFERENCES "TimelineEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TimelineEventTags" ADD CONSTRAINT "_TimelineEventTags_B_fkey" FOREIGN KEY ("B") REFERENCES "TimelineTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
