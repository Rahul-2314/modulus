import { describe, expect, it } from "vitest";
import { runReproductionSandbox } from "@modulus/sandbox";

describe("adversarial: sandbox network isolation", () => {
	it("blocks outbound network access during the isolated test run", async ({
		skip,
	}) => {
		let result: Awaited<ReturnType<typeof runReproductionSandbox>>;

		try {
			result = await runReproductionSandbox({
				cloneUrl:
					"https://github.com/modulus-test-fixtures/network-attempt-fixture",
				commitSha: "main",
				fixture: "{}",
				reproduceCommand: `node -e "fetch('https://example.com').then(() => process.exit(0)).catch((error) => { console.error(error.code ?? error.message); process.exit(1); })"`,
			});
		} catch (error) {
			const message = String(error);

			/*
			 * Docker itself being unavailable is an environment
			 * problem, so skip rather than fail CI.
			 */
			if (
				/docker/i.test(message) &&
				/(not found|unavailable|daemon|connect|ECONNREFUSED|ENOENT)/i.test(
					message,
				)
			) {
				skip();
				return;
			}

			/*
			 * A missing fixture/repository is NOT evidence that
			 * network isolation works. Fail the test instead of
			 * hiding the problem.
			 */
			throw error;
		}

		/*
		 * The fixture attempts an outbound network request.
		 *
		 * NetworkMode: "none" means the request must fail.
		 */
		expect(result.exitCode).not.toBe(0);

		expect(result.logs).toMatch(
			/could not resolve host|network is unreachable|timed out|failed to connect|couldn't connect|fetch failed|ENETUNREACH|ECONNREFUSED/i,
		);

		/*
		 * Network isolation should fail quickly; a sandbox timeout
		 * would indicate a different failure mode.
		 */
		expect(result.timedOut).toBe(false);
	}, 30_000);
});
