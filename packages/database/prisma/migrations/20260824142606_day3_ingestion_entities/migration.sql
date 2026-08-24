/*
  Warnings:

  - You are about to alter the column `cost` on the `executions` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(10,4)`.

*/
-- AlterTable
ALTER TABLE "executions" ALTER COLUMN "cost" SET DATA TYPE DECIMAL(10,4);
