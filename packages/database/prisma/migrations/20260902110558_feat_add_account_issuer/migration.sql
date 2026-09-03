/*
  Warnings:

  - A unique constraint covering the columns `[issuer,accountId]` on the table `account` will be added. If there are existing duplicate values, this will fail.
  - Made the column `createdAt` on table `account` required. This step will fail if there are existing NULL values in that column.
  - Made the column `updatedAt` on table `account` required. This step will fail if there are existing NULL values in that column.
  - Made the column `issuer` on table `account` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "account_providerId_accountId_key";

-- AlterTable
ALTER TABLE "account" ALTER COLUMN "createdAt" SET NOT NULL,
ALTER COLUMN "updatedAt" SET NOT NULL,
ALTER COLUMN "issuer" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "account_issuer_accountId_key" ON "account"("issuer", "accountId");
