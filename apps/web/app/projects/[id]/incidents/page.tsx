import Link from "next/link";
import { cookies } from "next/headers";

interface Incident {
	id: string;
	title: string;
	ruleId: string;
	severity: string;
	status: string;
	occurrenceCount: number;
	lastSeen: string;
}

async function getIncidents(
	projectId: string,
	status?: string,
): Promise<Incident[]> {
	const cookieStore = await cookies(); // Next 16: cookies() is async — must await
	const query = new URLSearchParams({ projectId, limit: "25" });
	if (status) query.set("status", status);

	const res = await fetch(
		`${process.env.INTERNAL_API_URL}/api/incidents?${query}`,
		{
			headers: { Cookie: cookieStore.toString() },
			cache: "no-store", // incident state changes from background workers — never serve a stale cached list
		},
	);
	const data = await res.json();
	return data.success ? data.data : [];
}

export default async function IncidentsPage({
	params,
	searchParams,
}: {
	params: Promise<{ id: string }>;
	searchParams: Promise<{ status?: string }>;
}) {
	const { id } = await params; // Next 16: params is a Promise
	const { status } = await searchParams; // same for searchParams
	const incidents = await getIncidents(id, status);

	return (
		<div className="p-8">
			<h1 className="text-2xl font-semibold mb-1">Incidents</h1>
			<p className="text-gray-500 text-sm mb-6">
				Detected failures across this project's agents.
			</p>

			<div className="flex gap-2 mb-4">
				{["", "open", "acknowledged", "resolved"].map((s) => (
					<Link
						key={s || "all"}
						href={
							s
								? `/projects/${id}/incidents?status=${s}`
								: `/projects/${id}/incidents`
						}
						className={`px-3 py-1.5 rounded text-sm border ${status === s || (!status && !s) ? "bg-black text-white" : "bg-white text-gray-700"}`}
					>
						{s ? s[0].toUpperCase() + s.slice(1) : "All"}
					</Link>
				))}
			</div>

			<div className="border rounded overflow-hidden">
				<table className="w-full text-sm">
					<thead className="bg-gray-50 text-left text-gray-500">
						<tr>
							<th className="p-3">Title</th>
							<th className="p-3">Rule</th>
							<th className="p-3">Severity</th>
							<th className="p-3">Status</th>
							<th className="p-3">Occurrences</th>
							<th className="p-3">Last seen</th>
						</tr>
					</thead>
					<tbody>
						{incidents.map((incident) => (
							<tr key={incident.id} className="border-t hover:bg-gray-50">
								<td className="p-3">
									<Link
										href={`/projects/${id}/incidents/${incident.id}`}
										className="font-medium hover:underline"
									>
										{incident.title}
									</Link>
								</td>
								<td className="p-3 text-gray-500 font-mono text-xs">
									{incident.ruleId}
								</td>
								<td className="p-3">
									<SeverityBadge severity={incident.severity} />
								</td>
								<td className="p-3">
									<StatusBadge status={incident.status} />
								</td>
								<td className="p-3">{incident.occurrenceCount}</td>
								<td className="p-3 text-gray-500">
									{new Date(incident.lastSeen).toLocaleString()}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}

function SeverityBadge({ severity }: { severity: string }) {
	const colors: Record<string, string> = {
		low: "bg-blue-100 text-blue-700",
		medium: "bg-yellow-100 text-yellow-700",
		high: "bg-orange-100 text-orange-700",
		critical: "bg-red-100 text-red-700",
	};
	return (
		<span
			className={`px-2 py-0.5 rounded text-xs ${colors[severity] ?? "bg-gray-100 text-gray-700"}`}
		>
			{severity}
		</span>
	);
}

function StatusBadge({ status }: { status: string }) {
	const colors: Record<string, string> = {
		open: "bg-red-100 text-red-700",
		acknowledged: "bg-yellow-100 text-yellow-700",
		resolved: "bg-green-100 text-green-700",
	};
	return (
		<span
			className={`px-2 py-0.5 rounded text-xs ${colors[status] ?? "bg-gray-100 text-gray-700"}`}
		>
			{status}
		</span>
	);
}
