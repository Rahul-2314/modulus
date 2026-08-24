import { Queue } from "bullmq";

const connection = { url: process.env.REDIS_URL! };

export const ingestionQueue = new Queue("ingestion", { connection });
