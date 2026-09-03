import { cookies } from "next/headers";
import { notFound } from "next/navigation";

interface IncidentDetail {
	id: string;
	title: string;
	ruleId: string;
	status: string;
	occurrenceCount: number;
	lastSeen: string;
	executions: Array<{
		execution: {
			toolCalls: Array<{
				id: string;
				toolName: string;
				status: string;
				latencyMs: number;
			}>;
		};
	}>;
	diagnosis: {
		rootCause: string;
		confidence: number;
		affectedComponent: string;
		suggestedRemediation: string;
		evidence: string[];
		cacheHit: boolean;
	} | null;
	reproductions: Array<{ status: string; logs: string | null }>;
	fix: {
		strategy: string;
		riskLevel: string;
		status: string;
		diff: string;
		testRuns: Array<{ suite: string; passed: number; failed: number }>;
		pullRequest: { url: string; status: string; prNumber: number } | null;
	} | null;
}

async function getIncident(incidentId: string): Promise<IncidentDetail | null> {
	const cookieStore = await cookies();
	const res = await fetch(`/api/incidents/${incidentId}`, {
		headers: { Cookie: cookieStore.toString() },
		cache: "no-store",
	});
	if (res.status === 404) return null;
	const data = await res.json();
	return data.success ? data.data : null;
}

export default async function IncidentDetailPage({
	params,
}: {
	params: Promise<{ id: string; incidentId: string }>;
}) {
	const { incidentId } = await params;
	const incident = await getIncident(incidentId);
	if (!incident) notFound(); // Next 16 App Router: renders the nearest not-found.tsx

	const execution = incident.executions[0]?.execution;

	return (
		<div className="p-8 max-w-4xl">
			<div className="flex items-center gap-3 mb-1">
				<h1 className="text-2xl font-semibold">{incident.title}</h1>
				<span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">
					{incident.status}
				</span>
			</div>
			<p className="text-gray-500 text-sm mb-8">
				Rule: <span className="font-mono">{incident.ruleId}</span> ·{" "}
				{incident.occurrenceCount} occurrence(s) · last seen{" "}
				{new Date(incident.lastSeen).toLocaleString()}
			</p>

			<Section title="Diagnosis">
				{incident.diagnosis ? (
					<div className="space-y-2 text-sm">
						<p>
							<span className="text-gray-500">Root cause:</span>{" "}
							{incident.diagnosis.rootCause}
						</p>
						<p>
							<span className="text-gray-500">Affected component:</span>{" "}
							{incident.diagnosis.affectedComponent}
						</p>
						<p>
							<span className="text-gray-500">Confidence:</span>{" "}
							{(incident.diagnosis.confidence * 100).toFixed(0)}%
							{incident.diagnosis.cacheHit && (
								<span className="ml-2 text-xs text-gray-400">
									(reused from a similar incident)
								</span>
							)}
						</p>
						<p>
							<span className="text-gray-500">Suggested remediation:</span>{" "}
							{incident.diagnosis.suggestedRemediation}
						</p>
						<ul className="list-disc pl-5 text-gray-600">
							{incident.diagnosis.evidence.map((e, i) => (
								<li key={i}>{e}</li>
							))}
						</ul>
					</div>
				) : (
					<EmptyState label="Diagnosis pending…" />
				)}
			</Section>

			<Section title="Execution trace">
				{execution ? (
					<div className="border rounded divide-y">
						{execution.toolCalls.map((tc) => (
							<div key={tc.id} className="p-3 text-sm flex justify-between">
								<span className="font-mono">{tc.toolName}</span>
								<span
									className={
										tc.status === "error" ? "text-red-600" : "text-green-600"
									}
								>
									{tc.status} · {tc.latencyMs}ms
								</span>
							</div>
						))}
					</div>
				) : (
					<EmptyState label="No execution linked yet." />
				)}
			</Section>

			<Section title="Reproduction">
				{incident.reproductions[0] ? (
					<div className="text-sm">
						<StatusPill status={incident.reproductions[0].status} />
						<pre className="mt-2 bg-gray-950 text-gray-100 text-xs p-3 rounded overflow-x-auto max-h-64">
							{incident.reproductions[0].logs ?? "No logs captured."}
						</pre>
					</div>
				) : (
					<EmptyState label="Reproduction pending…" />
				)}
			</Section>

			<Section title="Fix">
				{incident.fix ? (
					<div className="text-sm space-y-3">
						<p>
							<span className="text-gray-500">Strategy:</span>{" "}
							{incident.fix.strategy} ·{" "}
							<span className="text-gray-500">Risk:</span>{" "}
							<RiskBadge level={incident.fix.riskLevel} />
						</p>
						<div className="flex gap-4">
							{incident.fix.testRuns.map((t) => (
								<span
									key={t.suite}
									className={t.failed > 0 ? "text-red-600" : "text-green-600"}
								>
									{t.suite}: {t.passed}/{t.passed + t.failed} passed
								</span>
							))}
						</div>
						<pre className="bg-gray-950 text-gray-100 text-xs p-3 rounded overflow-x-auto max-h-64">
							{incident.fix.diff || "No diff generated."}
						</pre>
						{incident.fix.pullRequest ? (
							<a
								href={incident.fix.pullRequest.url}
								target="_blank"
								className="inline-block px-4 py-2 bg-black text-white rounded text-sm"
							>
								View PR #{incident.fix.pullRequest.prNumber} (
								{incident.fix.pullRequest.status})
							</a>
						) : (
							<p className="text-gray-500">
								{incident.fix.status === "needs_review"
									? "Flagged for manual review — no PR opened."
									: "PR not yet created."}
							</p>
						)}
					</div>
				) : (
					<EmptyState label="Fix generation pending…" />
				)}
			</Section>
		</div>
	);
}

function Section({
	title,
	children,
}: {
	title: string;
	children: React.ReactNode;
}) {
	return (
		<div className="mb-8">
			<h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
				{title}
			</h2>
			{children}
		</div>
	);
}
function EmptyState({ label }: { label: string }) {
	return <p className="text-gray-400 text-sm italic">{label}</p>;
}
function StatusPill({ status }: { status: string }) {
	const colors: Record<string, string> = {
		reproduced: "bg-red-100 text-red-700",
		not_reproduced: "bg-green-100 text-green-700",
		running: "bg-yellow-100 text-yellow-700",
		error: "bg-gray-200 text-gray-700",
	};
	return (
		<span
			className={`px-2 py-0.5 rounded text-xs ${colors[status] ?? "bg-gray-100 text-gray-700"}`}
		>
			{status.replace("_", " ")}
		</span>
	);
}
function RiskBadge({ level }: { level: string }) {
	const colors: Record<string, string> = {
		low: "text-green-600",
		medium: "text-yellow-600",
		high: "text-red-600",
	};
	return <span className={`font-medium ${colors[level] ?? ""}`}>{level}</span>;
}
