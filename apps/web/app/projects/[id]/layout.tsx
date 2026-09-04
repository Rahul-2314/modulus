import Link from "next/link";
import type { ReactNode } from "react";

export default async function ProjectLayout({
	children,
	params,
}: {
	children: ReactNode;
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;

	const nav = [
		{ href: `/projects/${id}`, label: "Dashboard" },
		{ href: `/projects/${id}/agents`, label: "Agents" },
		{ href: `/projects/${id}/executions`, label: "Executions" },
		{ href: `/projects/${id}/incidents`, label: "Incidents" },
		{ href: `/projects/${id}/api-keys`, label: "API Keys" },
		{ href: `/projects/${id}/settings`, label: "Settings" },
	];

	return (
		<div className="flex min-h-screen">
			<aside className="w-56 border-r bg-neutral-950 p-4 text-neutral-100">
				<p className="mb-4 text-sm text-neutral-400">Modulus</p>

				<nav className="flex flex-col gap-1">
					{nav.map((item) => (
						<Link
							key={item.href}
							href={item.href}
							className="rounded px-3 py-2 text-sm hover:bg-neutral-800"
						>
							{item.label}
						</Link>
					))}
				</nav>
			</aside>

			<main className="flex-1 bg-white">{children}</main>
		</div>
	);
}
