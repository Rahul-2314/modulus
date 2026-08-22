import express from "express";
import cookieParser from "cookie-parser";
import { authRouter } from "./routes/auth";
import { meRouter } from "./routes/me";
import { projectsRouter } from "./routes/projects";
import { errorHandler } from "./lib/errors";

export const app = express();

app.use(cookieParser());
app.use(express.json());

app.get("/", (_req, res) => {
	res.json({
		success: true,
		message: "API is running",
	});
});

app.use("/api/auth", authRouter);
app.use("/api/me", meRouter);
app.use("/api/projects", projectsRouter);

app.use(errorHandler);
