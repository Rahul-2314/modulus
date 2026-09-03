-- CreateTable
CREATE TABLE "diagnoses" (
    "id" TEXT NOT NULL,
    "incident_id" TEXT NOT NULL,
    "root_cause" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "affected_component" TEXT NOT NULL,
    "suggested_remediation" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "model" TEXT NOT NULL,
    "cost" DOUBLE PRECISION NOT NULL,
    "cache_hit" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "diagnoses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "diagnoses_incident_id_key" ON "diagnoses"("incident_id");

-- AddForeignKey
ALTER TABLE "diagnoses" ADD CONSTRAINT "diagnoses_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
