-- CreateEnum
CREATE TYPE "ReproductionStatus" AS ENUM ('queued', 'running', 'reproduced', 'not_reproduced', 'error');

-- AlterTable
ALTER TABLE "executions" ADD COLUMN     "commit_sha" TEXT;

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "default_branch" TEXT DEFAULT 'main',
ADD COLUMN     "repository_url" TEXT;

-- CreateTable
CREATE TABLE "reproductions" (
    "id" TEXT NOT NULL,
    "incident_id" TEXT NOT NULL,
    "status" "ReproductionStatus" NOT NULL DEFAULT 'queued',
    "environment" TEXT NOT NULL,
    "result" JSONB,
    "logs" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reproductions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reproductions_incident_id_idx" ON "reproductions"("incident_id");

-- AddForeignKey
ALTER TABLE "reproductions" ADD CONSTRAINT "reproductions_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
