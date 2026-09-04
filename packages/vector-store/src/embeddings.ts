import { pipeline, type FeatureExtractionPipeline } from "@xenova/transformers";

let embedder: FeatureExtractionPipeline | null = null;

async function getEmbedder() {
	if (!embedder) {
		// Runs fully in-process via ONNX — no API key, no per-call cost, no
		// rate limit. ~90MB, cached after first load. Not frontier-quality,
		// but similarity search for incident dedup doesn't need to be.
		embedder = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
	}
	return embedder;
}

export async function embedText(text: string): Promise<number[]> {
	const model = await getEmbedder();
	const output = await model(text, { pooling: "mean", normalize: true });
	return Array.from(output.data as Float32Array);
}