export async function sendSlackAlert(webhookUrl: string, text: string) {
	await fetch(webhookUrl, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ text }),
	}).catch((err) => console.error("slack alert failed", err)); // notification delivery must never throw into the caller
}
