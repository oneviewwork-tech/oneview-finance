-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'PASSKEY_SET';
ALTER TYPE "AuditAction" ADD VALUE 'PASSKEY_VERIFIED';
ALTER TYPE "AuditAction" ADD VALUE 'PASSKEY_FAILED';
ALTER TYPE "AuditAction" ADD VALUE 'PASSKEY_LOCKED';
ALTER TYPE "AuditAction" ADD VALUE 'PASSKEY_RESET_REQUESTED';
ALTER TYPE "AuditAction" ADD VALUE 'PASSKEY_RESET_COMPLETED';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "passkeyFailedAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "passkeyHash" TEXT,
ADD COLUMN     "passkeyLockedUntil" TIMESTAMP(3),
ADD COLUMN     "passkeySetAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "PasskeyResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasskeyResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PasskeyResetToken_userId_consumedAt_idx" ON "PasskeyResetToken"("userId", "consumedAt");

-- AddForeignKey
ALTER TABLE "PasskeyResetToken" ADD CONSTRAINT "PasskeyResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
