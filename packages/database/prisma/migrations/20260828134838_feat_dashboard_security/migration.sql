-- AlterTable
ALTER TABLE "audit_logs" ALTER COLUMN "organization_id" DROP NOT NULL,
ALTER COLUMN "user_id" DROP NOT NULL;
