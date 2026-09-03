"use client";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function SecuritySettingsPage() {
	const [password, setPassword] = useState("");
	const [qrUri, setQrUri] = useState<string | null>(null);
	const [totpCode, setTotpCode] = useState("");
	const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
	const [enabled, setEnabled] = useState(false);

	async function startEnable() {
		const { data } = await authClient.twoFactor.enable({
			password,
			issuer: "Modulus",
		});
		if (data?.method === "totp") {
			setQrUri(data.totpURI);
			setBackupCodes(data.backupCodes ?? null);
		}
	}

	async function confirmEnable() {
		const { error } = await authClient.twoFactor.verifyTotp({ code: totpCode });
		if (!error) setEnabled(true);
	}

	return (
		<div className="max-w-sm mx-auto mt-20">
			<h1 className="text-xl font-semibold mb-4">Two-factor authentication</h1>
			{!qrUri && !enabled && (
				<div className="flex flex-col gap-3">
					<input
						className="border p-2 rounded"
						type="password"
						placeholder="Confirm your password"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
					/>
					<button
						onClick={startEnable}
						className="bg-black text-white p-2 rounded"
					>
						Enable 2FA
					</button>
				</div>
			)}
			{qrUri && !enabled && (
				<div className="flex flex-col gap-3">
					<p className="text-sm text-gray-500">
						Scan with your authenticator app, then enter the code.
					</p>
					{/* render qrUri as a QR code, e.g. with the `qrcode` or `react-qr-code` package */}
					<input
						className="border p-2 rounded"
						placeholder="6-digit code"
						value={totpCode}
						onChange={(e) => setTotpCode(e.target.value)}
					/>
					<button
						onClick={confirmEnable}
						className="bg-black text-white p-2 rounded"
					>
						Confirm
					</button>
				</div>
			)}
			{enabled && backupCodes && (
				<div className="text-sm">
					<p className="font-medium mb-2">
						Save these backup codes — each works once:
					</p>
					<ul className="font-mono bg-gray-50 border rounded p-3 space-y-1">
						{backupCodes.map((c) => (
							<li key={c}>{c}</li>
						))}
					</ul>
				</div>
			)}
		</div>
	);
}
