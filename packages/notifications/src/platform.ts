import { sendSlackAlert } from "./slack.js";
import { sendPagerDutyAlert } from "./pagerduty.js";
import { sendPlatformAlertEmail } from "@modulus/email";

export interface PlatformAlertPayload {
	source: string;
	message: string;
	severity: "warning" | "critical";
}

export async function sendPlatformNotification(payload: PlatformAlertPayload) {
  const tasks: Promise<unknown>[] = [];

  if (process.env.OPS_SLACK_WEBHOOK_URL) {
    tasks.push(sendSlackAlert(process.env.OPS_SLACK_WEBHOOK_URL, `⚠️ [${payload.severity.toUpperCase()}] ${payload.source}: ${payload.message}`));
  }
  // Only platform-critical pages the on-call rotation
  if (process.env.OPS_PAGERDUTY_KEY && payload.severity === "critical") {
    tasks.push(sendPagerDutyAlert(process.env.OPS_PAGERDUTY_KEY, { summary: payload.message, severity: "critical", source: payload.source, dedupKey: payload.source }));
  }
  if (process.env.OPS_ALERT_EMAIL) {
    tasks.push(sendPlatformAlertEmail(process.env.OPS_ALERT_EMAIL, payload));
  }

  await Promise.allSettled(tasks);

}