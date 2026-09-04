export async function sendPagerDutyAlert(
	integrationKey: string,
	opts: {
		summary: string;
		severity: "critical" | "error" | "warning" | "info";
		source: string;
		dedupKey?: string;
	},
) {
	await fetch("https://events.pagerduty.com/v2/enqueue", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			routing_key: integrationKey,
			event_action: "trigger",
			dedup_key: opts.dedupKey,
			payload: {
				summary: opts.summary,
				severity: opts.severity,
				source: opts.source,
			},
		}),
	}).catch((err) => console.error("pagerduty alert failed", err));
}
