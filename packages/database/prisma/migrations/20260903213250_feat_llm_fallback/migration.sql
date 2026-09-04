-- AlterTable
ALTER TABLE "diagnoses" ADD COLUMN     "fellBack" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "provider" TEXT NOT NULL DEFAULT 'groq';
