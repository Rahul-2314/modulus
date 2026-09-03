import { prisma } from "@modulus/database";
import type { AloMetricType } from "@modulus/database";

export interface MetricResult {
	value: number;
	sampleSize: number;
}

export async function computeMetric(
	agentId: string,
	metricType: AloMetricType,
	windowDays: number,
): Promise<MetricResult | null> {
	const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

	switch (metricType) {
		case "task_success_rate": {
			const [total, succeeded] = await Promise.all([
				prisma.execution.count({
					where: { agentId, createdAt: { gte: since } },
				}),
				prisma.execution.count({
					where: { agentId, createdAt: { gte: since }, status: "succeeded" },
				}),
			]);
			return total > 0 ? { value: succeeded / total, sampleSize: total } : null;
		}
		case "tool_reliability": {
			const [total, succeeded] = await Promise.all([
				prisma.toolCall.count({
					where: { execution: { agentId, createdAt: { gte: since } } },
				}),
				prisma.toolCall.count({
					where: {
						execution: { agentId, createdAt: { gte: since } },
						status: "success",
					},
				}),
			]);
			return total > 0 ? { value: succeeded / total, sampleSize: total } : null;
		}
		case "cost_per_task": {
			const result = await prisma.execution.aggregate({
				where: { agentId, createdAt: { gte: since }, costALO: { not: null } },
				_avg: { costALO: true },
				_count: true,
			});
			return result._count > 0 && result._avg.costALO !== null
				? { value: Number(result._avg.costALO), sampleSize: result._count }
				: null;
		}
		case "completion_latency_p95": {
			const rows = await prisma.$queryRaw<
				Array<{ p95: number | null; sample_size: bigint }>
			>`
        SELECT PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM ("ended_at" - "started_at")) * 1000) AS p95, COUNT(*) AS sample_size
        FROM executions WHERE agent_id = ${agentId} AND created_at >= ${since} AND ended_at IS NOT NULL
      `;
			const row = rows[0];
			return row && Number(row.sample_size) > 0 && row.p95 !== null
				? { value: row.p95, sampleSize: Number(row.sample_size) }
				: null;
		}
		case "loop_rate": {
			const [total, looped] = await Promise.all([
				prisma.execution.count({
					where: { agentId, createdAt: { gte: since } },
				}),
				prisma.incidentExecution.count({
					where: {
						incident: { ruleId: "repeated_tool_loop" },
						execution: { agentId, createdAt: { gte: since } },
					},
				}),
			]);
			return total > 0 ? { value: looped / total, sampleSize: total } : null;
		}
	}
}
