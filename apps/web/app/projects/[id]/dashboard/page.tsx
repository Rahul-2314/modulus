"use client";
import { useEffect, useState } from "react";

// dashboard state schema
interface DashboardData {
	executionVolume: number;
	successRate: number | null;
	incidents: { open: number; acknowledged: number; resolved: number };
	pullRequests: {
		total: number;
		merged: number;
		acceptanceRate: number | null;
	};
	estimatedTimeSavedMinutes: number;
}

export default function DashboardPage({ params }: { params: { id: string } }) {
	const [data, setData] = useState<DashboardData | null>(null);

	useEffect(() => {
		fetch(`/api/dashboard/${params.id}`, { credentials: "include" })
			.then((r) => r.json())
			.then((res) => res.success && setData(res.data));
	}, [params.id]);

	if (!data) return <p className="mt-20 text-center">Loading…</p>;

	return (
		<div className="max-w-3xl mx-auto mt-20 grid grid-cols-2 gap-4">
			<Card label="Executions (30d)" value={data.executionVolume} />
			<Card label="Success rate" value={fmtPerct(data.successRate)} />
			<Card label="Open incidents" value={data.incidents.open} />
			<Card label="Resolved incidents" value={data.incidents.resolved} />
			<Card label="PRs created" value={data.pullRequests.total} />
			<Card
				label="PR acceptance rate"
				value={fmtPerct(data.pullRequests.acceptanceRate)}
			/>
			<Card
				label="Est. time saved"
				value={`${Math.round(data.estimatedTimeSavedMinutes / 60)}h`}
			/>
		</div>
	);
}

function fmtPerct(v: number | null) {
	return v !== null ? `${(v * 100).toFixed(1)}%` : "—";
}

function Card({ label, value }: { label: string; value: string | number }) {
	return (
		<div className="border rounded p-4">
			<p className="text-gray-500 text-sm">{label}</p>
			<p className="text-2xl font-semibold">{value}</p>
		</div>
	);
}