import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.js";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
	throw new Error("DATABASE_URL is not set");
}

export { PrismaClient, $Enums, Prisma } from "./generated/prisma/client.js";
export { User, Membership, Organization, Project, AloMetricType } from "./generated/prisma/client.js";

export const prisma = new PrismaClient({
	adapter: new PrismaPg({ connectionString }),
});

export type {
	Incident,
	Diagnosis,
	Execution,
	ExecutionEvent,
	ToolCall,
	Agent,
} from "./generated/prisma/client.js";
