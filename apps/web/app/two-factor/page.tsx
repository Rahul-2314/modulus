"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function TwoFactorPage() {
	const [code, setCode] = useState("");
	const [useBackupCode, setUseBackupCode] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const router = useRouter();

	async function verify(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		const { error } = useBackupCode
			? await authClient.twoFactor.verifyBackupCode({ code, trustDevice: true })
			: await authClient.twoFactor.verifyTotp({ code, trustDevice: true });

		if (error) setError(error.message ?? "Invalid code");
		else router.push("/projects");
	}

	return (
		<div className="max-w-sm mx-auto mt-20">
			<h1 className="text-xl font-semibold mb-4">Two-factor verification</h1>
			<form onSubmit={verify} className="flex flex-col gap-3">
				<input
					className="border p-2 rounded"
					placeholder={useBackupCode ? "Backup code" : "6-digit code"}
					value={code}
					onChange={(e) => setCode(e.target.value)}
				/>
				{error && <p className="text-red-600 text-sm">{error}</p>}
				<button className="bg-black text-white p-2 rounded" type="submit">
					Verify
				</button>
			</form>
			<div className="flex flex-col gap-2 mt-4 text-sm">
				{!useBackupCode && (
					<button
						onClick={() => authClient.twoFactor.sendOtp()}
						className="text-gray-600 underline text-left"
					>
						Email me a code instead
					</button>
				)}
				<button
					onClick={() => setUseBackupCode((v) => !v)}
					className="text-gray-600 underline text-left"
				>
					{useBackupCode
						? "Use authenticator app instead"
						: "Use a backup code instead"}
				</button>
			</div>
		</div>
	);
}
