const fs = require("fs");
const path = require("path");

const roots = ["apps", "packages", "workers"];
const packageFiles = [];

function walk(dir) {
	if (!fs.existsSync(dir)) return;

	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		if (
			entry.name === "node_modules" ||
			entry.name === "dist" ||
			entry.name === ".next" ||
			entry.name === ".turbo"
		) {
			continue;
		}

		const full = path.join(dir, entry.name);

		if (entry.isDirectory()) {
			walk(full);
		} else if (entry.name === "package.json") {
			packageFiles.push(full);
		}
	}
}

for (const root of roots) {
	walk(root);
}

const packages = packageFiles.map((file) => {
	const json = JSON.parse(fs.readFileSync(file, "utf8"));

	return {
		file,
		name: json.name,
		declared: new Set([
			...Object.keys(json.dependencies || {}),
			...Object.keys(json.devDependencies || {}),
			...Object.keys(json.peerDependencies || {}),
		]),
	};
});

function getPackageForFile(file) {
	let best = null;

	for (const pkg of packages) {
		const dir = path.dirname(pkg.file);

		if (file === dir || file.startsWith(dir + path.sep)) {
			if (!best || dir.length > path.dirname(best.file).length) {
				best = pkg;
			}
		}
	}

	return best;
}

const importRegex =
	/(?:from\s+|import\s*\(\s*|import\s+)(["'])(@modulus\/[^"']+)\1/g;

const missing = new Map();

function scan(dir) {
	if (!fs.existsSync(dir)) return;

	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		if (
			entry.name === "node_modules" ||
			entry.name === "dist" ||
			entry.name === ".next" ||
			entry.name === ".turbo"
		) {
			continue;
		}

		const full = path.join(dir, entry.name);

		if (entry.isDirectory()) {
			scan(full);
			continue;
		}

		if (!/\.(ts|tsx)$/.test(entry.name)) continue;

		const content = fs.readFileSync(full, "utf8");
		const pkg = getPackageForFile(full);

		if (!pkg) continue;

		let match;

		while ((match = importRegex.exec(content)) !== null) {
			const imported = match[2];
			const rootPackage = imported.split("/").slice(0, 2).join("/");

			if (rootPackage === pkg.name) continue;

			if (
				rootPackage.startsWith("@modulus/") &&
				!pkg.declared.has(rootPackage)
			) {
				if (!missing.has(pkg.name)) {
					missing.set(pkg.name, new Map());
				}

				const deps = missing.get(pkg.name);

				if (!deps.has(rootPackage)) {
					deps.set(rootPackage, []);
				}

				deps
					.get(rootPackage)
					.push(`${full}:${content.slice(0, match.index).split("\n").length}`);
			}
		}
	}
}

for (const root of roots) {
	scan(root);
}

if (missing.size === 0) {
	console.log("\n✅ No undeclared @modulus workspace imports found.\n");
	process.exit(0);
}

console.log("\n❌ Undeclared @modulus workspace dependencies:\n");

for (const [pkg, deps] of missing) {
	console.log(`\n${pkg}`);

	for (const [dependency, locations] of deps) {
		console.log(`  ${dependency}`);

		for (const location of locations) {
			console.log(`    ${location}`);
		}
	}
}

console.log();
process.exit(1);
