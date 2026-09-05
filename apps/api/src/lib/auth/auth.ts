import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { twoFactor } from "better-auth/plugins";
import { prisma } from "@modulus/database";
import { sendPasswordResetEmail, sendTwoFactorOtp } from "@modulus/email"; // sendVerificationEmail import removed — no longer used
import { audit } from "../audit";
import { personalOrg } from "./bootstrap.js";

const API_BASE_URL = process.env.API_BASE_URL;
const WEB_APP_URL = process.env.WEB_APP_URL;
if (!API_BASE_URL) throw new Error("API_BASE_URL is not configured");
if (!WEB_APP_URL) throw new Error("WEB_APP_URL is not configured");

export const auth = betterAuth({
	database: prismaAdapter(prisma, { provider: "postgresql" }),
	appName: "Modulus",
	secret: process.env.BETTER_AUTH_SECRET!,
	baseURL: API_BASE_URL,
	trustedOrigins: [WEB_APP_URL],

	emailAndPassword: {
		enabled: true,
		requireEmailVerification: false, // signup/login create a session immediately, no email step
		sendResetPassword: async ({ user, url }) => sendPasswordResetEmail(user.email, url),
	},
	// emailVerification block removed entirely — nothing gates on it now

	socialProviders: {
		google: {
			clientId: process.env.GOOGLE_CLIENT_ID!,
			clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
		},
		github: {
			clientId: process.env.GITHUB_APP_CLIENT_ID!,
			clientSecret: process.env.GITHUB_APP_CLIENT_SECRET!,
		},
	},

	plugins: [
		twoFactor({
			issuer: "Modulus",
			totpOptions: { digits: 6, period: 30 },
			otpOptions: {
				sendOTP: async ({ user, otp }) => sendTwoFactorOtp(user.email, otp),
				period: 5,
				allowedAttempts: 5,
				storeOTP: "encrypted",
			},
			backupCodeOptions: { amount: 10, length: 10, storeBackupCodes: "encrypted" },
		}),
	],

	session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
	rateLimit: { window: 15 * 60, max: 10 },

	databaseHooks: {
		user: {
			create: {
				after: async (user) => personalOrg(user.id, user.email),
			},
		},
		session: {
			create: {
				after: async (session) =>
					audit({
						userId: session.userId,
						action: "login",
						resourceType: "user",
						resourceId: session.userId,
						...(typeof session.ipAddress === "string" ? { ipAddress: session.ipAddress } : {}),
					}),
			},
		},
	},
});
