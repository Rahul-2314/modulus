"use client";
import { useEffect, useState } from "react";

interface Project {
	id: string;
	name: string;
	environment: string;
}

export default function ProjectsPage() {
	const [projects, setProjects] = useState<Project[]>([]);
	const [name, setName] = useState("");

	async function load() {
		const res = await fetch("/api/projects", { credentials: "include" });
		const data = await res.json();
		if (data.success) setProjects(data.data);
	}

	useEffect(() => {
		let active = true;

		void fetch("/api/projects", { credentials: "include" })
			.then((res) => res.json())
			.then((data) => {
				if (active && data.success) setProjects(data.data);
			});

		return () => {
			active = false;
		};
	}, []);

	async function createProject(e: React.FormEvent) {
		e.preventDefault();
		const meRes = await fetch("/api/me", { credentials: "include" });
		const me = await meRes.json();
		const organizationId = me.data?.organizations?.[0]?.id;
		if (!me.success || !organizationId) return;

		await fetch("/api/projects", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			credentials: "include",
			body: JSON.stringify({ name, organizationId }),
		});
		setName("");
		load();
	}

	return (
		<div className="max-w-lg mx-auto mt-20">
			<h1 className="text-xl font-semibold mb-4">Projects</h1>
			<form onSubmit={createProject} className="flex gap-2 mb-6">
				<input
					className="border p-2 rounded flex-1"
					placeholder="Project name"
					value={name}
					onChange={(e) => setName(e.target.value)}
				/>
				<button className="bg-black text-white px-4 rounded" type="submit">
					Create
				</button>
			</form>
			<ul className="flex flex-col gap-2">
				{projects.map((p) => (
					<li key={p.id} className="border p-3 rounded">
						{p.name} <span className="text-gray-500">({p.environment})</span>
					</li>
				))}
			</ul>
		</div>
	);
}
