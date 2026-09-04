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
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	async function loadProjects() {
		try {
			const res = await fetch("/api/projects", {
				credentials: "include",
			});

			const data = await res.json();

			if (data.success) {
				setProjects(data.data);
			}
		} catch {
			setError("Failed to load projects.");
		}
	}

	useEffect(() => {
		void loadProjects();
	}, []);

	async function createProject(e: React.SubmitEvent<HTMLFormElement>) {
		e.preventDefault();

		if (!name.trim()) {
			setError("Project name is required.");
			return;
		}

		setError(null);
		setLoading(true);

		try {
			const meRes = await fetch("/api/me", {
				credentials: "include",
			});

			const me = await meRes.json();

			const organizationId = me.data?.organizations?.[0]?.id;

			if (!me.success || !organizationId) {
				setError("Unable to find your organization.");
				return;
			}

			const res = await fetch("/api/projects", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				credentials: "include",
				body: JSON.stringify({
					name: name.trim(),
					organizationId,
				}),
			});

			const data = await res.json();

			if (!data.success) {
				setError(data.error?.message ?? "Failed to create project.");
				return;
			}

			setName("");
			await loadProjects();
		} catch {
			setError("Something went wrong. Please try again.");
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="max-w-lg mx-auto mt-20">
			<h1 className="text-xl font-semibold mb-4">Projects</h1>

			<form onSubmit={createProject} className="flex gap-2 mb-3">
				<input
					className="border p-2 rounded flex-1"
					placeholder="Project name"
					value={name}
					onChange={(e) => setName(e.target.value)}
					disabled={loading}
				/>

				<button
					className="bg-black text-white px-4 rounded disabled:opacity-50"
					type="submit"
					disabled={loading}
				>
					{loading ? "Creating..." : "Create"}
				</button>
			</form>

			{error && <p className="text-red-600 text-sm mb-4">{error}</p>}

			<ul className="flex flex-col gap-2">
				{projects.map((project) => (
					<li key={project.id} className="border p-3 rounded">
						{project.name}{" "}
						<span className="text-gray-500">({project.environment})</span>
					</li>
				))}
			</ul>

			{projects.length === 0 && (
				<p className="text-gray-500 text-sm">
					No projects yet. Create your first project.
				</p>
			)}
		</div>
	);
}
