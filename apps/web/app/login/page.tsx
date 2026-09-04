"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function LoginPage() {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const router = useRouter();

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		await authClient.signIn.email(
			{ email, password },
			{
				onSuccess: (ctx) => {
					// Better Auth's own 2FA (no custom "pending 2FA" state to track)
					router.push(ctx.data.twoFactorRedirect ? "/two-factor" : "/projects");
				},
				onError: (ctx) => setError(ctx.error.message),
			},
		);
	}

	return (
		<div className="max-w-sm mx-auto mt-20">
			<h1 className="text-xl font-semibold mb-4">Log in</h1>
			<form onSubmit={handleSubmit} className="flex flex-col gap-3">
				<input
					className="border p-2 rounded"
					type="email"
					placeholder="Email"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
				/>
				<input
					className="border p-2 rounded"
					type="password"
					placeholder="Password"
					value={password}
					onChange={(e) => setPassword(e.target.value)}
				/>
				{error && <p className="text-red-600 text-sm">{error}</p>}
				<button className="bg-black text-white p-2 rounded" type="submit">
					Log in
				</button>
			</form>
			<div className="flex flex-col gap-2 mt-4">
				<button
					onClick={() =>
						authClient.signIn.social({
							provider: "google",
							callbackURL: "/projects",
						})
					}
					className="border rounded p-2 text-sm hover:bg-gray-50"
				>
					Continue with Google
				</button>
				<button
					onClick={() =>
						authClient.signIn.social({
							provider: "github",
							callbackURL: "/projects",
						})
					}
					className="border rounded p-2 text-sm hover:bg-gray-50"
				>
					Continue with GitHub
				</button>
			</div>
		</div>
	);
}
