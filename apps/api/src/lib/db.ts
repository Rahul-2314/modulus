import "./env";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@modulus/database";
// import { PrismaClient } from "@modulus/database";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
	throw new Error("DATABASE_URL is not set");
}

const adapter = new PrismaPg({ connectionString });

// this file no need already present in @modulus/database, but i still implemented this for loacal import
export const prisma: PrismaClient = new PrismaClient({ adapter });
