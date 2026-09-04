import { decrypt } from "@modulus/crypto";
import { sendSlackAlert } from "./slack.js";
import { sendPagerDutyAlert } from "./pagerduty.js";
import { sendIncidentAlertEmail } from "@modulus/email";

export interface CustomerAlertTarget {
	notificationSlackWebhookEncrypted: string | null;
	notificationPagerDutyKeyEncrypted: string | null;
	notificationEmail: string | null;
}

export interface IncidentAlertPayload {
	incidentId: string;
	title: string;
	severity: "low" | "medium" | "high" | "critical";
	projectName: string;
	dashboardUrl: string;
}

export async function notifyIncident(target: CustomerAlertTarget, payload: IncidentAlertPayload) {
	const tasks: Promise<unknown>[] = [];

	if (target.notificationSlackWebhookEncrypted) {
		tasks.push(
			sendSlackAlert(
				decrypt(target.notificationSlackWebhookEncrypted),
				`🔴 [${payload.severity.toUpperCase()}] ${payload.title} — ${payload.projectName}\n${payload.dashboardUrl}`,
			),
		);
	}
	if (target.notificationPagerDutyKeyEncrypted) {
		tasks.push(
			sendPagerDutyAlert(decrypt(target.notificationPagerDutyKeyEncrypted), {
				summary: `${payload.title} (${payload.projectName})`,
				severity: payload.severity === "critical" ? "critical" : "error",
				source: payload.projectName,
				dedupKey: payload.incidentId, // repeat alerts for the same incident
			}),
		);
	}
	if (target.notificationEmail) {
		tasks.push(sendIncidentAlertEmail(target.notificationEmail, payload));
	}

	await Promise.allSettled(tasks); // one channel failing must never block another
}