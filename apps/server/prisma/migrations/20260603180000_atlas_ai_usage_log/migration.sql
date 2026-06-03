-- CreateTable
CREATE TABLE "AtlasAiUsageLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "feature" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "totalTokens" INTEGER,
    "latencyMs" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'success',
    "errorCode" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AtlasAiUsageLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AtlasAiUsageLog_tenantId_createdAt_idx" ON "AtlasAiUsageLog"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "AtlasAiUsageLog_tenantId_feature_createdAt_idx" ON "AtlasAiUsageLog"("tenantId", "feature", "createdAt");

-- CreateIndex
CREATE INDEX "AtlasAiUsageLog_tenantId_userId_createdAt_idx" ON "AtlasAiUsageLog"("tenantId", "userId", "createdAt");

-- AddForeignKey
ALTER TABLE "AtlasAiUsageLog" ADD CONSTRAINT "AtlasAiUsageLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
