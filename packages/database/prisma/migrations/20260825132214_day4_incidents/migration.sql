/*
  Warnings:

  - You are about to drop the column `latency` on the `tool_calls` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[key_hash]` on the table `api_keys` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `latency_ms` to the `tool_calls` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "IncidentSeverity" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('open', 'acknowledged', 'resolved');

-- AlterTable
ALTER TABLE "tool_calls" DROP COLUMN "latency",
ADD COLUMN     "latency_ms" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "incidents" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "rule_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "severity" "IncidentSeverity" NOT NULL DEFAULT 'medium',
    "status" "IncidentStatus" NOT NULL DEFAULT 'open',
    "first_seen" TIMESTAMP(3) NOT NULL,
    "last_seen" TIMESTAMP(3) NOT NULL,
    "occurrence_count" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_executions" (
    "id" TEXT NOT NULL,
    "incident_id" TEXT NOT NULL,
    "execution_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incident_executions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "incidents_project_id_rule_id_status_idx" ON "incidents"("project_id", "rule_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "incident_executions_incident_id_execution_id_key" ON "incident_executions"("incident_id", "execution_id");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_hash_key" ON "api_keys"("key_hash");

-- CreateIndex
CREATE INDEX "api_keys_project_id_idx" ON "api_keys"("project_id");

-- CreateIndex
CREATE INDEX "api_keys_prefix_idx" ON "api_keys"("prefix");

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_executions" ADD CONSTRAINT "incident_executions_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_executions" ADD CONSTRAINT "incident_executions_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
