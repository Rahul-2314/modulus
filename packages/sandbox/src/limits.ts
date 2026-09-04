export const SANDBOX_LIMITS = {
	memoryBytes: 512 * 1024 * 1024,
	nanoCpus: 1_000_000_000, // 1 vCPU
	pidsLimit: 128,
	timeoutMs: 5 * 60 * 1000,
} as const;
