-- CreateEnum
CREATE TYPE "FixRiskLevel" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "FixStatus" AS ENUM ('generating', 'validated', 'tests_passed', 'tests_failed', 'pr_created', 'needs_review');

-- CreateEnum
CREATE TYPE "PullRequestStatus" AS ENUM ('pending', 'open', 'merged', 'closed');

-- CreateTable
CREATE TABLE "fixes" (
    "id" TEXT NOT NULL,
    "incident_id" TEXT NOT NULL,
    "strategy" TEXT NOT NULL,
    "diff" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "risk_level" "FixRiskLevel" NOT NULL,
    "status" "FixStatus" NOT NULL DEFAULT 'generating',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fixes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_runs" (
    "id" TEXT NOT NULL,
    "fix_id" TEXT NOT NULL,
    "suite" TEXT NOT NULL,
    "passed" INTEGER NOT NULL,
    "failed" INTEGER NOT NULL,
    "duration_ms" INTEGER NOT NULL,
    "report" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pull_requests" (
    "id" TEXT NOT NULL,
    "fix_id" TEXT NOT NULL,
    "repository" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "pr_number" INTEGER,
    "url" TEXT,
    "status" "PullRequestStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pull_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fixes_incident_id_key" ON "fixes"("incident_id");

-- CreateIndex
CREATE UNIQUE INDEX "pull_requests_fix_id_key" ON "pull_requests"("fix_id");

-- AddForeignKey
ALTER TABLE "fixes" ADD CONSTRAINT "fixes_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_runs" ADD CONSTRAINT "test_runs_fix_id_fkey" FOREIGN KEY ("fix_id") REFERENCES "fixes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pull_requests" ADD CONSTRAINT "pull_requests_fix_id_fkey" FOREIGN KEY ("fix_id") REFERENCES "fixes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
