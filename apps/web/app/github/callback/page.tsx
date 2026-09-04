import { Suspense } from "react";
import GitHubCallbackContent from "./content";

export default function GitHubCallbackPage() {
	return (
		<Suspense
			fallback={<div className="mt-20 text-center">Connecting GitHub…</div>}
		>
			<GitHubCallbackContent />
		</Suspense>
	);
}
