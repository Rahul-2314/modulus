import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(packageDirectory, "../../..");

config({ path: resolve(repositoryRoot, ".env") });

export {};
