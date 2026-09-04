"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function RegisterPage() {
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	const router = useRouter();

	async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();

		setError(null);
		setLoading(true);

		try {
			const { error } = await authClient.signUp.email({
				name,
				email,
				password,
			});

			if (error) {
				setError(error.message ?? "Registration failed");
				return;
			}

			router.push("/projects");
			router.refresh();
		} catch {
			setError("Something went wrong. Please try again.");
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="max-w-sm mx-auto mt-20">
			<h1 className="text-xl font-semibold mb-4">Register</h1>

			<form onSubmit={handleSubmit} className="flex flex-col gap-3">
				<input
					className="border p-2 rounded"
					type="text"
					placeholder="Name"
					value={name}
					onChange={(e) => setName(e.target.value)}
					required
					disabled={loading}
				/>

				<input
					className="border p-2 rounded"
					type="email"
					placeholder="Email"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					required
					disabled={loading}
				/>

				<input
					className="border p-2 rounded"
					type="password"
					placeholder="Password"
					value={password}
					onChange={(e) => setPassword(e.target.value)}
					required
					disabled={loading}
				/>

				{error && <p className="text-red-600 text-sm">{error}</p>}

				<button
					className="bg-black text-white p-2 rounded disabled:opacity-50"
					type="submit"
					disabled={loading}
				>
					{loading ? "Registering..." : "Register"}
				</button>
			</form>
		</div>
	);
}
