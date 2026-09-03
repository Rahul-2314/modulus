import { cookies } from "next/headers";

interface Objective {
	metricType: string;
	comparator: "gte" | "lte";
	targetValue: number;
	evaluations: Array<{ currentValue: number; breached: boolean }>;
}

async function getObjectives(agentId: string): Promise<Objective[]> {
	const cookieStore = await cookies();
	const res = await fetch(
		`${process.env.INTERNAL_API_URL}/api/alo?agentId=${agentId}`,
		{ headers: { Cookie: cookieStore.toString() }, cache: "no-store" },
	);
	const data = await res.json();
	return data.success ? data.data : [];
}

const LABELS: Record<string, string> = {
	task_success_rate: "Task Success",
	tool_reliability: "Tool Reliability",
	cost_per_task: "Cost / Task",
	completion_latency_p95: "P95 Latency",
	loop_rate: "Loop Rate",
};

export default async function ScorecardPage({
	params,
}: {
	params: Promise<{ id: string; agentId: string }>;
}) {
	const { agentId } = await params;
	const objectives = await getObjectives(agentId);

	return (
		<div className="p-8 max-w-lg">
			<h1 className="text-2xl font-semibold mb-6">
				Agent Reliability Scorecard
			</h1>
			<div className="border rounded divide-y">
				{objectives.map((o) => {
					const latest = o.evaluations[0];
					return (
						<div
							key={o.metricType}
							className="p-4 flex justify-between items-center"
						>
							<div>
								<p className="font-medium">{LABELS[o.metricType]}</p>
								<p className="text-xs text-gray-500">
									{o.comparator === "gte" ? "Target ≥" : "Target ≤"}{" "}
									{o.targetValue}
								</p>
							</div>
							{latest ? (
								<span
									className={`text-sm font-semibold ${latest.breached ? "text-red-600" : "text-green-600"}`}
								>
									{latest.currentValue.toFixed(2)}{" "}
									{latest.breached ? "🔴" : "🟢"}
								</span>
							) : (
								<span className="text-sm text-gray-400">No data yet</span>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
}
