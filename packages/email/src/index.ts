import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);
const FROM = process.env.EMAIL_FROM ?? "Modulus <noreply@rahulchowdhury.in>";

// extra check
if (!FROM) {
	throw new Error("EMAIL_FROM environment variable is required");
}

export async function sendVerificationEmail(to: string, url: string) {
	await resend.emails.send({
		from: FROM,
		to,
		subject: "Verify your Modulus email",
		html: `<p>Click to verify your email:</p><p><a href="${url}">${url}</a></p>`,
	});
}

export async function sendPasswordResetEmail(to: string, url: string) {
	await resend.emails.send({
		from: FROM,
		to,
		subject: "Reset your Modulus password",
		html: `<p>Click to reset your password:</p><p><a href="${url}">${url}</a></p><p>If you didn't request this, ignore this email.</p>`,
	});
}

export async function sendTwoFactorOtp(to: string, otp: string) {
	await resend.emails.send({
		from: FROM,
		to,
		subject: "Your Modulus verification code",
		html: `<p style="font-size:28px;font-weight:700;letter-spacing:4px;">${otp}</p><p>Expires in a few minutes.</p>`,
	});
}


// paltform incident mails
export async function sendIncidentAlertEmail(to: string, payload: { title: string; severity: string; projectName: string; dashboardUrl: string }) {
  await resend.emails.send({
    from: FROM, to, subject: `[${payload.severity.toUpperCase()}] ${payload.title} — ${payload.projectName}`,
    html: `<p>A new ${payload.severity} incident was detected in <strong>${payload.projectName}</strong>.</p><p>${payload.title}</p><p><a href="${payload.dashboardUrl}">View incident</a></p>`,
  });
}

export async function sendPlatformAlertEmail(to: string, payload: { source: string; message: string; severity: string }) {
  await resend.emails.send({
    from: FROM, to, subject: `[Modulus Ops][${payload.severity.toUpperCase()}] ${payload.source}`,
    html: `<p>${payload.message}</p>`,
  });
}

