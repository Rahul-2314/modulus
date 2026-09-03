import { describe, it, expect } from "vitest";
import { runReproductionSandbox } from "@modulus/sandbox";

// Tests that Docker's NetworkMode: "none" actually prevents
// outbound network access from inside the sandbox.
describe("adversarial: sandbox network isolation", () => {
	it("blocks outbound network access during the isolated test run", async ({
		skip,
	}) => {
		let result;

		try {
			result = await runReproductionSandbox({
				cloneUrl:
					"https://github.com/modulus-test-fixtures/network-attempt-fixture",
				commitSha: "main",
				fixture: "{}",
			});
		} catch (error) {
			// Skip only when Docker itself is unavailable.
			// Do not hide genuine sandbox failures.
			if (String(error).match(/docker|no such image|connect|ECONNREFUSED/i)) {
				skip();
				return;
			}

			throw error;
		}

		// The command inside the sandbox attempts outbound network access.
		// With NetworkMode: "none", it must fail.
		expect(result.exitCode).not.toBe(0);

		// The exact error can differ between Docker/Node/Linux versions.
		expect(result.logs).toMatch(
			/could not resolve host|network is unreachable|timed out|failed to connect|couldn't connect/i,
		);

		// The sandbox itself should not have timed out.
		expect(result.timedOut).toBe(false);
	}, 30_000);
});
