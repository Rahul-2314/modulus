import { Router } from "express";
import { requireSession } from "../middleware/session";
import { prisma } from "../lib/db";

export const meRouter = Router();

meRouter.get("/", requireSession, async (req, res, next) => {
	try {
		const memberships = await prisma.membership.findMany({
			where: { userId: req.user!.id },
			include: { organization: true },
		});

		res.json({
			success: true,
			data: {
				user: req.user,
				organizations: memberships.map(({ organization, role }) => ({
					id: organization.id,
					name: organization.name,
					role,
				})),
			},
		});
	} catch (err) {
		next(err);
	}
});
