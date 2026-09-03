-- AlterTable
ALTER TABLE "agents" ADD COLUMN     "knownTools" TEXT[] DEFAULT ARRAY[]::TEXT[];
