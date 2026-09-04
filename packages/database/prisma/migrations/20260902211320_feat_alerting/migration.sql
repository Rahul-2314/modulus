-- CreateEnum
CREATE TYPE "PlatformAlertSeverity" AS ENUM ('warning', 'critical');

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "alert_min_severity" "IncidentSeverity" DEFAULT 'high',
ADD COLUMN     "notification_email" TEXT,
ADD COLUMN     "notification_pagerduty_key_encrypted" TEXT,
ADD COLUMN     "notification_slack_webhook_encrypted" TEXT;

-- CreateTable
CREATE TABLE "platform_alerts" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "severity" "PlatformAlertSeverity" NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "platform_alerts_source_created_at_idx" ON "platform_alerts"("source", "created_at");
