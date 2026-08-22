"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const router = useRouter();

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		const res = await fetch("/api/auth/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			credentials: "include",
			body: JSON.stringify({ email, password }),
		});
		const data = await res.json();
		if (!data.success) return setError(data.error.message);
		router.push("/projects");
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
		</div>
	);
}
