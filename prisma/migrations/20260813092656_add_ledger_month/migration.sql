-- CreateTable
CREATE TABLE "LedgerMonth" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerMonth_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LedgerMonth_entityId_year_month_idx" ON "LedgerMonth"("entityId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerMonth_entityId_year_month_key" ON "LedgerMonth"("entityId", "year", "month");

-- AddForeignKey
ALTER TABLE "LedgerMonth" ADD CONSTRAINT "LedgerMonth_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "BusinessEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerMonth" ADD CONSTRAINT "LedgerMonth_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
