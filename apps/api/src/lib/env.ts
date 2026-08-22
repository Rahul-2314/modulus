import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Configuration is centralized in the repository-root .env file.
const currentDirectory = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(currentDirectory, "../../../../.env") });
