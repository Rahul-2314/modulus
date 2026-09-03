-- CreateEnum
CREATE TYPE "AloMetricType" AS ENUM ('task_success_rate', 'tool_reliability', 'cost_per_task', 'completion_latency_p95', 'loop_rate');

-- CreateEnum
CREATE TYPE "AloComparator" AS ENUM ('gte', 'lte');

-- AlterTable
ALTER TABLE "executions" ADD COLUMN     "cost_alo" DECIMAL(65,30);

-- CreateTable
CREATE TABLE "agent_level_objectives" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "metric_type" "AloMetricType" NOT NULL,
    "comparator" "AloComparator" NOT NULL,
    "target_value" DOUBLE PRECISION NOT NULL,
    "window_days" INTEGER NOT NULL DEFAULT 7,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_level_objectives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alo_evaluations" (
    "id" TEXT NOT NULL,
    "objective_id" TEXT NOT NULL,
    "current_value" DOUBLE PRECISION NOT NULL,
    "budget_remaining" DOUBLE PRECISION NOT NULL,
    "breached" BOOLEAN NOT NULL,
    "sample_size" INTEGER NOT NULL,
    "evaluated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alo_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agent_level_objectives_agent_id_metric_type_key" ON "agent_level_objectives"("agent_id", "metric_type");

-- CreateIndex
CREATE INDEX "alo_evaluations_objective_id_evaluated_at_idx" ON "alo_evaluations"("objective_id", "evaluated_at");

-- AddForeignKey
ALTER TABLE "agent_level_objectives" ADD CONSTRAINT "agent_level_objectives_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alo_evaluations" ADD CONSTRAINT "alo_evaluations_objective_id_fkey" FOREIGN KEY ("objective_id") REFERENCES "agent_level_objectives"("id") ON DELETE CASCADE ON UPDATE CASCADE;
