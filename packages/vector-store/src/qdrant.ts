import { QdrantClient } from "@qdrant/js-client-rest";

export const qdrant = new QdrantClient({ url: process.env.QDRANT_URL! });

const COLLECTION = "incident_diagnoses";
const VECTOR_SIZE = 384; // all-MiniLM-L6-v2 output dimension

export async function ensureCollection() {
	const { collections } = await qdrant.getCollections();
	if (collections.some((c) => c.name === COLLECTION)) return;

	await qdrant.createCollection(COLLECTION, {
		vectors: {
			size: VECTOR_SIZE,
			distance: "Cosine",
		},
	});
}

export interface IncidentVectorPayload extends Record<string, unknown> {
	projectId: string;
	incidentId: string;
	diagnosisId: string;
}

export async function upsertIncidentVector(
	id: string,
	vector: number[],
	payload: IncidentVectorPayload,
) {
	await qdrant.upsert(COLLECTION, { points: [{ id, vector, payload }] });
}

export async function findSimilarDiagnosedIncidents(
	projectId: string,
	vector: number[],
	limit = 3,
) {
	return qdrant.query(COLLECTION, {
		query: vector,
		limit,
		filter: { must: [{ key: "projectId", match: { value: projectId } }] },
		with_payload: true,
	});
}
