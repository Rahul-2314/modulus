import { z } from "zod";

export const diagnosisResultSchema = z.object({
	rootCause: z.string().min(1),
	confidence: z.number().min(0).max(1),
	affectedComponent: z.string().min(1),
	suggestedRemediation: z.string().min(1),
	evidence: z.array(z.string()).min(1).max(10),
});

export type DiagnosisResult = z.infer<typeof diagnosisResultSchema>;
